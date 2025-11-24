import { Schema, model} from "mongoose";
import validator from "validator";

import User from "./authinterface";
import { verifyPassword } from "@/config/password";

const userSchema = new Schema<User> ({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true,
        minlength: [6, "Password must be at least 6 characters long"],
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
          validator: (v: string) => validator.isEmail(v),
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
        enum: ['USER', 'ADMIN', 'SUPPORT'],
        default: "USER"
    },
}, { timestamps: true }
)

    
//This method compares the password entered by the user to the hashed password stored in the DB
userSchema.methods.comparePassword = async function (password: string): Promise<Error | Boolean> {
    return await verifyPassword(password, this.password)
}

export default model<User>("User", userSchema)