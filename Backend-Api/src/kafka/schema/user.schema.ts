import { z } from "zod";

export const BaseEventSchema = z.object({
    // 🔑 identity
    eventId: z.string(),
    eventType: z.string().min(1),
    version: z.literal(1), // ⬅️ explicit version

    // 🧱 aggregate
    aggregateType: z.string().min(1),
    aggregateId: z.string().min(1),

    // 📌 semantics
    action: z.string(),
    status: z.enum(["PENDING", "PROCESSING", "PROCESSED", "FAILED"]),

    // 📦 data
    payload: z.unknown(),

    // 🧠 metadata
    context: z.object({
        requestId: z.string(),
        ip: z.string().optional(),
        userAgent: z.string().optional(),
        deviceId: z.string().optional(),
    }),

    occurredAt: z.string().datetime().optional(),
});


  


export const UserRegisterSuccessV1Schema = BaseEventSchema.extend({
    eventType: z.literal("USER_REGISTER_SUCCESS"),
    version: z.literal(1),
    aggregateType: z.literal("USER_REGISTER"),
    aggregateId: z.string(),
    eventId: z.string(),
    payload: z.object({
        userId: z.string().min(1),
        email: z.string().email().optional(),
    }),
});



// Auth Email Verify Success Event
export const AuthEmailVerifySuccessV1Schema = BaseEventSchema.extend({
    eventType: z.literal("USER_VERIFY_EMAIL_SUCCESS"),
    version: z.literal(1),
    aggregateType: z.literal("USER"),
    aggregateId: z.string(),
    eventId: z.string(),
    payload: z.object({
        userId: z.string().min(1),
        email: z.string().email().optional(),
        name: z.string().optional(),
    }),
});

// Auth Email Verify Success Event
export const resendVerificationEmailV1Schema = BaseEventSchema.extend({
    eventType: z.literal("PASSWORD_RESET_REQUESTED"),
    version: z.literal(1),
    aggregateType: z.literal("PASSWORD_RESET_REQUESTED"),
    aggregateId: z.string(),
    eventId: z.string(),
    payload: z.object({
        email: z.string().email().optional(),
        name: z.string().optional(),
        code: z.string().optional(),
        expiryMinutes: z.number().optional(),
    }),
});

export const verifyResetCodeV1Schema = BaseEventSchema.extend({
    eventType: z.literal("PASSWORD_RESET_CODE_VERIFIED"),
    version: z.literal(1),
    aggregateType: z.literal("PASSWORD_RESET_CODE_VERIFIED"),
    aggregateId: z.string(),
    eventId: z.string(),
    payload: z.object({
        email: z.string().email().optional(),
    }),
})

export const resetPasswordSuccessV1Schema = BaseEventSchema.extend({
    eventType: z.literal("PASSWORD_RESET_SUCCESS"),
    version: z.literal(1),
    aggregateType: z.literal("PASSWORD_RESET_SUCCESS"),
    aggregateId: z.string(),
    eventId: z.string(),
    payload: z.object({
        email: z.string().email().optional(),
        name: z.string().optional(),
    }),
})




// Union type for auth events
export const AuthEventSchema = z.union([UserRegisterSuccessV1Schema, AuthEmailVerifySuccessV1Schema, resendVerificationEmailV1Schema, verifyResetCodeV1Schema, resetPasswordSuccessV1Schema]);
export type AuthEvent = z.infer<typeof AuthEventSchema>;
