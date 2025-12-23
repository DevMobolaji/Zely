import { z } from "zod";

export const UserEventSchema = z.object({
    email: z.string(),
    name: z.string(),
    role: z.string(),
    _id: z.string(),
    isEmailVerified: z.boolean(),
});

export type UserEvent = z.infer<typeof UserEventSchema>;
