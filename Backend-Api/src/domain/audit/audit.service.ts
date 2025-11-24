import { AuditModel } from './audit.model';
import { Request } from 'express';

export type AuditEvent = {
  userId?: string;
  action: string;
  status?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
};

class AuditLogger {
  private event: AuditEvent;

  constructor(event: AuditEvent) {
    this.event = event;
  }

  // Logs a single event to the database
  async log(): Promise<void> {
    try {
      await AuditModel.create({
        userId: this.event.userId,
        action: this.event.action,
        status: this.event.status,
        ip: this.event.ip,
        userAgent: this.event.userAgent,
        metadata: this.event.metadata,
      });
    } catch (error) {
      console.error('Audit log failed:', error);
    }
  }

  // Convenience static method
  static async logEvent(event: AuditEvent): Promise<void> {
    const logger = new AuditLogger(event);
    await logger.log();
  }

  // Specialized method for registration attempts
  static async logRegistrationAttempt(req: Request, status?: string): Promise<void> {
    await this.logEvent({
      userId: undefined, // no user yet during registration
      action: 'USER_REGISTER_ATTEMPT',
      status,
      ip: req.ip,
      userAgent: req.get('User-Agent') ?? undefined,
      metadata: {
        email: req.body?.email ?? undefined,
      },
    });
  }
}

export default AuditLogger;
