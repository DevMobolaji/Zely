import { Request, Response, NextFunction } from "express";
import { StatusCodes } from 'http-status-codes';
// Assuming you have a file path to your custom error definitions
import HttpException, { ErrorOutput } from "infrastructure/errors/customAPIError";
import { logger } from "../utils/logger";


type CustomErrorStructure = {
    statusCode: number;
    message: string;
    errors: ErrorOutput[];
}


async function ErrorMiddleware(
    error: any,
    req: Request,
    res: Response,
    _next: NextFunction): Promise<Response<any, Record<string, any>>> {

    // Initialize with a generic 500 server error structure
    let customError: CustomErrorStructure = {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: "An unexpected internal server error occurred.",
        errors: [{
            message: "An unexpected internal server error occurred.",
            status: StatusCodes.INTERNAL_SERVER_ERROR,
            code: 'INTERNAL_SERVER_ERROR',
            extension: {}
        }]
    }


    // -------------------------------------------------------------------
    // This Handle Known Application Exceptions (Custom HttpException From Our Controllers)
    // -------------------------------------------------------------------
    if (error instanceof HttpException) {
        logger.error(`[API_ERROR] ${error.statusCode} - ${error.message}`);

        customError.statusCode = error.statusCode;
        customError.errors = error.serializeErrors();
        customError.message = error.message;
    }

    // -------------------------------------------------------------------
    // 2. Handle Common Database Errors (Mongoose/MongoDB)
    //    We check for these only if it's NOT already a custom HttpException(Cast, validation, Duplicate)
    // -------------------------------------------------------------------

    // Mongoose Validation Error (e.g., required field missing)
    else if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((item: any) => ({
            message: item.message,
            status: StatusCodes.BAD_REQUEST,
            code: 'VALIDATION_FAILED',
            extension: { field: item.path } // Add field context
        }));

        customError.errors = validationErrors;
        customError.statusCode = StatusCodes.BAD_REQUEST;
        customError.message = 'One or more fields failed validation.';

        logger.warn(`[API_ERROR] ${customError.statusCode} - ${customError.errors[0].message}`)
    }

    // MongoDB Duplicate Key Error (code 11000)
    else if (error.code && error.code === 11000) {
        customError.message = `Duplicate value entered for ${Object.keys(error.keyValue)} field.`;
        customError.statusCode = StatusCodes.BAD_REQUEST;
        customError.errors = [{
            message: customError.message,
            status: customError.statusCode,
            code: 'DUPLICATE_KEY',
            extension: { field: Object.keys(error.keyValue).join(', ') }
        }];
    }

    // Mongoose Cast Error (e.g., invalid ID format)
    else if (error.name === 'CastError') {
        customError.message = `No item found with ID: ${error.value}.`;
        customError.statusCode = StatusCodes.NOT_FOUND;
        customError.errors = [{
            message: customError.message,
            status: customError.statusCode,
            code: 'RESOURCE_NOT_FOUND',
            extension: { value: error.value, kind: error.kind }
        }];
    }

    // -------------------------------------------------------------------
    // 3. Final Response Construction to The Client (Always Structured)
    // -------------------------------------------------------------------

    // Log generic server errors
    if (customError.statusCode === StatusCodes.INTERNAL_SERVER_ERROR) {
        logger.error(`[CRITICAL_ERROR] 500 - ${error.message}`, error);
        customError.message = 'An unexpected internal server error occurred.';
    }

    // Send the structured JSON response
    return res.status(customError.statusCode).json({
        message: customError.message,
        errors: customError.errors,
        timestamp: new Date().toISOString(),
    })
}

export default ErrorMiddleware;