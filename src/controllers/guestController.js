import {
  bulkCreateInvitationGuests,
  createInvitationGuest,
  deleteInvitationGuest,
  deleteMemberWish,
  getGuestWhatsappMessage,
  hideMemberWish,
  listInvitationGuests,
  listMemberWishes,
  markGuestSent,
  updateInvitationGuest
} from "../services/guestService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const memberGuests = asyncHandler(async (req, res) => {
  const guests = await listInvitationGuests(req.user, req.params.id);

  res.json({
    success: true,
    data: {
      guests
    }
  });
});

export const memberCreateGuest = asyncHandler(async (req, res) => {
  const guest = await createInvitationGuest(req.user, req.params.id, req.body);

  res.status(201).json({
    success: true,
    data: {
      guest
    }
  });
});

export const memberBulkCreateGuests = asyncHandler(async (req, res) => {
  const guests = await bulkCreateInvitationGuests(req.user, req.params.id, req.body);

  res.status(201).json({
    success: true,
    data: {
      guests
    }
  });
});

export const memberUpdateGuest = asyncHandler(async (req, res) => {
  const guest = await updateInvitationGuest(req.user, req.params.id, req.params.guestId, req.body);

  res.json({
    success: true,
    data: {
      guest
    }
  });
});

export const memberDeleteGuest = asyncHandler(async (req, res) => {
  await deleteInvitationGuest(req.user, req.params.id, req.params.guestId);

  res.json({
    success: true,
    message: "Tamu berhasil dihapus."
  });
});

export const memberMarkGuestSent = asyncHandler(async (req, res) => {
  const guest = await markGuestSent(req.user, req.params.id, req.params.guestId);

  res.json({
    success: true,
    data: {
      guest
    }
  });
});

export const memberGuestWhatsappMessage = asyncHandler(async (req, res) => {
  const data = await getGuestWhatsappMessage(req.user, req.params.id, req.params.guestId);

  res.json({
    success: true,
    data
  });
});

export const memberWishes = asyncHandler(async (req, res) => {
  const wishes = await listMemberWishes(req.user, req.params.id);

  res.json({
    success: true,
    data: {
      wishes
    }
  });
});

export const memberHideWish = asyncHandler(async (req, res) => {
  const wish = await hideMemberWish(req.user, req.params.id, req.params.wishId);

  res.json({
    success: true,
    data: {
      wish
    }
  });
});

export const memberDeleteWish = asyncHandler(async (req, res) => {
  await deleteMemberWish(req.user, req.params.id, req.params.wishId);

  res.json({
    success: true,
    message: "Ucapan berhasil dihapus."
  });
});
