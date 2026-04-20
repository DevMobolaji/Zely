import { Request, Response, NextFunction } from 'express';
import { httpRequestTotal, httpRequestDuration, httpErrorTotal } from '@/infrastructure/resilience/metrics';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // ✅ Skip BullBoard routes — they pollute metrics with static asset requests
  if (req.path.startsWith('/admin/queues')) {
    return next();
  }

  const start = Date.now();
  const route = req.route?.path ?? req.path;
  const method = req.method;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = String(res.statusCode);

    httpRequestTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);

    if (res.statusCode >= 400) {
      httpErrorTotal.inc({ method, route, status_code: statusCode });
    }
  });

  next();
}