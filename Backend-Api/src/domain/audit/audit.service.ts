import logger from '@/app/logging/logger';
import { AuditModel } from './audit.model';
import { IRequestContext } from '@/interfaces/RequestContext';
import { v4 as uuidv4 } from 'uuid';
import { AuditSeverity } from './audit.interface';


export type AuditEvent = {
  userId?: string | null;
  action: string;
  status?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity?: AuditSeverity;
  trackedEmail?: string;
};

class AuditLogger {
  /**
   * GenerIC AUDIT lOGGER (writes to DB + Winston)
   * For High scale production this Db should be moved to a queue system(KAFKA, BULLMQ)
   */
  static async logEvent(event: AuditEvent) {
    const entry = {
      ...event,
      severity: event.severity || "INFO",
      requestId: event.requestId || uuidv4(),
      createdAt: new Date(),
      lastAttempt: new Date(),
      ip: event.ip ?? 'UNKNOWN', 
      userAgent: event.userAgent ?? 'UNKNOWN', 
      trackedEmail: event.trackedEmail ?? 'N/A',
    };

    // Log to application logger
    try {
      logger.info(`AUDIT_EVENT: ${event.action} - ${event.status}`, entry);
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

  static async logRegistrationAttempt(
    context: IRequestContext,
    userIdToLog: string | null = null,
    status: string = "USER_REGISTER_ATTEMPT"
  ) {

    const requestId = context.requestId ?? uuidv4();
    const ip = context.ip ?? 'UNKNOWN_IP';
    const userAgent = context.userAgent ?? 'UNKNOWN_AGENT';

    const filter = {
      trackedEmail: context.email,
      action: "USER_REGISTER_ATTEMPT",
    };

    const previous = await AuditModel.findOne(filter);
    console.log(previous)
    const initialStatus = previous?.status || "USER_REGISTER_ATTEMPT";

    const update = {
      $inc: { attemptCount: 1 }, // increment attempt
      $set: {
        lastAttempt: new Date(),
        status, // latest status
        requestId,
        ip,
        userAgent,
        userId: userIdToLog,
        initialStatus
      },
      $setOnInsert: {
        createdAt: new Date(),
        severity: "WARN",
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

      if (status === "SUCCESS" && userIdToLog) {
          await this.logUserAction(context, "USER_CREATED", "COMPLETED", userIdToLog, { relatedRequestId: requestId }, "CRITICAL");
      }
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
    const requestId = context.requestId ?? uuidv4();
    const ip = context.ip ?? 'UNKNOWN_IP';
    const userAgent = context.userAgent ?? 'UNKNOWN_AGENT';


    const entry: AuditEvent = {
      action,
      status,
      userId: userIdToLog,
      requestId,
      ip,
      userAgent,
      metadata,
      severity,
      trackedEmail: context.email,
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
