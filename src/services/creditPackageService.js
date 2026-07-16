import CreditPackage from "../models/CreditPackage.js";
import AuditLog from "../models/AuditLog.js";
import { AppError } from "../utils/AppError.js";

export function toPublicCreditPackage(creditPackage) {
  return {
    id: creditPackage._id.toString(),
    name: creditPackage.name,
    creditAmount: creditPackage.creditAmount,
    price: creditPackage.price,
    isActive: creditPackage.isActive,
    createdAt: creditPackage.createdAt,
    updatedAt: creditPackage.updatedAt
  };
}

export async function listActiveCreditPackages() {
  const packages = await CreditPackage.find({ isActive: true }).sort({ creditAmount: 1 }).lean();
  return packages.map(toPublicCreditPackage);
}

export async function listAdminCreditPackages() {
  const packages = await CreditPackage.find().sort({ creditAmount: 1 }).lean();
  return packages.map(toPublicCreditPackage);
}

export async function createCreditPackage(actor, payload) {
  validateCreditPackagePayload(payload, { requireAll: true });

  const creditPackage = await CreditPackage.create({
    name: payload.name,
    creditAmount: payload.creditAmount,
    price: payload.price,
    isActive: payload.isActive ?? true
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

  const creditPackage = await CreditPackage.findById(packageId);

  if (!creditPackage) {
    throw new AppError(404, "Paket kredit tidak ditemukan.");
  }

  const before = creditPackage.toObject();

  if (payload.name !== undefined) creditPackage.name = payload.name;
  if (payload.creditAmount !== undefined) creditPackage.creditAmount = payload.creditAmount;
  if (payload.price !== undefined) creditPackage.price = payload.price;

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

  const creditPackage = await CreditPackage.findById(packageId);

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
}
