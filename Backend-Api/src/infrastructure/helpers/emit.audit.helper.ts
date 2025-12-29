import { AuditOutboxModel } from "@/modules/audit/auditOutbox.model";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { auditOutboxQueue } from "@/infrastructure/queues/auditOutbox.queue";
import { IRequestContext } from "@/config/interfaces/request.interface";

const emitAuditEvent = async({ eventType, action, status, userId, context, reason }: {
  eventType: string;
  action: AuditAction;
  status: AuditStatus;
  userId?: string;
  context: IRequestContext;
  reason?: string
}) => {
  const [outboxDoc] = await AuditOutboxModel.create(
    [
      {
        eventType: eventType,
        action: action,
        status: status,
        userId: userId,
        context,
        reason,
        occurredAt: new Date()
      }
    ]
  );

  await auditOutboxQueue.add(
    "publish-audit-event",
    { outboxId: outboxDoc._id.toString() }
  );
}

export default emitAuditEvent


