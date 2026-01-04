import { z } from "zod";

export const BaseEventSchema = z.object({
    eventId: z.string().uuid(),
    eventType: z.string().min(1),

    aggregateType: z.string().min(1),
    aggregateId: z.string().min(1),

    action: z.string(),
    status: z.enum(["SUCCESS", "FAILED"]),

    payload: z.record(z.string(), z.unknown()),

    context: z.object({
        requestId: z.string(),
        ip: z.string().optional(),
        userAgent: z.string().optional(),
        actorId: z.string().optional(),
    }),

    occurredAt: z.date().or(z.string().datetime()).optional(),
});


export const UserRegisterSuccessEventSchema = BaseEventSchema.extend({
    eventType: z.literal("AUTH_USER_REGISTER_SUCCESS"),
    aggregateType: z.literal("USER_REGISTER"),

    payload: z.object({
        userId: z.string().min(1),
    }),
});