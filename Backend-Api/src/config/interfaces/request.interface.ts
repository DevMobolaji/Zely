
import { Request } from 'express';


export interface IRequestContext {
    requestId?: string;
    userId?: string | null;
    email?: string;
    ip: string;
    userAgent: string;
    deviceId?: string;
    deviceType?: 'mobile' | 'web' | 'tablet';
    country?: string;
    timestamp?: Date;
}


export interface JwtUser {
    sub?: string;           // user's MongoDB _id
    userId: string;        // user's public ID
    userPublicId?: string;  // user's public ID (alias)
    email: string;
    role: string;
    [key: string]: any;
}

export interface IAuthRequest extends Request {
    idempotencyKey?: string;
    deviceId?: string;
    user?: JwtUser;
    requestId?: string;
    context?: IRequestContext;
}

export interface IJWTPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number; // Issued at
    exp?: number; // Expiration
}

/**
 * Device Information
 */
export interface IDeviceInfo {
    deviceId: string;
    deviceType: 'mobile' | 'web' | 'tablet';
    deviceName?: string;
    osName?: string;
    osVersion?: string;
    appVersion?: string;
    browserName?: string;
    browserVersion?: string;
}