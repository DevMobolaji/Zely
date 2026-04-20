import "express-serve-static-core";

declare global {
    namespace Express {
        interface Request {
            logger: winston.Logger;
            requestId?: string;
            user?: {
                userId: string;
                email: string;
                role: string;
            };
            context?: IRequestContext;
        }
    }
}