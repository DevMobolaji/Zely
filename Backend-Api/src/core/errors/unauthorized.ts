import HttpException, { ErrorOutput } from "./customAPIError";
import { StatusCodes } from "http-status-codes"


class Unauthorized extends HttpException {
    constructor(message: string) {
        super(message, StatusCodes.FORBIDDEN, 'FORBIDDEN_ACCESS');
        }

    serializeErrors(): ErrorOutput[] {
        return [{
            message: this.message,
            status: this.statusCode,
            code: 'FORBIDDEN_ACCESS', // Specific code for 403
            extension: {
                details: 'The authenticated user does not have permission to perform this action.'
            }
        }];
    }
}


export default Unauthorized;