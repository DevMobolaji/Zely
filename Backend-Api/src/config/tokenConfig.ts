export const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
export const REFRESH_EXPIRES_SEC = process.env.REFRESH_TOKEN_EXPIRES_SEC || "14d"; // default 14 days
export const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET!;
export const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET!;

