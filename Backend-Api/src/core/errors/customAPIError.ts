export interface ErrorOutput {
    message: string,
    status: number,
    code?: string
    extension?: Record<string, any> // For rich metada incase of Graphql errors
}


abstract class HttpException extends Error {
    public abstract statusCode: number;

    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, HttpException.prototype)
    }

     serializeErrors(): ErrorOutput[] {
        return [{ 
            message: this.message,
            status: this.statusCode,
            code: "API ERROR",
        }]
    }

}

export default HttpException;