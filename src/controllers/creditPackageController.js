import {
  createCreditPackage,
  listActiveCreditPackages,
  listAdminCreditPackages,
  setCreditPackageStatus,
  updateCreditPackage
} from "../services/creditPackageService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const publicCreditPackages = asyncHandler(async (req, res) => {
  const packages = await listActiveCreditPackages();

  res.json({
    success: true,
    data: {
      packages
    }
  });
});

export const adminCreditPackages = asyncHandler(async (req, res) => {
  const packages = await listAdminCreditPackages();

  res.json({
    success: true,
    data: {
      packages
    }
  });
});

export const adminCreateCreditPackage = asyncHandler(async (req, res) => {
  const creditPackage = await createCreditPackage(req.user, req.body);

  res.status(201).json({
    success: true,
    data: {
      package: creditPackage
    }
  });
});

export const adminUpdateCreditPackage = asyncHandler(async (req, res) => {
  const creditPackage = await updateCreditPackage(req.user, req.params.id, req.body);

  res.json({
    success: true,
    data: {
      package: creditPackage
    }
  });
});

export const adminSetCreditPackageStatus = asyncHandler(async (req, res) => {
  const creditPackage = await setCreditPackageStatus(req.user, req.params.id, req.body.isActive);

  res.json({
    success: true,
    data: {
      package: creditPackage
    }
  });
});
