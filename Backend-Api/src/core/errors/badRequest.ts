import HttpException from "./customAPIError";
import { StatusCodes } from "http-status-codes"


class BadRequestError extends HttpException {
    public statusCode: number;
    
    constructor(message: string) {
        super(message);
        this.statusCode = StatusCodes.BAD_REQUEST
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
    
    serializeErrors() {
        return [{
            message: this.message,
            status: this.statusCode,
            code: 'INVALID_INPUT',
        }];
    }
}

export default BadRequestError