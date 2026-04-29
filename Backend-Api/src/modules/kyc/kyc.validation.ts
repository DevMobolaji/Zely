// src/modules/kyc/kyc.validation.ts
import Joi from "joi";
import { GovernmentIdType } from "./kyc.model";

const tier2Schema = Joi.object({
  bvn: Joi.string().length(11).pattern(/^\d+$/).required().messages({
    "string.length": "BVN must be exactly 11 digits",
    "string.pattern.base": "BVN must contain only digits",
  }),
  nin: Joi.string().length(11).pattern(/^\d+$/).required().messages({
    "string.length": "NIN must be exactly 11 digits",
    "string.pattern.base": "NIN must contain only digits",
  }),
  dateOfBirth: Joi.date().iso().less("now").required(),
  governmentId: Joi.object({
    type: Joi.string().valid(...Object.values(GovernmentIdType)).required(),
    number: Joi.string().min(3).max(50).required(),
    documentUrl: Joi.string().uri().required(),
  }).required(),
  address: Joi.object({
    street: Joi.string().min(3).max(200).required(),
    city: Joi.string().min(2).max(100).required(),
    state: Joi.string().min(2).max(100).required(),
    country: Joi.string().length(2).default("NG"),
    proofOfAddressUrl: Joi.string().uri().required(),
  }).required(),
});

const tier3Schema = Joi.object({
  selfieUrl: Joi.string().uri().required(),
  livenessVideoUrl: Joi.string().uri().required(),
});

const adminRejectSchema = Joi.object({
  reason: Joi.string().min(5).max(500).required(),
});

export default {
  submitTier2: tier2Schema,
  submitTier3: tier3Schema,
  adminReject: adminRejectSchema,
};