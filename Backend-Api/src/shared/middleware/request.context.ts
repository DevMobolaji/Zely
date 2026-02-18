import { Response, NextFunction } from 'express';
import { IAuthRequest, IRequestContext } from '@/config/interfaces/request.interface';
import { generateDeviceId, validateTimestampedId } from '../utils/id.generator';
import BadRequestError from '../errors/badRequest';

export function extractRequestContext(req: IAuthRequest): IRequestContext {
    return {
        requestId: req.requestId,
        userId: req.user?.userId || null,
        email: req.user?.email || req.body?.email || undefined,
        ip: getClientIp(req),
        userAgent: req.get('user-agent') || 'UNKNOWN_AGENT',
        deviceId: req.cookies.deviceId,
        deviceType: getDeviceType(req.get('user-agent')),
        timestamp: new Date(),
    };
}


export function attachRequestContext(
    req: IAuthRequest,
    res: Response,
    next: NextFunction
): void {
    if (!req.requestId) {
        throw new Error('requestId missing. attachRequestId middleware must run first.');
    }

    req.context = extractRequestContext(req);
    next();
}


function getClientIp(req: IAuthRequest): string {
    const forwarded = req.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    const realIp = req.get('x-real-ip');
    if (realIp) {
        return realIp;
    }

    return req.ip || 'UNKNOWN_IP';
}

/**
 * NOTE: This is basic detection. For production, consider:
 * - ua-parser-js library
 * - device-detector-js library
 */
function getDeviceType(userAgent?: string): 'mobile' | 'web' | 'tablet' | undefined {
    if (!userAgent) {
        return undefined;
    }

    const ua = userAgent.toLowerCase();

    // Check for tablet
    if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
        return 'tablet';
    }

    // Check for mobile
    if (
        ua.includes('mobile') ||
        ua.includes('android') ||
        ua.includes('iphone') ||
        ua.includes('ipod')
    ) {
        return 'mobile';
    }

    // Default to web
    return 'web';
}

/**
 * Middleware to validate device ID
 * WHY: Ensure device tracking is working
 */



export function requireDeviceId(
    req: IAuthRequest,
    res: Response,
    next: NextFunction
): void {
    const deviceId = req.get('x-device-id');

    if (!deviceId) {
        res.status(400).json({
            success: false,
            message: 'Device ID is required',
            hint: 'Include X-Device-ID header with your request',
        });
        return;
    }

    next();
}

export function deviceMiddleware(req: IAuthRequest, res: Response, next: NextFunction) {
    let deviceId = req.cookies?.deviceId;

    if (!deviceId) {
        deviceId = generateDeviceId();  
        res.cookie('deviceId', deviceId, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 1000 * 60 * 60 * 24 * 365
        });
    }

    req.deviceId = deviceId;
    next();
}
  

export function getRequestContext(req: IAuthRequest): IRequestContext {
    // Return existing context or extract new one
    if (!req.context) {
        throw new Error('Request context not initialized. Did you forget attachRequestContext middleware?');
    }
    return req.context; 
}

export function getIdempotencyKey(req: IAuthRequest): string | undefined {
    const idempotency = req.headers['idempotency-key'] as string
    if (!idempotency) {
        throw new BadRequestError('Request IdempotencyKey not initialized');
    }

    if (!validateTimestampedId(idempotency)) {
        throw new BadRequestError("Invalid Idempotency-Key format");
      }
    return idempotency
}