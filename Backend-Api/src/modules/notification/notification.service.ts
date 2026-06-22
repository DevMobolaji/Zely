import { logger } from "@/shared/utils/logger";
import { Notification, NotificationType } from "./notification.model";
import { socketRegistry } from "@/infrastructure/websockets/socket.registry";
import redis from "@/infrastructure/cache/redis.cli";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  amount?: number;
  currency?: string;
  referenceId?: string;
}

class NotificationService {
  // ─── Create and emit a notification ───────────────────────────────────────
  public async createAndEmit(params: CreateNotificationParams): Promise<void> {
    const { userId, type, title, message, amount, currency, referenceId } =
      params;

    try {
      // Save to MongoDB — idempotent on referenceId
      const notification = await Notification.findOneAndUpdate(
        { userId, referenceId: referenceId ?? null },
        {
          $setOnInsert: {
            userId,
            type,
            title,
            message,
            amount,
            currency,
            referenceId,
            read: false,
          },
        },
        { upsert: true, new: true },
      );

      // Invalidate unread count cache
      await redis.delete(`notifications:unread:${userId}`);

      // Emit to WebSocket — fire and forget
      socketRegistry.emitToUser(userId, "notification:new", {
        id: notification._id.toString(),
        type,
        title,
        message,
        amount,
        currency,
        occurredAt: notification.createdAt.toISOString(),
        read: false,
      });

      logger.info("Notification created and emitted", { userId, type, title });
    } catch (err: any) {
      // Never throw — notification failure must not break the parent flow
      logger.error("Failed to create notification", {
        userId,
        type,
        error: err.message,
      });
    }
  }

  // ─── Get user notifications ────────────────────────────────────────────────
  public async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.getUnreadCount(userId),
    ]);

    return {
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        amount: n.amount,
        currency: n.currency,
        read: n.read,
        occurredAt: n.createdAt.toISOString(),
      })),
      unreadCount,
      pagination: {
        page,
        limit,
        hasMore: notifications.length === limit,
      },
    };
  }

  // ─── Get unread count — Redis cached ──────────────────────────────────────
  public async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `notifications:unread:${userId}`;

    const cached = await redis.get<number>(cacheKey);
    if (cached !== null) return cached as number;

    const count = await Notification.countDocuments({ userId, read: false });
    await redis.set(cacheKey, count, 60); // cache for 60 seconds
    return count;
  }

  // ─── Mark all as read ─────────────────────────────────────────────────────
  public async markAllRead(userId: string): Promise<void> {
    await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    await redis.delete(`notifications:unread:${userId}`);
  }

  // ─── Mark one as read ─────────────────────────────────────────────────────
  public async markOneRead(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    await Notification.updateOne(
      { _id: notificationId, userId },
      { $set: { read: true, readAt: new Date() } },
    );
    await redis.delete(`notifications:unread:${userId}`);
  }

  public async deleteOne(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    await Notification.deleteOne({ _id: notificationId, userId });
  }

  public async deleteAll(userId: string): Promise<void> {
    await Notification.deleteMany({ userId });
    await redis.delete(`notifications:unread:${userId}`);
  }
}

export default NotificationService;
