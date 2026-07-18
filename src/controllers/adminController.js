import { getAdminDashboard } from "../services/dashboardService.js";
import {
  getCreditReport,
  getRevenueReport,
  getThemeUsageReport
} from "../services/reportService.js";
import {
  adjustMemberCredits,
  getAdminInvitation,
  getMemberDetail,
  listAdminInvitations,
  listAuditLogs,
  listMembers,
  unlockInvitation,
  updateMemberStatus
} from "../services/adminManagementService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminDashboard = asyncHandler(async (req, res) => {
  const dashboard = await getAdminDashboard();

  res.json({
    success: true,
    data: dashboard
  });
});

export const adminMembers = asyncHandler(async (req, res) => {
  const members = await listMembers(req.query);
  res.json({ success: true, data: { members } });
});

export const adminMemberDetail = asyncHandler(async (req, res) => {
  const member = await getMemberDetail(req.params.id);
  res.json({ success: true, data: { member } });
});

export const adminUpdateMemberStatus = asyncHandler(async (req, res) => {
  const member = await updateMemberStatus(req.user, req.params.id, req.body.status);
  res.json({ success: true, data: { member } });
});

export const adminAdjustMemberCredits = asyncHandler(async (req, res) => {
  const data = await adjustMemberCredits(req.user, req.params.id, req.body);
  res.json({ success: true, data });
});

export const adminInvitations = asyncHandler(async (req, res) => {
  const invitations = await listAdminInvitations(req.query);
  res.json({ success: true, data: { invitations } });
});

export const adminInvitationDetail = asyncHandler(async (req, res) => {
  const invitation = await getAdminInvitation(req.params.id);
  res.json({ success: true, data: { invitation } });
});

export const adminUnlockInvitation = asyncHandler(async (req, res) => {
  const invitation = await unlockInvitation(req.user, req.params.id, req.body.note || "");
  res.json({ success: true, data: { invitation } });
});

export const adminAuditLogs = asyncHandler(async (req, res) => {
  const auditLogs = await listAuditLogs();
  res.json({ success: true, data: { auditLogs } });
});

export const adminRevenueReport = asyncHandler(async (req, res) => {
  const report = await getRevenueReport(req.query);
  res.json({ success: true, data: { report } });
});

export const adminCreditReport = asyncHandler(async (req, res) => {
  const report = await getCreditReport(req.query);
  res.json({ success: true, data: { report } });
});

export const adminThemeUsageReport = asyncHandler(async (req, res) => {
  const report = await getThemeUsageReport(req.query);
  res.json({ success: true, data: { report } });
});
