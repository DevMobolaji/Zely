import { Request, Response, NextFunction, Router } from "express"
import userService from "./authservice";
import asyncWrapper from "@/app/middleware/async.wrapper";
import Controller from "@/interfaces/controller.interfaces";
import { StatusCodes } from "http-status-codes";
import { UserRole } from "./authinterface";
import validationSchema from "./authvalidation";
import validateRequest from "@/app/middleware/validation.middleware";
import User from "./authinterface";
import { getRefreshCookieLifetimeMs } from "@/core/lib/token.helper";
import AuditLogger from "../audit/audit.service";
import { clearRefreshCookie, setRefreshCookie } from "@/core/lib/cookie.helper";
import { buildRequestContext } from "@/core/lib/requestContext.helper";
import { UserRegistrationResponse } from "@/interfaces/userResponse.interface";
import { requireAuth } from "@/app/middleware/auth.middleware";



class AuthController implements Controller {
    public path = "/auth";
    public route = Router();
    private userService = new userService();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.route.post(`${this.path}/register`, validateRequest(validationSchema.register, 'body'), this.register);
        this.route.post(`${this.path}/login`, this.login);
        this.route.post(`${this.path}/refresh-token`, this.refreshToken);
        this.route.post(`${this.path}/logout`, this.logout);
        this.route.post(`${this.path}/logout-all`, this.forceLogoutAll);
    }

    private createResponseDTO(user: User, refreshToken: string, accessToken?: string): UserRegistrationResponse {
        if (!user) {
            throw new Error("User not found");
        }
        return {
            userId: user._id.toString(),
            name: user.name,
            email: user.email,
            emailVerified: user.isEmailVerified as boolean,
            mfaEnabled: user.mfaEnabled || false,
            role: user.role as UserRole,
            accessToken: accessToken,
            refreshToken: refreshToken,
        }
    }

    //HANDLES THE REGISTER ROUTE
    private register = asyncWrapper(async (req: Request, res: Response): Promise<Response | void> => {

        const { email, password, name, deviceId } = req.body

        const context = buildRequestContext(req);

        const tk = await this.userService.Register(name, email, password, context, deviceId);

        const responseData = this.createResponseDTO(tk.user, tk.refreshToken, tk.accessToken);
        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        res.status(StatusCodes.CREATED).json({ user: responseData });
    })

    //HANDLES THE LOGIN ROUTE
    private login = asyncWrapper(async (req: Request, res: Response): Promise<Response | void> => {
        const { email, password, deviceId } = req.body

        const context = buildRequestContext(req);

        const tk = await this.userService.login(email, password, context, deviceId);

        // Set secure cookie
        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        const responseData = this.createResponseDTO(tk.user, tk.refreshToken, tk.accessToken);

        return res.status(StatusCodes.OK).json({ user: responseData });
    })

    //HANDLES REFRESH TOKEN ROUTE
    private refreshToken = asyncWrapper(async (req: Request, res: Response): Promise<Response | void> => {
        const token = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!token) return res.status(StatusCodes.BAD_REQUEST).json({ message: "Refresh token is required" })

        const tk = await this.userService.refreshToken(token, buildRequestContext(req));

        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        return res.status(StatusCodes.OK).json({ user: tk });
    })

    //HANDLES LOGOUT ROUTE
    private logout = asyncWrapper(async (req: Request, res: Response) => {
        const token = req.cookies?.refreshToken || req.body?.refreshToken;
        const deviceId = req.body?.deviceId || "default-device";

        // 3️⃣ Ensure req.user exists (from requireAuth)
        const user = (req as any).user;
        const userId = user?._id?.toString() || null;
        const email = user?.email 

        const context = buildRequestContext(req);

        await this.userService.logout((req as any).user?._id.toString(), token, deviceId, context);

        clearRefreshCookie(res)

        res.status(200).send({ ok: true });
    })

    //HANDLES FORCE LOGOUT ALL ROUTE    
    private forceLogoutAll = asyncWrapper(async (req: Request, res: Response) => {
        const user = (req as any).user;
        console.log(user)
        const userId = user?._id?.toString() || null;
        const email = user?.email 
        console.log(userId, email)

        if (!user) return res.status(401).send({ error: "Unauthorized" });

        const context = buildRequestContext(req);
        
        await this.userService.logoutAll(userId, context);

        clearRefreshCookie(res)

        res.status(200).send({ ok: true });
    })
}



export default AuthController;
