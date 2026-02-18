import { Schema, model } from "mongoose";
import validator from "validator";

import User, { accountStatus, UserRole, IUserMethods, UserModel } from "./authinterface";
import { hashedPassword } from "@/config/password";

const userSchema = new Schema<User, UserModel, IUserMethods>({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        validate: {
            validator: function (this: any, value: string) {
                if (this.role === UserRole.SYSTEM) return true;
                return typeof value === "string" && value.length >= 8;
            },
            message: "Password must be at least 8 characters long",
        },
    },     
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function (this: any, value: string): boolean {
                if (this.role === UserRole.SYSTEM) return true;
                return validator.isEmail(value.trim());
            },
            message: "Please use a valid email address",
        },
        index: true

    },
    userId: {
        type: String,
        required: true,
        unique: true,
        immutable: true,
        index: true,
    },

    accountStatus: {
        type: String,
        enum: Object.values(accountStatus) as accountStatus[],
        default: accountStatus.PENDING_EMAIL_VERIFICATION,
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
    passwordChangedAt: {
        type: Date,
        default: null
    },
    passwordResetCount: {
        type: Number,
        default: 0
    },
    lastPasswordResetAt: {
        type: Date,
        default: null
    },
    passwordHistory: {
        type: [String],
        default: [],
        select: false
    }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret: any) => {
            delete ret.password;
            delete ret.__v;
            delete ret.passwordHistory;
            delete ret.mfaSecretEnc;
            return ret;
        }
    }
}
)

const MAX_PASSWORD_HISTORY = 5; // keep last 5 passwords

userSchema.pre<User>("save", async function () {
    // Only act if password is modified
    if (!this.isModified("password") || !this.password) return;

    // 1️⃣ Get current password from the DB (before modification)
    const currentPassword = this.isNew ? null : this.get("password");

    if (currentPassword) {
        this.passwordHistory = this.passwordHistory || [];
        this.passwordHistory.push(currentPassword);

        // Keep only last N entries
        if (this.passwordHistory.length > MAX_PASSWORD_HISTORY) {
            this.passwordHistory = this.passwordHistory.slice(-MAX_PASSWORD_HISTORY);
        }
    }

    // 2️⃣ Hash the new password
    this.password = await hashedPassword(this.password);

    // 3️⃣ Update passwordChangedAt timestamp
    this.passwordChangedAt = new Date();
});




export default model<User, UserModel>("User", userSchema)

function next(err: unknown): void | PromiseLike<void> {
    throw new Error("Function not implemented.");
}
