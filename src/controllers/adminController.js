import { getAdminDashboard } from "../services/dashboardService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getAdminDashboard();

  res.json({
    success: true,
    data: dashboard
  });
});
