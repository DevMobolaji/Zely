import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import BadRequestError from 'infrastructure/errors/badRequest';

// Type for the location of the data to validate (e.g., req.body, req.query)
type ValidationSource = 'body' | 'query' | 'params';

/**
 * Higher-order function that creates a Joi validation middleware.
 * * @param schema The Joi schema object to validate against.
 * @param source The location in the request object to check ('body', 'query', or 'params').
 * @returns An Express middleware function.
 */
const validateRequest = (schema: Joi.ObjectSchema, source: ValidationSource) =>
    (req: Request, res: Response, next: NextFunction) => {

        // 1. Get the data based on the specified source
        const data = req[source];

        // 2. Perform the validation
        const { error, value } = schema.validate(data, {
            abortEarly: false, // Report all errors, not just the first one
            allowUnknown: true, // Allow unknown fields (e.g., req.headers), but only process known ones
            stripUnknown: true, // Remove unknown fields from the validated output
        });

        // 3. Handle Validation Error
        if (error) {
            // Map the Joi errors into a readable array for the client/logger
            const errorMessage = error.details.map(detail => detail.message).join(', ');

            // Use a standard application error class for consistent error handling
            // This is a much better practice than sending raw Joi errors.
            const validationError = new BadRequestError(`Validation failed: ${errorMessage}`);

            // Pass the error to the Express error handler
            return next(validationError);
        }

        // 4. Update Request Body/Query/Params with Cleaned Data
        // This is important because Joi has cleaned (stripped unknown fields) and cast the data.
        req[source] = value;

        // 5. Proceed to the Controller/Next Middleware
        next();
    };

export default validateRequest;