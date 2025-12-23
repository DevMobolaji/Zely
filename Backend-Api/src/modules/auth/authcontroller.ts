import { Request, Response, NextFunction, Router } from "express"
import userService from "./authservice";
import asyncWrapper from "shared/middleware/async.wrapper";
import Controller from "@/config/interfaces/controller.interfaces";
import { StatusCodes } from "http-status-codes";
import { UserRole } from "./authinterface";
import validationSchema from "./authvalidation";
import validateRequest from "shared/middleware/validation.middleware";
import User from "./authinterface";
import { getRefreshCookieLifetimeMs } from "infrastructure/lib/token.helper";
import { clearRefreshCookie, setRefreshCookie } from "infrastructure/lib/cookie.helper";
import { extractRequestContext, getRequestContext } from "@/shared/middleware/request.context";
import { UserRegistrationResponse } from "@/config/interfaces/userResponse.interface";
import { requireAuth } from "shared/middleware/auth.middleware";
import { IAuthRequest } from "@/config/interfaces/request.interface";



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
        this.route.get(`${this.path}/me`, requireAuth, this.getUserById);
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
    private register = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response | void> => {

        const { email, password, name, deviceId } = req.body

        const context = getRequestContext(req);

        const tk = await this.userService.Register(name, email, password, context, deviceId);
        req.context = extractRequestContext(req);

        const responseData = this.createResponseDTO(tk.user, tk.refreshToken, tk.accessToken);
        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        res.status(StatusCodes.CREATED).json({ user: responseData });
    })

    //HANDLES THE LOGIN ROUTE
    private login = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response | void> => {
        const { email, password } = req.body

        const context = getRequestContext(req);

        const tk = await this.userService.login(email, password, context);

        req.user = {
            userId: tk.user._id.toString(),
            email: tk.user.email,
            role: tk.user.role
        };

        req.context = extractRequestContext(req);
        // Set secure cookie
        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        const responseData = this.createResponseDTO(tk.user, tk.refreshToken, tk.accessToken);

        return res.status(StatusCodes.OK).json({ user: responseData });
    })

    //HANDLES REFRESH TOKEN ROUTE
    private refreshToken = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response | void> => {
        const token = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!token) return res.status(StatusCodes.BAD_REQUEST).json({ message: "Refresh token is required" })

        const tk = await this.userService.refreshToken(token, getRequestContext(req));

        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        return res.status(StatusCodes.OK).json({ user: tk });
    })

    //HANDLES LOGOUT ROUTE
    private logout = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const token = req.cookies?.refreshToken || req.body?.refreshToken;
        const deviceId = req.body?.deviceId || "default-device";

        const context = getRequestContext(req);

        await this.userService.logout((req as any).user?._id.toString(), token, deviceId, context);

        clearRefreshCookie(res)

        res.status(200).send({ ok: true });
    })

    //HANDLES FORCE LOGOUT ALL ROUTE    
    private forceLogoutAll = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const user = (req as any).user;
        const userId = user?._id?.toString() || null;
        const email = user?.email
        if (!user) return res.status(401).send({ error: "Unauthorized" });

        const context = getRequestContext(req);

        await this.userService.logoutAll(userId, context);

        clearRefreshCookie(res)

        res.status(200).send({ ok: true });
    })

    private getUserById = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const context = getRequestContext(req);
        console.log(context)

        if (!context.userId) {
            return res.status(StatusCodes.UNAUTHORIZED).json({
                error: "User not authenticated"
            });
        }

        const user = await this.userService.getUserById();

        res.status(200).send({ user });
    })
}



export default AuthController;
