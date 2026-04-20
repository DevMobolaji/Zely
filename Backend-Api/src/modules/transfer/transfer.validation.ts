import Joi from 'joi';

export const InternalTransferSchema = Joi.object({
  toAccountNumber: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().uppercase().length(3).required(),
  idempotencyKey: Joi.string().required(),
});
