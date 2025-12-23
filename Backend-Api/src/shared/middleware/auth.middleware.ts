import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "infrastructure/lib/token.helper";
import UnauthenticatedError from "infrastructure/errors/unaunthenticated";
import User from "modules/auth/authmodel";
import { extractRequestContext } from "./request.context";

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
    console.log(header)

    try {
        // 1. Verify
        const payload: AccessPayload = await verifyAccessToken(token);
        console.log(payload)

        // 2. Fetch user
        const userDoc = await User.findById(payload.userId).select("-password").exec();
        if (!userDoc) {
            return next(new UnauthenticatedError("Unauthorize"));
        }

        req.user = {
            userId: userDoc._id.toString(),
            email: userDoc.email,
            role: userDoc.role
        };

        req.context = extractRequestContext(req);

        next();
    } catch (err) {
        return next(new UnauthenticatedError("Unauthorize"));
    }
};
