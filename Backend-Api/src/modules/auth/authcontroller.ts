import { NextFunction, Request, Response, Router } from "express"
import userService from "./authservice";
import asyncWrapper from "shared/middleware/async.wrapper";
import Controller from "@/config/interfaces/controller.interfaces";
import { StatusCodes } from "http-status-codes";
import { UserRole } from "./authinterface";
import validationSchema from "./authvalidation";
import validateRequest from "shared/middleware/validation.middleware";
import { getRefreshCookieLifetimeMs, verifyRefreshToken } from "@/infrastructure/helpers/token.helper";
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
        this.route.post(`${this.path}/forgot-password`, validateRequest(validationSchema.forgotPassword, 'body'), this.forgotPassword);
        this.route.post(`${this.path}/confirm-reset-code`, validateRequest(validationSchema.verifyResetCode, 'body'), this.confirmResetCode);
        this.route.post(`${this.path}/reset-password`, this.resetPassword);
        this.route.post(`${this.path}/logout`, this.logout);
        this.route.post(`${this.path}/logout-all`, requireAuth, this.forceLogoutAll);
    }

    private createResponseDTO(userId: string, name: string, email: string, role: UserRole, emailVerified: boolean, refreshToken: string, accessToken?: string): UserRegistrationResponse {
        return {
            userId,
            name,
            email,
            emailVerified,
            role,
            accessToken,
            refreshToken,
        }
    }

    //HANDLES THE REGISTER ROUTE
    private register = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response | void> => {

        const { email, password, name } = req.body

        const context = getRequestContext(req);

        await this.userService.Register(name, email, password, context);

        res.status(StatusCodes.CREATED).json({ ok: true });
    })

    //HANDLES THE LOGIN ROUTE
    private login = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response | void> => {
        const { email, password } = req.body

        const context = getRequestContext(req);

        const tk = await this.userService.login(email, password, context);
        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        const responseData = this.createResponseDTO(tk.userId, tk.name, tk.email, tk.role, tk.isEmailVerified, tk.refreshToken, tk.accessToken);

        return res.status(StatusCodes.OK).json({ ok: true, user: responseData });
    })

    //HANDLES REFRESH TOKEN ROUTE
    private refreshToken = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response | void> => {
        const token = req.cookies?.refreshToken
        if (!token) return res.status(StatusCodes.BAD_REQUEST).json({ message: "Refresh token is required" })

        const tk = await this.userService.refreshToken(token, getRequestContext(req));
        console.log(getRequestContext(req))

        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        const userResponse = this.createResponseDTO(tk.userId, tk.name, tk.email, tk.role, tk.isEmailVerified, tk.refreshToken, tk.accessToken);

        return res.status(StatusCodes.OK).json({ ok: true,user: userResponse });
    })

    //HANDLES LOGOUT ROUTE
    private logout = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const cookie = req.cookies?.refreshToken;
        if (!cookie) return res.status(200).send({ ok: true });
        
        await this.userService.logout(cookie, getRequestContext(req));

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
        console.log(context)

        if (!context.userId) {
            return res.status(StatusCodes.UNAUTHORIZED).json({
                error: "User not authenticated"
            });
        }

        const user = await this.userService.getUser();

        res.status(200).send({ user });
    })

    private verify = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const { email, otp } = req.body;

        const context = getRequestContext(req);

        const tk = await this.userService.verifyEmail(email, otp, context);

        req.context = extractRequestContext(req);

        const responseData = this.createResponseDTO(tk.user.userId, tk.user.name, tk.user.email, tk.user.role, tk.user.isEmailVerified, tk.refreshToken, tk.accessToken);

        setRefreshCookie(res, tk.refreshToken, getRefreshCookieLifetimeMs());

        res.status(200).send({ ok: true, user: responseData });
    })

    private resendVerification = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const { email } = req.body;

        const context = getRequestContext(req);

        await this.userService.resendVerificationEmail(email, context);

        res.status(200).send({ ok: true });
    })

    private forgotPassword = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const { email } = req.body;

        const context = getRequestContext(req);

        const tk = await this.userService.requestPasswordReset(email, context);

        return res.status(StatusCodes.OK).json({ token: tk });
    })

    private confirmResetCode = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const { email, otp } = req.body;

        const ctx = getRequestContext(req);

        const response = await this.userService.verifyResetCode(email, otp, ctx);

        return res.status(StatusCodes.OK).json({ response: response });
    })

    private resetPassword = asyncWrapper(async (req: IAuthRequest, res: Response) => {
        const { email, token, newPassword, confirmPassword } = req.body;

        const context = getRequestContext(req);

        const response = await this.userService.resetPassword(email, token, newPassword, confirmPassword, context);

        return res.status(StatusCodes.OK).json({ response: response });
    })
}



export default AuthController;
