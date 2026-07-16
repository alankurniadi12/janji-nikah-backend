import { getPublicInvitation } from "../services/publicInvitationService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const publicInvitationDetail = asyncHandler(async (req, res) => {
  const invitation = await getPublicInvitation(req.params.username, req.params.slug);

  res.json({
    success: true,
    data: invitation
  });
});
