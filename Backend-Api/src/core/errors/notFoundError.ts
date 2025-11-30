import { StatusCodes } from "http-status-codes";
import HttpException from "./customAPIError";

export class NotFoundError extends HttpException {
    public statusCode: number;
    
    constructor(message: string = 'Resource not found') {
        super(message);
        this.statusCode = StatusCodes.NOT_FOUND
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
    
}