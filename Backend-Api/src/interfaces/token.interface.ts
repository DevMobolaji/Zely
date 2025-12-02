import { Schema } from "mongoose";

export interface Token extends Schema {
    userId: string;
    token: Schema.Types.ObjectId;
    type: string;
    expiresAt: Schema.Types.ObjectId;
}