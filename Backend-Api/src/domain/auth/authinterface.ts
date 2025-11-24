import { Document } from "mongoose"

export default interface User extends Document {
    email: string,
    password: string,
    name: string,
    isEmailVerified: Boolean,
    role: string,
    mfaEnabled?: boolean,
    mfaSecretEnc?: string, // AES-GCM encrypted secret
    createdAt?: Date,
    updatedAt?: Date,

    comparePassword: (userPassword: string) => Promise<Boolean>
}
