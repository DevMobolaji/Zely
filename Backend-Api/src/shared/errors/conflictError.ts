import { StatusCodes } from "http-status-codes";
import HttpException from "./customAPIError";

export class ConflictError extends HttpException {
    constructor(message: string = 'Resource already exists or conflicts with existing data') {
        super(message, StatusCodes.CONFLICT, 'RESOURCE_CONFLICT');
    }
}