import { kafka } from "./kafka.config";


export async function getKafkaHealthStatus() {
  const start = performance.now();
  const admin = kafka.admin();

  try {
    await admin.connect();

    // Check cluster info instead of just topics
    const clusterInfo = await admin.describeCluster();

    await admin.disconnect();

    return {
      healthy: true,
      connection: {
        isConnected: true,
        // brokers: clusterInfo.brokers.map((b: any) => `${b.host}:${b.port}`),
        // clusterId: clusterInfo.clusterId,
        // controller: clusterInfo.controller,
      },
      responseTimeMs: performance.now() - start,
      lastChecked: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      healthy: false,
      connection: {},
      responseTimeMs: performance.now() - start,
      lastChecked: new Date().toISOString(),
      extra: { error: err.message },
    };
  }
}
