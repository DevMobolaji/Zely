import { Document, Model } from "mongoose"

export enum UserRole {
    ADMIN = "ADMIN",
    USER = "USER",
    SYSTEM = "SYSTEM"
}

export enum accountStatus {
    PENDING_EMAIL_VERIFICATION = "PENDING_EMAIL_VERIFICATION",
    EMAIL_VERIFIED = "EMAIL_VERIFIED",
    ACCOUNT_PROVISIONING = "ACCOUNT_PROVISIONING",
    ACCOUNT_READY = "ACCOUNT_READY",
    ACCOUNT_CLOSED = "ACCOUNT_CLOSED",
    ACTIVE = "ACTIVE"
}

export interface ISecurityState {
    failedLoginAttempts: number;
    lockedUntil?: Date | null;
    lockReason?: 'FAILED_ATTEMPTS' | null;
    lastFailedAt?: Date;
}

// Separate the document properties from methods
export interface IUserDocument {
    email: string;
    password: string;
    name: string;
    userId: string;
    accountStatus: accountStatus;
    isEmailVerified: boolean;
    role: UserRole;
    mfaEnabled?: boolean;
    passwordAttempts: number;
    mfaSecretEnc?: string; // AES-GCM encrypted secret
    createdAt?: Date;
    updatedAt?: Date;
    security: ISecurityState;
    passwordChangedAt?: Date | null;
    passwordResetCount?: number;
    lastPasswordResetAt?: Date | null;
    passwordHistory?: string[];
}

// Instance methods interface
export interface IUserMethods {
    comparePassword(userPassword: string): Promise<boolean>;
}

// Combined interface for the document with methods
export default interface User extends Document, IUserDocument, IUserMethods { }

// Model type
export interface UserModel extends Model<User, {}, IUserMethods> {
    userId: any;
    email: any;
    role: any;
    isEmailVerified: any;
}
