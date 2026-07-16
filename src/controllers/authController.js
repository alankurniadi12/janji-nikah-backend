import { completeOnboarding, loginWithGoogle, refreshAuth } from "../services/authService.js";
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie
} from "../services/tokenService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { toPublicUser } from "../utils/publicUser.js";

export const googleLogin = asyncHandler(async (req, res) => {
  const authPayload = await loginWithGoogle(req.body.idToken);

  setRefreshCookie(res, authPayload.refreshToken);

  res.status(200).json({
    success: true,
    data: {
      user: authPayload.user,
      accessToken: authPayload.accessToken
    }
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      user: toPublicUser(req.user)
    }
  });
});

export const refreshSession = asyncHandler(async (req, res) => {
  const authPayload = await refreshAuth(req.signedCookies?.[REFRESH_COOKIE_NAME]);

  setRefreshCookie(res, authPayload.refreshToken);

  res.json({
    success: true,
    data: {
      user: authPayload.user,
      accessToken: authPayload.accessToken
    }
  });
});

export const logout = asyncHandler(async (req, res) => {
  clearRefreshCookie(res);

  res.json({
    success: true,
    message: "Berhasil keluar."
  });
});

export const onboardMember = asyncHandler(async (req, res) => {
  const user = await completeOnboarding(req.user, req.body);

  res.json({
    success: true,
    data: {
      user
    }
  });
});
