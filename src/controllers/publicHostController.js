import { addPublicHostGuest, getPublicHostDashboard } from "../services/publicHostService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const publicHostDashboard = asyncHandler(async (req, res) => {
  const data = await getPublicHostDashboard(req.params.username, req.params.slug, req.params.token);

  res.json({
    success: true,
    data
  });
});

export const publicHostAddGuest = asyncHandler(async (req, res) => {
  const guest = await addPublicHostGuest(req.params.username, req.params.slug, req.params.token, req.body);

  res.status(201).json({
    success: true,
    data: { guest }
  });
});
