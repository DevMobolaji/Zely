import Joi from "joi";

const unfreezeSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required(),
  verifyReconciliation: Joi.boolean().default(true),
});

export default {
  unfreeze: unfreezeSchema,
};