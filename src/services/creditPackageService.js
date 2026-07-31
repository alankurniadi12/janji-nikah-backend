import CreditPackage from "../models/CreditPackage.js";
import AuditLog from "../models/AuditLog.js";
import Transaction from "../models/Transaction.js";
import { AppError } from "../utils/AppError.js";

export function toPublicCreditPackage(creditPackage) {
  const now = new Date();
  const startsAt = creditPackage.startsAt || null;
  const endsAt = creditPackage.endsAt || null;
  const availabilityStatus = getAvailabilityStatus(creditPackage, now);

  return {
    id: creditPackage._id.toString(),
    name: creditPackage.name,
    creditAmount: creditPackage.creditAmount,
    price: creditPackage.price,
    isActive: creditPackage.isActive,
    promoCode: creditPackage.promoCode || "",
    startsAt,
    endsAt,
    deletedAt: creditPackage.deletedAt || null,
    isLimitedTime: Boolean(startsAt || endsAt),
    isCurrentlyAvailable: availabilityStatus === "available",
    availabilityStatus,
    countdownEndsAt: getCountdownEndsAt(creditPackage, now),
    createdAt: creditPackage.createdAt,
    updatedAt: creditPackage.updatedAt
  };
}

export async function listActiveCreditPackages() {
  await expireElapsedCreditPackages();

  const packages = await CreditPackage.find(buildActivePackageQuery(new Date())).sort({ creditAmount: 1, price: 1 }).lean();
  return packages.map(toPublicCreditPackage);
}

export async function listAdminCreditPackages() {
  await expireElapsedCreditPackages();

  const packages = await CreditPackage.find({ deletedAt: null }).sort({ creditAmount: 1, price: 1 }).lean();
  return packages.map(toPublicCreditPackage);
}

export async function createCreditPackage(actor, payload) {
  validateCreditPackagePayload(payload, { requireAll: true });
  await assertPromoCodeAvailable(payload.promoCode);

  const creditPackage = await CreditPackage.create({
    name: payload.name,
    creditAmount: Number(payload.creditAmount),
    price: Number(payload.price),
    isActive: payload.isActive ?? true,
    promoCode: normalizePromoCode(payload.promoCode),
    startsAt: normalizeOptionalDate(payload.startsAt),
    endsAt: normalizeOptionalDate(payload.endsAt),
    deletedAt: null
  });

  await AuditLog.create({
    actorId: actor._id,
    action: "credit_package.created",
    targetType: "CreditPackage",
    targetId: creditPackage._id,
    after: creditPackage.toObject()
  });

  return toPublicCreditPackage(creditPackage);
}

export async function updateCreditPackage(actor, packageId, payload) {
  validateCreditPackagePayload(payload, { requireAll: false });

  const creditPackage = await CreditPackage.findOne({ _id: packageId, deletedAt: null });

  if (!creditPackage) {
    throw new AppError(404, "Paket kredit tidak ditemukan.");
  }

  if (payload.promoCode !== undefined) {
    await assertPromoCodeAvailable(payload.promoCode, creditPackage._id);
  }

  const before = creditPackage.toObject();

  if (payload.name !== undefined) creditPackage.name = payload.name;
  if (payload.creditAmount !== undefined) creditPackage.creditAmount = Number(payload.creditAmount);
  if (payload.price !== undefined) creditPackage.price = Number(payload.price);
  if (payload.promoCode !== undefined) creditPackage.promoCode = normalizePromoCode(payload.promoCode);
  if (payload.startsAt !== undefined) creditPackage.startsAt = normalizeOptionalDate(payload.startsAt);
  if (payload.endsAt !== undefined) creditPackage.endsAt = normalizeOptionalDate(payload.endsAt);

  await creditPackage.save();

  await AuditLog.create({
    actorId: actor._id,
    action: "credit_package.updated",
    targetType: "CreditPackage",
    targetId: creditPackage._id,
    before,
    after: creditPackage.toObject()
  });

  return toPublicCreditPackage(creditPackage);
}

export async function setCreditPackageStatus(actor, packageId, isActive) {
  if (typeof isActive !== "boolean") {
    throw new AppError(400, "Status aktif wajib berupa boolean.");
  }

  const creditPackage = await CreditPackage.findOne({ _id: packageId, deletedAt: null });

  if (!creditPackage) {
    throw new AppError(404, "Paket kredit tidak ditemukan.");
  }

  const before = creditPackage.toObject();
  creditPackage.isActive = Boolean(isActive);
  await creditPackage.save();

  await AuditLog.create({
    actorId: actor._id,
    action: creditPackage.isActive ? "credit_package.activated" : "credit_package.deactivated",
    targetType: "CreditPackage",
    targetId: creditPackage._id,
    before,
    after: creditPackage.toObject()
  });

  return toPublicCreditPackage(creditPackage);
}

export async function deleteCreditPackage(actor, packageId) {
  const creditPackage = await CreditPackage.findOne({ _id: packageId, deletedAt: null });

  if (!creditPackage) {
    throw new AppError(404, "Paket kredit tidak ditemukan.");
  }

  const before = creditPackage.toObject();
  const usedByTransaction = await Transaction.exists({ packageId: creditPackage._id });

  if (usedByTransaction) {
    creditPackage.isActive = false;
    creditPackage.deletedAt = new Date();
    await creditPackage.save();
  } else {
    await creditPackage.deleteOne();
  }

  await AuditLog.create({
    actorId: actor._id,
    action: "credit_package.deleted",
    targetType: "CreditPackage",
    targetId: creditPackage._id,
    before,
    after: usedByTransaction ? creditPackage.toObject() : null,
    note: usedByTransaction ? "Paket disembunyikan karena sudah dipakai transaksi." : "Paket dihapus permanen karena belum dipakai transaksi."
  });

  return { id: creditPackage._id.toString() };
}

export function buildActivePackageQuery(now = new Date()) {
  return {
    isActive: true,
    deletedAt: null,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }
    ]
  };
}

export async function expireElapsedCreditPackages(now = new Date()) {
  await CreditPackage.updateMany(
    {
      isActive: true,
      deletedAt: null,
      endsAt: { $ne: null, $lte: now }
    },
    {
      $set: {
        isActive: false
      }
    }
  );
}

function validateCreditPackagePayload(payload, { requireAll }) {
  if (requireAll && !payload?.name) {
    throw new AppError(400, "Nama paket wajib diisi.");
  }

  if (requireAll && payload?.creditAmount === undefined) {
    throw new AppError(400, "Jumlah kredit wajib diisi.");
  }

  if (requireAll && payload?.price === undefined) {
    throw new AppError(400, "Harga paket wajib diisi.");
  }

  if (payload?.creditAmount !== undefined && Number(payload.creditAmount) < 1) {
    throw new AppError(400, "Jumlah kredit minimal 1.");
  }

  if (payload?.price !== undefined && Number(payload.price) < 0) {
    throw new AppError(400, "Harga paket tidak boleh negatif.");
  }

  if (payload?.creditAmount !== undefined && !Number.isInteger(Number(payload.creditAmount))) {
    throw new AppError(400, "Jumlah kredit wajib berupa integer.");
  }

  if (payload?.price !== undefined && !Number.isInteger(Number(payload.price))) {
    throw new AppError(400, "Harga paket wajib berupa integer.");
  }

  if (payload?.promoCode !== undefined && normalizePromoCode(payload.promoCode) && !/^[A-Z0-9-]{3,24}$/.test(normalizePromoCode(payload.promoCode))) {
    throw new AppError(400, "Kode promo hanya boleh huruf, angka, strip, 3-24 karakter.");
  }

  const startsAt = normalizeOptionalDate(payload?.startsAt);
  const endsAt = normalizeOptionalDate(payload?.endsAt);

  if (startsAt && endsAt && startsAt >= endsAt) {
    throw new AppError(400, "Waktu mulai promo harus sebelum waktu berakhir.");
  }
}

async function assertPromoCodeAvailable(promoCode, excludedId = null) {
  const normalizedPromoCode = normalizePromoCode(promoCode);

  if (!normalizedPromoCode) {
    return;
  }

  const query = {
    promoCode: normalizedPromoCode,
    deletedAt: null
  };

  if (excludedId) {
    query._id = { $ne: excludedId };
  }

  if (await CreditPackage.exists(query)) {
    throw new AppError(409, "Kode promo sudah dipakai paket lain.");
  }
}

function normalizePromoCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeOptionalDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "Format waktu promo tidak valid.");
  }

  return date;
}

function getAvailabilityStatus(creditPackage, now) {
  if (creditPackage.deletedAt) return "deleted";
  if (!creditPackage.isActive) return "inactive";
  if (creditPackage.startsAt && creditPackage.startsAt > now) return "scheduled";
  if (creditPackage.endsAt && creditPackage.endsAt <= now) return "expired";
  return "available";
}

function getCountdownEndsAt(creditPackage, now) {
  if (creditPackage.startsAt && creditPackage.startsAt > now) {
    return creditPackage.startsAt;
  }

  if (creditPackage.endsAt && creditPackage.endsAt > now) {
    return creditPackage.endsAt;
  }

  return null;
}
