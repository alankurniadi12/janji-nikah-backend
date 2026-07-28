import {
  getPublicGuestInvitation,
  markPublicGuestOpened,
  submitPublicRsvp,
  submitPublicWish,
  updatePublicWish
} from "../services/publicGuestService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const publicGuestInvitationDetail = asyncHandler(async (req, res) => {
  const data = await getPublicGuestInvitation(req.params.username, req.params.slug, req.params.token);

  res.json({
    success: true,
    data
  });
});

export const publicGuestOpen = asyncHandler(async (req, res) => {
  const data = await markPublicGuestOpened(req.params.username, req.params.slug, req.params.token);

  res.json({
    success: true,
    data
  });
});

export const publicGuestRsvp = asyncHandler(async (req, res) => {
  const rsvp = await submitPublicRsvp(req.params.username, req.params.slug, req.params.token, req.body);

  res.json({
    success: true,
    data: {
      rsvp
    }
  });
});

export const publicGuestWish = asyncHandler(async (req, res) => {
  const wish = await submitPublicWish(req.params.username, req.params.slug, req.params.token, req.body);

  res.status(201).json({
    success: true,
    data: {
      wish
    }
  });
});

export const publicGuestWishUpdate = asyncHandler(async (req, res) => {
  const wish = await updatePublicWish(
    req.params.username,
    req.params.slug,
    req.params.token,
    req.params.wishId,
    req.body
  );

  res.json({
    success: true,
    data: {
      wish
    }
  });
});
