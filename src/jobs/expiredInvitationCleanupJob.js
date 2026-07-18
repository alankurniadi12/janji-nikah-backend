import { env } from "../config/env.js";
import { cleanupExpiredInvitations } from "../services/cleanupService.js";

export function startExpiredInvitationCleanupJob() {
  if (env.cleanupIntervalMs <= 0) {
    return null;
  }

  const runCleanup = async () => {
    try {
      const result = await cleanupExpiredInvitations();

      if (result.processed > 0) {
        console.log(`Expired invitation cleanup processed ${result.processed} invitation(s).`);
      }
    } catch (error) {
      console.error("Expired invitation cleanup failed", error);
    }
  };

  const timer = setInterval(runCleanup, env.cleanupIntervalMs);
  timer.unref?.();
  runCleanup();

  return timer;
}
