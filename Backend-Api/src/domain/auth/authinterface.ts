import { Document } from "mongoose"

export enum UserRole {
    ADMIN = "ADMIN",
    USER = "USER"
}

export default interface User extends Document {
    email: string,
    password: string,
    name: string,
    isEmailVerified: Boolean,
    role: UserRole,
    mfaEnabled?: boolean,
    mfaSecretEnc?: string, // AES-GCM encrypted secret
    createdAt?: Date,
    updatedAt?: Date,

    comparePassword: (userPassword: string) => Promise<Boolean>
}
