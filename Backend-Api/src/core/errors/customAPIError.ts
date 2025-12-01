export interface ErrorOutput {
    message: string,
    status: number,
    code?: string
    extension?: Record<string, any> // For rich metada incase of Graphql errors
}


abstract class HttpException extends Error {
    public readonly statusCode: number;
    public readonly errorCode: string;

    constructor(message: string, statusCode: number, errorCode: string = "API_ERROR") {
        super(message);
        this.statusCode = statusCode; // Initialize statusCode here
        this.errorCode = errorCode;
    }

     serializeErrors(): ErrorOutput[] {
        return [{ 
            message: this.message,
            status: this.statusCode,
            code: this.errorCode,
            ...('getExtension' in this && { extension: (this as any).getExtension() })
        }]
    }

}

export default HttpException;