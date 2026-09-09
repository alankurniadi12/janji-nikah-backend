import {
  createDraftInvitation,
  deleteDraftInvitation,
  getMemberInvitation,
  listMemberInvitations,
  previewMemberInvitation,
  publishMemberInvitation,
  updateMemberInvitation
} from "../services/invitationService.js";
import {
  addGalleryPhoto,
  deleteCouplePhoto,
  deleteGalleryPhoto,
  deleteMainPhoto,
  replaceCouplePhoto,
  replaceLoveStoryPhoto,
  replaceMainPhoto
} from "../services/invitationPhotoService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const memberInvitations = asyncHandler(async (req, res) => {
  const data = await listMemberInvitations(req.user, req.query);

  res.json({
    success: true,
    data
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

export const memberPublishInvitation = asyncHandler(async (req, res) => {
  const invitation = await publishMemberInvitation(req.user, req.params.id);

  res.json({
    success: true,
    data: {
      invitation
    }
  });
});

export const memberUploadMainPhoto = asyncHandler(async (req, res) => {
  const invitation = await replaceMainPhoto(req.user, req.params.id, req.file);

  res.json({
    success: true,
    data: {
      invitation
    }
  });
});

export const memberDeleteMainPhoto = asyncHandler(async (req, res) => {
  const invitation = await deleteMainPhoto(req.user, req.params.id);

  res.json({
    success: true,
    data: {
      invitation
    }
  });
});

export const memberUploadCouplePhoto = asyncHandler(async (req, res) => {
  const invitation = await replaceCouplePhoto(req.user, req.params.id, req.params.role, req.file);

  res.json({
    success: true,
    data: {
      invitation
    }
  });
});

export const memberDeleteCouplePhoto = asyncHandler(async (req, res) => {
  const invitation = await deleteCouplePhoto(req.user, req.params.id, req.params.role);

  res.json({
    success: true,
    data: {
      invitation
    }
  });
});

export const memberUploadGalleryPhoto = asyncHandler(async (req, res) => {
  const invitation = await addGalleryPhoto(req.user, req.params.id, req.file);

  res.json({
    success: true,
    data: {
      invitation
    }
  });
});

export const memberUploadLoveStoryPhoto = asyncHandler(async (req, res) => {
  const invitation = await replaceLoveStoryPhoto(req.user, req.params.id, req.params.storyIndex, req.file);

  res.json({
    success: true,
    data: {
      invitation
    }
  });
});

export const memberDeleteGalleryPhoto = asyncHandler(async (req, res) => {
  const invitation = await deleteGalleryPhoto(req.user, req.params.id, req.params.photoId);

  res.json({
    success: true,
    data: {
      invitation
    }
  });
});
