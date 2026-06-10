import Joi from "joi";

const createVaultSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).required().messages({
    "string.empty": "Title is required",
    "string.min": "Title must be at least 3 characters",
    "string.max": "Title must not exceed 120 characters",
  }),

  vaultType: Joi.string()
    .valid("FLEXIBLE", "LOCKED", "TARGET")
    .required()
    .messages({
      "any.only": "vaultType must be one of FLEXIBLE, LOCKED, TARGET",
      "any.required": "vaultType is required",
    }),

  targetAmountMinor: Joi.number().min(0).optional().messages({
    "number.base": "Target amount must be a number",
    "number.min": "Target amount must be at least 0",
  }),

  targetDeadline: Joi.date().iso().optional().messages({
    "date.base": "Target deadline must be a valid ISO date",
    "date.format": "Target deadline must be in ISO format",
  }),

  lockedUntil: Joi.date()
    .iso()
    .when("vaultType", {
      is: "LOCKED",
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "date.base": "lockedUntil must be a valid ISO date",
      "any.required": "lockedUntil is required for LOCKED vaults",
    }),

  penaltyBasisPoints: Joi.number().min(0).max(10000).optional().messages({
    "number.base": "penaltyBasisPoints must be a number",
    "number.min": "penaltyBasisPoints must be at least 0",
    "number.max": "penaltyBasisPoints must not exceed 10000 (100%)",
  }),

  autoSave: Joi.boolean().required().messages({
    "boolean.base": "AutoSave must be true or false",
  }),
}).options({ stripUnknown: true });

export default createVaultSchema;
