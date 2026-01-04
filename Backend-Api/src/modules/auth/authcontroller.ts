import { Response, Router } from "express"
import userService from "./authservice";
import asyncWrapper from "shared/middleware/async.wrapper";
import Controller from "@/config/interfaces/controller.interfaces";
import { StatusCodes } from "http-status-codes";
import { UserRole } from "./authinterface";
import validationSchema from "./authvalidation";
import validateRequest from "shared/middleware/validation.middleware";
import User from "./authinterface";
import { getRefreshCookieLifetimeMs } from "@/infrastructure/helpers/token.helper";
import { clearRefreshCookie, setRefreshCookie } from "@/infrastructure/helpers/cookie.helper";
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
        this.route.post(`${this.path}/verify`, validateRequest(validationSchema.verifyEmail, 'body'), this.verify);
        this.route.post(`${this.path}/resend-verification`, validateRequest(validationSchema.resendVerification, 'body'), this.resendVerification);
        this.route.post(`${this.path}/login`, validateRequest(validationSchema.login, 'body'), this.login);
        this.route.get(`${this.path}/me`, requireAuth, this.getUserById);
        this.route.post(`${this.path}/refresh-token`, this.refreshToken);
        this.route.post(`${this.path}/logout`, requireAuth, this.logout);
        this.route.post(`${this.path}/logout-all`, requireAuth, this.forceLogoutAll);
    }

    private createResponseDTO(user: User, refreshToken: string, accessToken?: string): UserRegistrationResponse {
        if (!user) {
            throw new Error("User not found");
        }
        return {
            userId: user.userId,
            name: user.name,
            email: user.email,
            emailVerified: user.isEmailVerified,
            mfaEnabled: user.mfaEnabled || false,
            role: user.role as UserRole,
            accessToken: accessToken,
            refreshToken: refreshToken,
        }
    }

    //HANDLES THE REGISTER ROUTE
    private register = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response | void> => {

        const { email, password, name } = req.body

        const context = getRequestContext(req);

        const tk = await this.userService.Register(name, email, password, context);
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

        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        const responseData = this.createResponseDTO(tk.user, tk.refreshToken, tk.accessToken);

        return res.status(StatusCodes.OK).json({ user: responseData });
    })

    //HANDLES REFRESH TOKEN ROUTE
    private refreshToken = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response | void> => {
        const token = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!token) return res.status(StatusCodes.BAD_REQUEST).json({ message: "Refresh token is required" })

        const tk = await this.userService.refreshToken(token, getRequestContext(req));

        req.context = extractRequestContext(req);

        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        return res.status(StatusCodes.OK).json({ user: tk });
    })

    //HANDLES LOGOUT ROUTE
    private logout = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const deviceId = req.context?.deviceId;

        const context = getRequestContext(req);

        const sub = req.user?.sub;

        await this.userService.logout(sub, deviceId, context);

        clearRefreshCookie(res)

        res.status(200).send({ ok: true });
    })

    //HANDLES FORCE LOGOUT ALL ROUTE    
    private forceLogoutAll = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const sub = (req as any).user?.sub;

        if (!sub) return res.status(401).send({ error: "Unauthorized" });

        const context = getRequestContext(req);

        await this.userService.logoutAll(sub, context);

        clearRefreshCookie(res)

        res.status(200).send({ ok: true });
    })

    private getUserById = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const context = getRequestContext(req);

        if (!context.userId) {
            return res.status(StatusCodes.UNAUTHORIZED).json({
                error: "User not authenticated"
            });
        }

        const user = await this.userService.getUserById();

        res.status(200).send({ user });
    })

    private verify = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const { email, otp } = req.body;

        const context = getRequestContext(req);

        await this.userService.verifyEmail(email, otp, context);

        res.status(200).send({ ok: true });
    })

    private resendVerification = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const { email } = req.body;

        const context = getRequestContext(req);

        await this.userService.resendVerificationEmail(email, context);

        res.status(200).send({ ok: true });
    })
}



export default AuthController;
