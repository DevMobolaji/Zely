import { Request } from "express";
import { IRequestContext } from "@/interfaces/RequestContext";

export const buildRequestContext = (req: Request): IRequestContext => ({
    requestId: (req as any).requestId,
    ip: req.ip || "",
    userAgent: req.get("User-Agent") || "",
    email: (req as any).user?.email || req.body?.email || "",
});