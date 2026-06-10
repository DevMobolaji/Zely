import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import { requireAuth } from "@/shared/middleware/auth.middleware";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { Response, Router } from "express";
import NotificationService from "./notification.service";

class NotificationController implements Controller {
  public path = "/notification";
  public route = Router();
  private notificationService = new NotificationService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.get(`${this.path}/`, requireAuth, this.getNotifications);

    this.route.patch(`${this.path}/read`, requireAuth, this.markAllRead);

    this.route.patch(`${this.path}/:id/read`, requireAuth, this.markOneRead);

    this.route.delete(`${this.path}/:id`, requireAuth, this.deleteOne);

    this.route.delete(`${this.path}/`, requireAuth, this.deleteAll);
  }

  private getNotifications = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response> => {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.notificationService.getNotifications(
        userId,
        page,
        limit,
      );
      return res.status(200).json({ ok: true, ...result });
    },
  );

  public markAllRead = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response> => {
      const userId = req.user!.userId;
      await this.notificationService.markAllRead(userId);
      return res.status(200).json({ ok: true });
    },
  );

  public markOneRead = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response> => {
      const userId = req.user!.userId;
      const { id } = req.params;
      await this.notificationService.markOneRead(userId, id);
      return res.status(200).json({ ok: true });
    },
  );

  public deleteOne = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response> => {
      const userId = req.user!.userId;
      const { id } = req.params;
      await this.notificationService.deleteOne(userId, id);
      return res.status(200).json({ ok: true });
    },
  );

  public deleteAll = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response> => {
      const userId = req.user!.userId;
      await this.notificationService.deleteAll(userId);
      return res.status(200).json({ ok: true });
    },
  );
}

export default NotificationController;
