import { admin, connectAdmin, kafka } from "./kafka.config";
import { logger } from "@/shared/utils/logger";
import { TOPICS } from "./kafka.topics";
import { OutboxEvent } from "@/modules/audit/outbox.model";

const ROUTER_GROUP = "outbox-router";
const CDC_TOPIC = "outbox.zely_app.outboxevents";

const routerConsumer = kafka.consumer({ groupId: ROUTER_GROUP });
const routerProducer = kafka.producer();

const TOPIC_ROUTE_MAP: Record<string, string> = {
  [TOPICS.TRANSACTION_EVENTS]: TOPICS.TRANSACTION_EVENTS,
  [TOPICS.AUTH_EVENTS]: TOPICS.AUTH_EVENTS,
  [TOPICS.AUDIT_EVENTS]: TOPICS.AUDIT_EVENTS,
  [TOPICS.VAULT_EVENTS]: TOPICS.VAULT_EVENTS,
  [TOPICS.PASSWORD_EVENTS]: TOPICS.PASSWORD_EVENTS,
  [TOPICS.KYC_EVENTS]: TOPICS.KYC_EVENTS,
};

export async function runOutboxRouter() {
  await routerConsumer.connect();
  await routerProducer.connect();
  await connectAdmin();

  routerConsumer.on(routerConsumer.events.GROUP_JOIN, async () => {
    try {
      const committed = await admin.fetchOffsets({
        groupId: ROUTER_GROUP,
        topics: [CDC_TOPIC],
      });

      const hasNoCommits = committed.every((p: any) => p.offset === '-1');

      if (hasNoCommits) {
        logger.info('Outbox router: fresh group — seeking all partitions to latest');
        const topicOffsets = await admin.fetchTopicOffsets(CDC_TOPIC);
        for (const { partition, high } of topicOffsets) {
          routerConsumer.seek({ topic: CDC_TOPIC, partition, offset: high });
          logger.info(`Outbox router: seeked partition ${partition} to offset ${high}`);
        }
      } else {
        logger.info('Outbox router: existing group — using committed offsets');
      }
    } catch (err: any) {
      logger.error('Outbox router: GROUP_JOIN error', { error: err.message });
    }
  });

  await routerConsumer.subscribe({
    topic: CDC_TOPIC,
    fromBeginning: false,
  });

  logger.info("✅ Outbox router started");

  await routerConsumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }: any) => {
      if (!message.value) {
        await commitOffset(topic, partition, message.offset);
        return;
      }

      let cdcDoc: any;
      try {
        cdcDoc = JSON.parse(message.value.toString());

      } catch (e) {
        logger.error("Outbox router: failed to parse CDC message", { partition, offset: message.offset });
        await commitOffset(topic, partition, message.offset);
        return;
      }

      if (cdcDoc.status !== "PENDING") {
        logger.info("Outbox router: skipping non-PENDING");
        await commitOffset(topic, partition, message.offset);
        return;
      }

      const targetTopic = TOPIC_ROUTE_MAP[cdcDoc.topic];

      if (!targetTopic) {
        logger.warn("Outbox router: no route for topic");
        await commitOffset(topic, partition, message.offset);
        return;
      }


      await routerProducer.send({
        topic: targetTopic,
        messages: [
          {
            key: cdcDoc.aggregateId,
            value: JSON.stringify(cdcDoc),
          },
        ],
      });

      await OutboxEvent.updateOne(
        { eventId: cdcDoc.eventId, status: 'PENDING' },
        { $set: { status: 'SENT', sentAt: new Date() } }
      );

      logger.info("Outbox router: routed event", {
        from: CDC_TOPIC,
        to: targetTopic,
        eventId: cdcDoc.eventId,
      });

      await commitOffset(topic, partition, message.offset);
    },
  });
}

async function commitOffset(topic: string, partition: number, offset: string) {
  await routerConsumer.commitOffsets([{
    topic,
    partition,
    offset: (parseInt(offset) + 1).toString(),
  }]);
}

export async function stopOutboxRouter() {
  await Promise.race([
    Promise.all([
      routerConsumer.disconnect(),
      routerProducer.disconnect(),
    ]),
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ]);
  logger.info("✅ Outbox router disconnected");
}