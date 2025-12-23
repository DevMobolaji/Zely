import { Document } from "mongoose"

export enum UserRole {
    ADMIN = "ADMIN",
    USER = "USER"
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
    isEmailVerified: boolean,
    role: UserRole,
    mfaEnabled?: boolean,
    mfaSecretEnc?: string, // AES-GCM encrypted secret
    createdAt?: Date,
    updatedAt?: Date,
    security: ISecurityState

    comparePassword: (userPassword: string) => Promise<boolean>
}
