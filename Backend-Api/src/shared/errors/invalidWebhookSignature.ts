import HttpException, { ErrorOutput } from "./customAPIError";
import { StatusCodes } from "http-status-codes";

class InvalidWebhookSignatureError extends HttpException {
  constructor(message: string = "Invalid webhook signature") {
    super(message, StatusCodes.UNAUTHORIZED, "INVALID_WEBHOOK_SIGNATURE");
  }

  serializeErrors(): ErrorOutput[] {
    return [{
      message: this.message,
      status: this.statusCode,
      code: "INVALID_WEBHOOK_SIGNATURE",
      extension: {
        details: "The webhook signature could not be verified. The request may be forged or tampered with."
      }
    }];
  }
}

export default InvalidWebhookSignatureError;
