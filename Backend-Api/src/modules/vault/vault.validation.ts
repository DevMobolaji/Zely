import Joi from "joi";

const createVaultSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(3)
    .max(120)
    .required()
    .messages({
      "string.empty": "Title is required",
      "string.min": "Title must be at least 3 characters",
      "string.max": "Title must not exceed 120 characters",
    }),

  targetAmountMinor: Joi.number()
    .min(0)
    .optional()
    .messages({
      "number.base": "Target amount must be a number",
      "number.min": "Target amount must be at least 0",
    }),

  targetDeadline: Joi.date()
    .iso()
    .optional()
    .messages({
      "date.base": "Target deadline must be a valid ISO date",
      "date.format": "Target deadline must be in ISO format",
    }),

  autoSave: Joi.boolean()
    .required()
    .messages({
      "boolean.base": "AutoSave must be true or false",
    }),
})
  .options({ stripUnknown: true }); // removes unexpected fields

export default createVaultSchema;
