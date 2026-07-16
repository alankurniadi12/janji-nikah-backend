export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    username: user.username,
    termsAcceptedAt: user.termsAcceptedAt,
    creditBalance: user.creditBalance,
    onboardingRequired: user.role === "member" && !user.termsAcceptedAt
  };
}
