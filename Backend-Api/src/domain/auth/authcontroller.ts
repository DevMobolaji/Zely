

import { Request, Response, NextFunction, Router } from "express"
import userService from "./authservice";
import asyncWrapper from "@/app/middleware/async.wrapper";
import Controller from "@/interfaces/controller.interfaces";
import { IRequestContext } from "@/interfaces/RequestContext";
import { StatusCodes } from "http-status-codes";
import { UserRole } from "./authinterface";
import validationSchema from "./authvalidation";
import validateRequest from "@/app/middleware/validation.middleware";

interface UserRegistrationResponse {
    userId: string;
    name: string;
    email: string;
    emailVerified: boolean;
    mfaEnabled: boolean;
    role: UserRole;
    refreshToken: string;
}


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
    }

    private createResponseDTO(user: any, refreshToken: string): UserRegistrationResponse {
        return {
            userId: user._id.toString(),
            name: user.name,
            email: user.email,
            emailVerified: user.isEmailVerified,
            mfaEnabled: user.mfaEnabled,
            role: user.role as UserRole,
            refreshToken: refreshToken
        }
    }

    private register = asyncWrapper(async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {

        const { email, password, name, deviceId } = req.body
        const requestId = (req as any).requestId;

        const context: IRequestContext = {
            requestId,
            ip: req.ip || '',
            userAgent: req.get("User-Agent") || '',
            email: email,
        };

        const tk = await this.userService.Register(
            name,
            email,
            password,
            context,
            deviceId
        );

        const responseData = this.createResponseDTO(tk.user, tk.Rfshtoken);

        res.status(StatusCodes.CREATED).json({ user: responseData });
    })

    private login = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
        const { email, password, deviceId } = req.body
        const requestId = (req as any).requestId;

        const context: IRequestContext = {
            requestId,
            ip: req.ip || '',
            userAgent: req.get("User-Agent") || '',
            email: email,
        };

        const tk = await this.userService.login(email, password, context, deviceId);
        const responseData = this.createResponseDTO(tk.user, tk.Rfshtoken);

        res.status(StatusCodes.OK).json({ user: responseData });
    }
}

export default AuthController;
