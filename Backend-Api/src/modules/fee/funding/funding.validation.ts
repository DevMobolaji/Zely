import Joi from "joi";

const adminTopUpSchema = Joi.object({
  amount: Joi.number().integer().min(1).max(1_000_000_000).required(),  // up to ₦10M in kobo
  currency: Joi.string().length(3).uppercase().default("NGN"),
  reason: Joi.string().min(5).max(500).required(),
});

export default {
  adminTopUp: adminTopUpSchema,
};