import logger from '@/app/logging/logger';
import { AuditModel } from './audit.model';
import { IRequestContext } from '@/interfaces/RequestContext';
import { v4 as uuidv4 } from 'uuid';

type AuditSeverity = "INFO" | "WARN" | "CRITICAL";

export type AuditEvent = {
  userId?: string | null;
  action: string;
  status?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity?: AuditSeverity;
};

class AuditLogger {
  /**
   * Generic audit event logger (writes to DB + Winston)
   */
  static async logEvent(event: AuditEvent) {
    const entry = {
      ...event,
      severity: event.severity || "INFO",
      requestId: event.requestId || uuidv4(),
      createdAt: new Date(),
      lastAttempt: new Date(),
    };

    // Log to application logger
    try {
      logger.info("AUDIT_EVENT", entry);
    } catch (err) {
      logger.error("Failed to write audit to app logger", err);
    }

    // Write to MongoDB
    try {
      await AuditModel.create(entry);
    } catch (err) {
      logger.error("AUDIT_DB_WRITE_FAILED", { error: (err as Error).message, entry });
    }
  }

  /**
   * Specialized method for user registration attempts.
   * Tracks attempt count, first status, latest status, and context info.
   */
  static async logRegistrationAttempt(
    context: IRequestContext,
    userIdToLog: string | null = null,
    status: string = "PENDING"
  ) {
    const filter = {
      trackedEmail: context.email,
      action: "USER_REGISTER_ATTEMPT",
    };

    const update = {
      $inc: { attemptCount: 1 }, // increment attempt 
      $set: {
        lastAttempt: new Date(),
        status, // latest status
        requestId: context.requestId || uuidv4(),
        ip: context.ip,
        userAgent: context.userAgent,
        userId: userIdToLog,
      },
      $setOnInsert: {
        createdAt: new Date(),
        severity: "WARN",
        initialStatus: status, // store first attempt status
      },
    };

    const options = { upsert: true, new: true };

    try {
      const doc = await AuditModel.findOneAndUpdate(filter, update, options);
      if (!doc) {
        logger.warn('AUDIT_LOGGED: Registration upsert returned null', {
          filter,
          update,
        });
        return;
      }

      // Log via Winston for audit visibility
      logger.info(`AUDIT_LOGGED: USER_REGISTER_ATTEMPT - ${status} - `, {
        auditedEmail: context.email,
        auditedUserId: userIdToLog,
        initialStatus: doc.initialStatus,
        latestStatus: doc.status,
        attemptCount: doc.attemptCount,
        requestId: doc.requestId,
      });
    } catch (error) {
      logger.error('AUDIT_LOG_FAILED: Registration upsert error', {
        error: (error as Error).message,
        filter,
        update,
      });
    }
  }

  /**
   * Example: unified method for any user-related action
   * You can call this for USER_CREATED, PASSWORD_RESET, LOGIN_ATTEMPT, etc.
   */
  static async logUserAction(
    context: IRequestContext,
    action: string,
    status: string = "PENDING",
    userIdToLog: string | null = null,
    metadata: Record<string, any> = {},
    severity: AuditSeverity = "INFO"
  ) {
    const entry: AuditEvent = {
      action,
      status,
      userId: userIdToLog,
      requestId: context.requestId || uuidv4(),
      ip: context.ip,
      userAgent: context.userAgent,
      metadata,
      severity,
    };

    // Special handling for registration attempts to track attemptCount
    if (action === "USER_REGISTER_ATTEMPT") {
      await this.logRegistrationAttempt(context, userIdToLog, status);
      return;
    }

    // Otherwise, log normally
    await this.logEvent(entry);
  }
}

export default AuditLogger;
