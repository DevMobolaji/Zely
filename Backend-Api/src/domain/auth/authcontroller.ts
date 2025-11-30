

import { Request, Response, NextFunction, Router } from "express"
import userService from "./authservice";
import asyncWrapper from "@/app/middleware/async.wrapper";
import Controller from "@/interfaces/controller.interfaces";
import { IRequestContext } from "@/interfaces/RequestContext";
import { StatusCodes } from "http-status-codes";



class AuthController implements Controller {
    public path = "/auth/V1";
    public route = Router();
    private userService = new userService();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.route.post(`${this.path}/register`, this.register);
        // this.route.post(`${this.path}/login`, this.login);
    }


    private register = asyncWrapper( async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {

        const { email, password, name } = req.body 
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
            context
        );

        const frtres = {
            name: tk.user.name,
            email: tk.user.email,
            emailVerified: tk.user.isEmailVerified,
            mfaEnabled: tk.user.mfaEnabled,
            role: tk.user.role,
            id: tk.user._id,

        }

        res.status(StatusCodes.CREATED).json({token: frtres});
    })

    // private login = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    //     const { email, password } = req.body
    //     const tk = await userService.login(email, password);

    //     res.status(200).json({token: tk});
    // }
}

export default AuthController;

