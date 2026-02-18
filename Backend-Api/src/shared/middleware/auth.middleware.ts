import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@/infrastructure/helpers/token.helper";
import UnauthenticatedError from "@/shared/errors/unaunthenticated";
import User from "modules/auth/authmodel";
import { extractRequestContext } from "./request.context";
import { getLatestHashForDevice } from "@/infrastructure/helpers/session.helper";
import Unauthorized from "../errors/unauthorized";

export interface AccessPayload {
    userId: string;
    email: string;
    role: string;
    deviceId: string;
    iat?: number;
    exp?: number;
    sub: string
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
        const userDoc = await User.findById(payload.sub).select("-password").exec();

        if (!userDoc) {
            return next(new UnauthenticatedError("Unauthorize"));
        }

        const latestHash = await getLatestHashForDevice(payload.sub, payload.deviceId);
        if (!latestHash) throw new Unauthorized("Session expired / logged out");

        req.user = {
            sub: userDoc._id.toString(),
            userId: userDoc.userId,
            email: userDoc.email,
            role: userDoc.role,
            deviceId: payload.deviceId
        };

        req.context = extractRequestContext(req);

        next();
    } catch (err) {
        return next(new UnauthenticatedError("Unauthorize"));
    }
};
