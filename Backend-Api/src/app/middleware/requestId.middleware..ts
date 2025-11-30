// src/middleware/requestId.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Augment the Request type to easily access requestId downstream
// In a real project, this would be done in a global declaration file.
// For now, we cast it to 'any' for simplicity.

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // 1. Check for incoming header 'X-Request-ID' or generate new UUID
    const requestId = req.header('X-Request-ID') || uuidv4();

    // 2. Attach the ID to the Request object
    // This makes it available to controllers and services.
    (req as any).requestId = requestId; 

    // 3. Set it on the Response header for client-side correlation
    res.setHeader('X-Request-ID', requestId);

    // 4. Proceed to the next middleware or controller
    next();
};