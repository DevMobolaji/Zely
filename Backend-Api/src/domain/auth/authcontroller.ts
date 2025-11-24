

import { Request, Response, NextFunction, Router } from "express"
import userService from "./authservice";
import asyncWrapper from "@/app/middleware/restmiddleware/async.wrapper";
import Controller from "@/interfaces/controller.interfaces";



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


    private register = asyncWrapper( async (req: Request, res: Response): Promise<Response | void> => {
        const { email, password, name, ip, userAgent } = req.body 
        const tk = await this.userService.Register(email, password, name, ip, userAgent);

        res.status(201).json({token: tk});
    })

    // private login = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    //     const { email, password } = req.body
    //     const tk = await userService.login(email, password);

    //     res.status(200).json({token: tk});
    // }
}

export default AuthController;