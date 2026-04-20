// src/database/validators/ledgerEntry.validator.ts

export const ledgerEntryValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "transactionId",
      "transactionRef",
      "ledgerAccountId",
      "type",
      "ledgerId",
      "amount",
      "currency",
      "referenceId",
      "referenceType",
      "createdAt"
    ],
    additionalProperties: false,

    properties: {
      transactionId: {
        bsonType: "objectId"
      },

      transactionRef: {
        bsonType: "string"
      },

      ledgerAccountId: {
        bsonType: "objectId"
      },

      type: {
        enum: ["DEBIT", "CREDIT"]
      },

      ledgerId: {
        bsonType: "string"
      },

      amount: {
        bsonType: "number",
        minimum: 0.01   // money amounts must be > 0
      },

      currency: {
        bsonType: "string",
        minLength: 3,
        maxLength: 3
      },

      referenceId: {
        bsonType: "string"
      },

      referenceType: {
        enum: [
          "INTERNAL_TRANSFER",
          "DEPOSIT",
          "ADJUSTMENT",
          "DEBIT"
        ]
      },

      createdAt: {
        bsonType: "date"
      }
    }
  }
}
