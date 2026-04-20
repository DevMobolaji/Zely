import redis from "@/infrastructure/cache/redis.cli";
import { hashToken } from "@/config/hashToken";
import { config } from "@/config/index";

export async function markOldTokenForDeletionAfter(
  oldToken: string,
  graceMs: number
) {
  const hashed = hashToken(oldToken);
  const key = `${config.redis.hashPrefix}${hashed}`;

  // Use Redis EXPIRE to delete key after grace window
  // Convert ms → seconds
  const seconds = Math.ceil(graceMs / 1000);
  await redis.expire(key, seconds);
}
