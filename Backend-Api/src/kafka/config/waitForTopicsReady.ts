import { Kafka } from 'kafkajs';

export async function waitForTopicsReady(
  kafka: InstanceType<typeof Kafka>,
  topics: string[],
  timeoutMs = 10000,
  pollInterval = 500
): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();

  const start = Date.now();

  while (true) {
    const metadata = await admin.fetchTopicMetadata({ topics });

    // Check if all topics have at least one partition with a leader
    const allReady = metadata.topics.every((topic: any) =>
      topic.partitions.every((p: any) => p.leader !== -1)
    );

    if (allReady) {
      break;
    }

    if (Date.now() - start > timeoutMs) {
      await admin.disconnect();
      throw new Error(`Kafka topics not ready after ${timeoutMs}ms: ${topics.join(', ')}`);
    }

    await new Promise(res => setTimeout(res, pollInterval));
  }

  await admin.disconnect();
}
