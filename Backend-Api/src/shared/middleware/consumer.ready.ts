// shared/middleware/consumer.ready.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { isTransferConsumerReady } from '@/kafka/consumer/transfer.consumer';
import { logger } from '@/shared/utils/logger';

// export function requireConsumerReady(req: Request, res: Response, next: NextFunction) {
//   if (!isTransferConsumerReady()) {
//     logger.warn('Transfer consumer not ready yet, rejecting request', {
//       path: req.path,
//     });
//     return res.status(503).json({
//       success: false,
//       message: 'Service temporarily unavailable — please retry in a few seconds',
//       retryAfter: 10,
//     });
//   }
//   next();
// }
export function requireConsumerReady(req: Request, res: Response, next: NextFunction) {
  const ready = isTransferConsumerReady();
  logger.info("Consumer ready check", { ready, path: req.path });

  if (!ready) {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable — please retry in a few seconds',
      retryAfter: 10,
    });
  }
  next();
}