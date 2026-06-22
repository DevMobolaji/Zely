// fundingProcessor.evt.ts
import { EmailOutboxModel } from "@/kafka/emails/email.Outbox";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import User from "@/modules/auth/authmodel";
import { logger } from "@/shared/utils/logger";
import { ClientSession } from "mongoose";

export async function processFundingEvents(
  topic: string,
  envelope: RetryEnvelope,
  session: ClientSession,
) {
  const { event } = envelope;
  const { payload, version, eventType, eventId } = envelope.event as any;

  try {
    /** -------------------------
     * GUARDS
     * ------------------------- */
    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("funding.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    switch (eventType) {
      case "FUNDING_CREDITED": {
        const userPublicId = payload.targetUserPublicId ?? payload.userPublicId;

        const user = await User.findOne({ userId: userPublicId })
          .select("email name")
          .session(session)
          .lean();

        if (!user) {
          logger.warn("User not found for FUNDING_CREDITED email", {
            userPublicId: payload.userPublicId,
          });
          break;
        }

        await EmailOutboxModel.create(
          [
            {
              jobName: "fundingCredited",
              jobId: `${payload.transactionRef}_FUNDING_CREDITED`,
              eventId: eventId,
              paylaod: payload.transactionRef,
              aggregateType: "FUNDING",
              payload: {
                type: "CREDIT",
                email: user.email,
                name: user.name,
                amount: payload.amount,
                currency: payload.currency,
                currentBalance: payload.currentBalance,
                previousBalance: payload.previousBalance,
                transactionRef: payload.transactionRef,
                source: payload.source,
              },
              envelope,
            },
          ],
          { session },
        );

        logger.info("External transfer email written to outbox");

        break;
      }

      default:
        logger.warn("Unknown funding event type", {
          eventType: event.eventType,
        });
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(
      `[v${version}] External transfer event failed: ${err.message}`,
    );
  }
}
