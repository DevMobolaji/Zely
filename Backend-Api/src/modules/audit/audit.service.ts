import { logger } from '@/shared/utils/logger';
import { AuditModel } from './audit.model';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditSeverity,
  AuditEvent,
  AuditAction,
  AuditStatus
} from './audit.interface';
import { IRequestContext } from '@/config/interfaces/request.interface';

class AuditLogger {
  private static readonly ATTEMPT_TRACKING_ACTIONS = [
    AuditAction.USER_REGISTER_ATTEMPT,
    AuditAction.USER_REGISTER_SUCCESS,
    AuditAction.USER_LOGIN_SUCCESS,
    AuditAction.USER_LOGIN_ATTEMPT,
    AuditAction.PASSWORD_RESET_ATTEMPT,
    AuditAction.USER_LOGOUT,
    AuditAction.USER_LOGOUT_ALL,
    AuditAction.REFRESH_TOKEN_ATTEMPT,
    AuditAction.REFRESH_TOKEN_SUCCESS,
    AuditAction.REFRESH_TOKEN_FAILURE,
  ];

  static async logEvent(event: AuditEvent): Promise<void> {
    const entry = {
      ...event,
      severity: event.severity || 'INFO' as AuditSeverity,
      requestId: event.requestId || uuidv4(),
      trackedEmail: event.trackedEmail || 'SYSTEM', // For non-user events
      createdAt: new Date(),
      lastAttempt: new Date(),
    };

    // Log to application logger (Winston)
    try {
      logger.info('AUDIT_EVENT', entry);
    } catch (err) {
      logger.error('Failed to write audit to app logger', err);
    }

    // Write to MongoDB
    try {
      await AuditModel.create(entry);
    } catch (err) {
      logger.error('AUDIT_DB_WRITE_FAILED', {
        error: (err as Error).message,
        entry
      });
    }

    // OPTIONAL: Send to Kafka for real-time processing
    // Uncomment when Kafka is ready

  }

  // context: IRequestContext,
  // params: {
  //   action: AuditAction | string;
  //   status?: AuditStatus;
  //   metadata?: Record<string, any>;
  //   severity?: AuditSeverity;
  //   userId?: string;
  // }


  static async logAttempt(
    context: IRequestContext,
    action: string | AuditAction,
    status: string = AuditStatus.PENDING,
    metadata: Record<string, any> = {},
    severity: AuditSeverity = 'INFO',
    userIdToLog?: string,
  ): Promise<void> {
    if (!context.email) {
      logger.warn('Cannot log attempt without email in context', { context });
      return;
    }

    const filter = {
      trackedEmail: context.email,
      action,
    };

    const previous = await AuditModel.findOne(filter);
    const initialStatus = previous ? previous.status : AuditStatus.PENDING;

    const update: any = {
      $set: {
        lastAttempt: new Date(),
        status,
        requestId: context.requestId || uuidv4(),
        ip: context.ip,
        userAgent: context.userAgent,
        userId: userIdToLog,
        initialStatus,
      },
      $setOnInsert: {
        createdAt: new Date(),
        severity,
      },
    };

    if (status === AuditStatus.FAILED) {
      update.$inc = { attemptCount: 1 };
    }

    if (status === AuditStatus.SUCCESS) {
      update.$set.attemptCount = 0;
    }    

    const options = { upsert: true, new: true };

    try {
      const doc = await AuditModel.findOneAndUpdate(filter, update, options);

      if (!doc) {
        logger.warn('AUDIT_LOGGED: Attempt upsert returned null', {
          filter,
          update,
        });
        return;
      }

      // Log via Winston for audit visibility
      logger.info(`AUDIT_LOGGED: ${action} - ${status}`, {
        auditedEmail: context.email,
        auditedUserId: userIdToLog,
        initialStatus: doc.initialStatus,
        latestStatus: doc.status,
        attemptCount: doc.attemptCount,
        requestId: doc.requestId,
      });

      // Check for suspicious activity
      await this.logSuspiciousActivity(doc);
    } catch (error) {
      logger.error('AUDIT_LOG_FAILED: Attempt upsert error', {
        error: (error as Error).message,
        filter,
        update,
      });
    }
  }

  static async logUserAction(
    context: IRequestContext,
    action: string | AuditAction,
    status: string | AuditStatus = AuditStatus.PENDING,
    userIdToLog: string | null = null,
    metadata: Record<string, any> = {},
    severity: AuditSeverity = 'INFO'
  ): Promise<void> {
    const entry: AuditEvent = {
      action,
      status,
      userId: userIdToLog,
      requestId: context.requestId || uuidv4(),
      ip: context.ip,
      userAgent: context.userAgent,
      trackedEmail: context.email || 'UNKNOWN',
      metadata,
      severity,
    };

    // Special handling for attempt tracking
    if (this.ATTEMPT_TRACKING_ACTIONS.includes(action as AuditAction)) {
      await this.logAttempt(context, action, status, metadata, severity, userIdToLog ?? undefined);
      return;
    }


    // Otherwise, log normally
    await this.logEvent(entry);
  }

  /**
   * NEW: Check for suspicious activity patterns
   * WHY: Automatic security monitoring
   */
  static async logSuspiciousActivity(auditDoc: any): Promise<void> {
    if (auditDoc.status !== AuditStatus.FAILED) return;

    const SUSPICIOUS_THRESHOLDS = new Set([5, 8, 10]);

    // Only log on threshold attempts
    if (!SUSPICIOUS_THRESHOLDS.has(auditDoc.attemptCount)) return;

    const filter = {
      trackedEmail: auditDoc.trackedEmail,
      action: AuditAction.SUSPICIOUS_ACTIVITY,
    };

    const update = {
      $set: {
        lastAttempt: new Date(),
        status: AuditStatus.BLOCKED,
        userId: auditDoc.userId,
        ip: auditDoc.ip,
        userAgent: auditDoc.userAgent,
        requestId: auditDoc.requestId,
        metadata: {
          reason: 'Multiple failed attempts',
          originalAction: auditDoc.action,
          attemptCount: auditDoc.attemptCount,
        },
      },
      $setOnInsert: {
        createdAt: new Date(),
        severity: 'CRITICAL',
      },
      $inc: { attemptCount: 1 }, // Initialize +1 on insert or increment on existing
    };

    try {
      const doc = await AuditModel.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
      });

      if (doc) {
        logger.warn('SUSPICIOUS_ACTIVITY logged', {
          email: auditDoc.trackedEmail,
          action: auditDoc.action,
          attemptCount: doc.attemptCount,
        });
      }
    } catch (error) {
      logger.error('AUDIT_LOG_FAILED: Suspicious activity upsert error', {
        error: (error as Error).message,
        filter,
        update,
      });
    }
  }
  
  /**
   * NEW: Get user's recent activity
   * WHY: Quick access to user's audit trail
   */
  static async getUserActivity(
    userId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      return await AuditModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      logger.error('Failed to get user activity', { userId, error });
      return [];
    }
  }

  /**
   * NEW: Get failed attempts for email
   * WHY: Rate limiting, security checks
   */
  static async getFailedAttempts(
    email: string,
    action: string | AuditAction,
    timeWindowMinutes: number = 15
  ): Promise<any | null> {
    try {
      const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

      return await AuditModel.findOne({
        trackedEmail: email,
        action,
        status: AuditStatus.FAILED,
        lastAttempt: { $gte: cutoffTime },
      });
    } catch (error) {
      logger.error('Failed to get failed attempts', { email, action, error });
      return null;
    }
  }

  /**
   * NEW: Check if user should be rate limited
   * WHY: Prevent brute force attacks
   */
  static async shouldRateLimit(
    email: string,
    action: string | AuditAction,
    maxAttempts: number = 5,
    timeWindowMinutes: number = 15
  ): Promise<{ limited: boolean; attemptCount: number; resetAt: Date | null }> {
    try {
      const failedAttempts = await this.getFailedAttempts(
        email,
        action,
        timeWindowMinutes
      );

      if (!failedAttempts) {
        return { limited: false, attemptCount: 0, resetAt: null };
      }

      const isLimited = failedAttempts.attemptCount >= maxAttempts;
      const resetAt = new Date(
        failedAttempts.lastAttempt.getTime() + timeWindowMinutes * 60 * 1000
      );

      return {
        limited: isLimited,
        attemptCount: failedAttempts.attemptCount,
        resetAt: isLimited ? resetAt : null,
      };
    } catch (error) {
      logger.error('Failed to check rate limit', { email, action, error });
      return { limited: false, attemptCount: 0, resetAt: null };
    }
  }
 

  /**
   * NEW: Get audit statistics
   * WHY: Dashboard, reporting, compliance
   */
  static async getStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const stats = await AuditModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] },
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
            },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      return stats;
    } catch (error) {
      logger.error('Failed to get audit statistics', { error });
      return [];
    }
  }
}

export default AuditLogger;