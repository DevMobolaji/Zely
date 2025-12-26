import HttpException, { ErrorOutput } from "./customAPIError";
import { StatusCodes } from "http-status-codes"

interface FieldError { field: string; message: string; }

class BadRequestError extends HttpException {
    private errors: FieldError[];
    
    constructor(message: string, errors: FieldError[] = []) {
        super(message, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR');
        this.errors = errors
    }
    
    serializeErrors(): ErrorOutput[] {
       if(this.errors.length > 0) {
        return this.errors.map(err => ({
            message: err.message,
            status: this.statusCode,
            code: 'INVALID_FIELD',
            extension: { field: err.field }
       }));
    }
    return super.serializeErrors();
    }
}

export default BadRequestError