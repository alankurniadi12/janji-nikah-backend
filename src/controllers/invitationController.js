import {
  createDraftInvitation,
  deleteDraftInvitation,
  getMemberInvitation,
  listMemberInvitations,
  previewMemberInvitation,
  updateMemberInvitation
} from "../services/invitationService.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const memberInvitations = asyncHandler(async (req, res) => {
  const invitations = await listMemberInvitations(req.user);

  res.json({
    success: true,
    data: {
      invitations
    }
  });
});

export const memberCreateInvitation = asyncHandler(async (req, res) => {
  const invitation = await createDraftInvitation(req.user, req.body);

  res.status(201).json({
    success: true,
    data: {
      invitation
    }
  });
});

export const memberInvitationDetail = asyncHandler(async (req, res) => {
  const invitation = await getMemberInvitation(req.user, req.params.id);

  res.json({
    success: true,
    data: {
      invitation
    }
  });
});

export const memberUpdateInvitation = asyncHandler(async (req, res) => {
  const invitation = await updateMemberInvitation(req.user, req.params.id, req.body);

  res.json({
    success: true,
    data: {
      invitation
    }
  });
});

export const memberDeleteInvitation = asyncHandler(async (req, res) => {
  await deleteDraftInvitation(req.user, req.params.id);

  res.json({
    success: true,
    message: "Draft undangan berhasil dihapus."
  });
});

export const memberPreviewInvitation = asyncHandler(async (req, res) => {
  const preview = await previewMemberInvitation(req.user, req.params.id);

  res.json({
    success: true,
    data: preview
  });
});

export const memberPublishInvitation = asyncHandler(async () => {
  throw new AppError(501, "Publish undangan akan diaktifkan pada Phase 6.");
});
