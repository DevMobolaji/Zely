import { IAuthRequest } from "@/config/interfaces/request.interface";
import { Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export function requestIdMiddleware(
    req: IAuthRequest,
    res: Response,
    next: NextFunction
): void {
    if (!req.requestId) {
        req.requestId = uuidv4();
    }

    
    res.setHeader("X-Request-ID", req.requestId);
    next();
}
