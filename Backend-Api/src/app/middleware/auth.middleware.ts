import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@/core/lib/token.helper";
import UnauthenticatedError from "@/core/errors/unaunthenticated";
import User from "@/domain/auth/authmodel"

export interface AccessPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}


export const requireAuth = async (
    req: Request & { user?: any },
    res: Response,
    next: NextFunction
) => {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
        return next(new UnauthenticatedError("Unauthorized"));
    }

    let token = header.substring(7);

    token = token.replace(/^'|'$/g, "").replace(/^"|"$/g, "");

    try {
        // 1. Verify
        const payload: AccessPayload = await verifyAccessToken(token);

        // 2. Fetch user
        const userDoc = await User.findById(payload.userId).select("-password").exec();
        if (!userDoc) {
            return next(new UnauthenticatedError("Unauthorize"));
        }

        // 3. Attach user to request
        req.user = userDoc;

        next();
    } catch (err) {
        return next(new UnauthenticatedError("Unauthorize"));
    }
};
