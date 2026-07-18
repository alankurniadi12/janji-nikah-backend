import {
  generateBrandingAssets,
  getBrandingProfile,
  upsertBrandingProfile
} from "../services/brandingService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const memberBrandingProfile = asyncHandler(async (req, res) => {
  const branding = await getBrandingProfile(req.user);

  res.json({
    success: true,
    data: {
      branding
    }
  });
});

export const memberUpsertBrandingProfile = asyncHandler(async (req, res) => {
  const branding = await upsertBrandingProfile(req.user, req.body);

  res.json({
    success: true,
    data: {
      branding
    }
  });
});

export const memberGenerateBranding = asyncHandler(async (req, res) => {
  const branding = await generateBrandingAssets(req.user, req.body);

  res.json({
    success: true,
    data: {
      branding: branding.profile,
      assets: branding.assets
    }
  });
});
