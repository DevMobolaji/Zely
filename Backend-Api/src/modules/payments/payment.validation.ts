// src/modules/payments/payment.validation.ts
import Joi from "joi";
import { PaymentPurpose } from "./payment.initialization.model";
import { config } from "@/config/index";

const initializePaymentSchema = Joi.object({
  amount: Joi.number()
    .integer()
    .min(config.payment.minAmount)
    .max(config.payment.maxAmount)
    .required(),
  currency: Joi.string()
    .length(3)
    .uppercase()
    .default("NGN"),
  purpose: Joi.string()
    .valid(...Object.values(PaymentPurpose))
    .required(),
  targetWalletId: Joi.string().required(),
  clientIdempotencyKey: Joi.string()
    .min(10)
    .max(100)
    .required(),
});

export default {
  initialize: initializePaymentSchema,
};