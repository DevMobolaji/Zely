import { Schema, model } from "mongoose";
import validator from "validator";

import User from "./authinterface";
import { hashedPassword, verifyPassword } from "@/config/password";

const userSchema = new Schema<User> ({
    name: {
        type: String,
        required: true
    },
    // In your userSchema definition:
    password: {
        type: String,
        required: true,
        minlength: [8, "Password must be at least 8 characters long"],

        validate: {
            validator: function(v: string) {
                console.log(v)
                // Updated RegEx: 
                // 1. Lookaheads check for at least one of each class: Lowercase, Uppercase, Digit, and Special Symbol (including _).
                // 2. The final consuming group [] includes ALL allowed characters (letters, digits, and your specific symbols).
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*_])([A-Za-z\d!@#$%^&*_]){8,}$/.test(v);
            },
            message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 symbol.',
        },
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
        enum: ['USER', 'ADMIN', 'SUPPORT'],
        default: "USER"
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


//This method compares the password entered by the user to the hashed password stored in the DB
userSchema.methods.comparePassword = async function (password: string): Promise<Error | Boolean> {
    return await verifyPassword(password, this.password)
}

export default model<User>("User", userSchema)