import HttpException, {ErrorOutput} from "./customAPIError";
import { StatusCodes } from "http-status-codes"


class UnauthenticatedError extends HttpException {

    public statusCode: number;

    constructor(message: string) {
        super(message, StatusCodes.UNAUTHORIZED); 
        this.statusCode = StatusCodes.UNAUTHORIZED
    }

    /**
     * Overrides the default serialization to add a specific error code.
     */
    serializeErrors(): ErrorOutput[] {
        return [{
            message: this.message,
            status: this.statusCode,
            extension: { 
                details: 'Authentication credentials (e.g., JWT) were missing or invalid.'
            }
        }];
    }
}


export default UnauthenticatedError;