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

const login = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please use a valid email address',
    }).label("Email").lowercase(),
    password: Joi.string().required().label("Password"),
})

const verifyEmail = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please use a valid email address',
    }).label("Email").lowercase(),
    otp: Joi.string().required().label("OTP"),
})

const resendVerification = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please use a valid email address',
    }).label("Email").lowercase(),
})

const forgotPassword = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please use a valid email address',
    }).label("Email").lowercase(),
})

const verifyResetCode = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please use a valid email address',
    }).label("Email").lowercase(),
    otp: Joi.string().required().label("valid 6 digit code is required"),
})

const resetPassword = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please use a valid email address',
    }).label("Email").lowercase(),
    token: Joi.string().required().trim().label("Reset Token is required"),
    newPassword: Joi.string().required().length(8).label('Password must be at least 8 characters'),
    confirmPassword: Joi.string().required().label("Confirm Password is required"),
})


export default { register, login, verifyResetCode, resetPassword, verifyEmail, resendVerification, forgotPassword }