import CreditLedger from "../models/CreditLedger.js";
import Invitation from "../models/Invitation.js";
import Theme from "../models/Theme.js";
import Transaction from "../models/Transaction.js";

export function createDateRangeFilter({ startDate, endDate } = {}, field = "createdAt") {
  const filter = {};
  const start = parseDate(startDate, "start");
  const end = parseDate(endDate, "end");

  if (start && end && start > end) {
    return { [field]: { $gte: end, $lte: start } };
  }

  if (start) filter.$gte = start;
  if (end) filter.$lte = end;

  return Object.keys(filter).length > 0 ? { [field]: filter } : {};
}

export async function getRevenueReport(query = {}) {
  const dateFilter = createDateRangeFilter(query, "approvedAt");
  const match = {
    status: "success",
    ...dateFilter
  };
  const [summary = {}] = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        successCount: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
        baseRevenue: { $sum: "$baseAmount" },
        uniqueCodeTotal: { $sum: "$uniqueCode" },
        creditsSold: { $sum: "$creditAmount" }
      }
    }
  ]);

  return {
    range: normalizeRange(query),
    successCount: summary.successCount || 0,
    totalRevenue: summary.totalRevenue || 0,
    baseRevenue: summary.baseRevenue || 0,
    uniqueCodeTotal: summary.uniqueCodeTotal || 0,
    creditsSold: summary.creditsSold || 0
  };
}

export async function getCreditReport(query = {}) {
  const dateFilter = createDateRangeFilter(query, "createdAt");
  const rows = await CreditLedger.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" }
      }
    }
  ]);
  const byType = {
    purchase: emptyCreditMetric(),
    publish: emptyCreditMetric(),
    manual_adjustment: emptyCreditMetric()
  };

  for (const row of rows) {
    byType[row._id] = {
      count: row.count,
      amount: row.totalAmount
    };
  }

  return {
    range: normalizeRange(query),
    purchased: byType.purchase,
    used: byType.publish,
    manualAdjustment: byType.manual_adjustment,
    netChange: byType.purchase.amount + byType.publish.amount + byType.manual_adjustment.amount
  };
}

export async function getThemeUsageReport(query = {}) {
  const dateFilter = createDateRangeFilter(query, "publishedAt");
  const rows = await Invitation.aggregate([
    {
      $match: {
        publishedAt: { $ne: null },
        ...dateFilter
      }
    },
    {
      $group: {
        _id: "$themeId",
        totalPublished: { $sum: 1 },
        active: {
          $sum: {
            $cond: [{ $in: ["$status", ["active", "locked"]] }, 1, 0]
          }
        },
        expired: {
          $sum: {
            $cond: [{ $eq: ["$status", "expired"] }, 1, 0]
          }
        }
      }
    },
    { $sort: { totalPublished: -1 } }
  ]);
  const themeIds = rows.map((row) => row._id).filter(Boolean);
  const themes = await Theme.find({ _id: { $in: themeIds } }).lean();
  const themeById = new Map(themes.map((theme) => [theme._id.toString(), theme]));

  return {
    range: normalizeRange(query),
    themes: rows.map((row) => {
      const theme = row._id ? themeById.get(row._id.toString()) : null;

      return {
        themeId: row._id?.toString?.() || null,
        themeName: theme?.name || "Tanpa tema",
        themeKey: theme?.key || null,
        totalPublished: row.totalPublished,
        active: row.active,
        expired: row.expired
      };
    })
  };
}

function emptyCreditMetric() {
  return {
    count: 0,
    amount: 0
  };
}

function normalizeRange(query = {}) {
  const start = parseDate(query.startDate, "start");
  const end = parseDate(query.endDate, "end");

  return {
    startDate: start?.toISOString() || null,
    endDate: end?.toISOString() || null
  };
}

function parseDate(value, boundary = "start") {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (isDateOnly(value) && boundary === "end") {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
