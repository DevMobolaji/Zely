import Joi from "joi";

const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*_])([A-Za-z\d!@#$%^&*_]){8,}$/;

const register = Joi.object({
    name: Joi.string().max(30).required().label("Name"),

    email: Joi.string().email().required().messages({
        'string.email': 'Please use a valid email address',
    }).label("Email").lowercase(),

    password: Joi.string()
        .min(8)
        .pattern(passwordComplexityRegex)
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long.',
            'object.regex': 'Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 symbol.',
            'string.pattern.base': 'Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 symbol.',
            'any.required': 'Password is required.',
        })
        .label("Password"),
})

export default { register }