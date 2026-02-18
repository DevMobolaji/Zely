import { Router, Response } from "express";
import Controller from "@/config/interfaces/controller.interfaces";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import SystemLedger, { FundUsersRequest } from "./system.ledger";

class FundController implements Controller {
  public path = "/fund";
  public route = Router();
  private fundService = new SystemLedger();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(`${this.path}/users`, this.fundUsers);
  }

  private fundUsers = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const { users } = req.body as FundUsersRequest; // Array<{ userId, amount }>
    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).send({ error: "Users array is required" });
    }
    console.log("Funding users", users)

    const result = await this.fundService.fundSystemLedger(users);
    console.log("Funded users", result)

    res.status(200).send({ ok: true, funded: result });
  });
}

export default FundController;
