import { Document, model, Schema, Types } from "mongoose"


export interface idempotence extends Document {
  idempotencyKey: string,
  transaction: Types.ObjectId,
  status: string,
  response: Types.ObjectId,
  created: Date
}

const idempotenceSchema = new Schema({
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  transactionRef: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ["IN_PROGRESS", "COMPLETED"],
    required: true
  },
  response: {
    type: Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    expires: "7d"
  }
}, {
  strict: true,
  versionKey: false
}

)

export const extIdempotenceModel = model<idempotence>("extIdempotence", idempotenceSchema)