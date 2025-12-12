require('dotenv').config();

export const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
export const REFRESH_EXPIRES_SEC = process.env.REFRESH_TOKEN_EXPIRES_SEC || "7d"; // default 14 days
export const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET!;
export const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET!;

console.log(ACCESS_EXPIRES, ACCESS_SECRET, REFRESH_EXPIRES_SEC, REFRESH_SECRET)

export const RedisKeys ={
    HASH_PREFIX: "refresh:hash:",        // refresh:hash:<hashedToken>
    LATEST_PREFIX: "refresh:latest:",    // refresh:latest:<userId>:<deviceId>
    DEVICES_PREFIX: "refresh:devices:"   // refresh:devices:<userId>
}
