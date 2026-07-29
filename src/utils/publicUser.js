export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    username: user.username,
    lastUsernameChangedAt: user.lastUsernameChangedAt,
    termsAcceptedAt: user.termsAcceptedAt,
    creditBalance: user.creditBalance,
    createdAt: user.createdAt,
    onboardingRequired: user.role === "member" && !user.termsAcceptedAt
  };
}
