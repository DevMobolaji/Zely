import { Document } from "mongoose"

export enum UserRole {
    ADMIN = "ADMIN",
    USER = "USER"
}
export enum UserStatus {
    PENDING = "PENDING",
    VERIFIED = "VERIFIED"
}

export enum accountStatus {
    PENDING_EMAIL_VERIFICATION = "PENDING_EMAIL_VERIFICATION",
    EMAIL_VERIFIED = "EMAIL_VERIFIED", 
    ACCOUNT_PROVISIONING = "ACCOUNT_PROVISIONING",
    ACCOUNT_READY = "ACCOUNT_READY",
    ACCOUNT_CLOSED = "ACCOUNT_CLOSED"
  }

export interface ISecurityState {
    failedLoginAttempts: number;
    lockedUntil?: Date | null;
    lockReason?: 'FAILED_ATTEMPTS' | null;
    lastFailedAt?: Date;
}


export default interface User extends Document {
    email: string,
    password: string,
    name: string,
    userId: string,
    accountStatus: accountStatus,
    isEmailVerified: UserStatus,
    role: UserRole,
    mfaEnabled?: boolean,
    mfaSecretEnc?: string, // AES-GCM encrypted secret
    createdAt?: Date,
    updatedAt?: Date,
    security: ISecurityState

    comparePassword: (userPassword: string) => Promise<boolean>
}
