import { Schema, model } from "mongoose";
import validator from "validator";

import User, { UserRole } from "./authinterface";
import { hashedPassword, verifyPassword } from "@/config/password";
import PepperService from "@/config/pepper";

const userSchema = new Schema<User>({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true,
        minlength: [8, "Password must be at least 8 characters long"],
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: (v: string) => validator.isEmail(v, {}),
            message: 'Please use a valid email address',
        }

    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    mfaEnabled: {
        type: Boolean,
        default: false
    },
    mfaSecretEnc: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.USER
    },
    security: {
        failedLoginAttempts: {
            type: Number,
            default: 0
        },
        lockedUntil: {
            type: Date,
            default: null
        },
        lockReason: {
            type: String,
            default: null
        },
        lastFailedAt: {
            type: Date,
            default: null
        }
    },
      
}, { timestamps: true }
)

userSchema.pre("save", async function () {
    // `this` is the document being saved
    if (!this.isModified("password")) return;

    try {
        this.password = await hashedPassword(this.password);
    } catch (error) {
        // throw error to let Mongoose handle it
        throw error;
    }
});


userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
    return await verifyPassword(password, this.password)
}

export default model<User>("User", userSchema)