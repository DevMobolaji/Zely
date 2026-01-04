// cookie.helpers.ts
import { Response } from "express";

const REFRESH_COOKIE_NAME = "refreshToken";

export const setRefreshCookie = (res: Response, token: string, maxAgeMs: number) => {
    res.cookie(REFRESH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,            // set true in production (HTTPS)
        sameSite: "strict",
        path: "/auth/refresh",
        maxAge: maxAgeMs,
    });
};

export const clearRefreshCookie = (res: Response) => {
    res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/auth/refresh",
    });
};
