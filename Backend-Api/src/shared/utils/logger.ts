
// import winston from "winston";
// import DailyRotateFile from "winston-daily-rotate-file";
// import { config } from "@/config/index"
// import { Request, Response } from "express"
// import path from "path";
// const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), "logs");


// /**
//  * Custom log format
//  * WHY JSON: Easy to parse, search, and analyze
//  */
// const logFormat = winston.format.combine(
//     winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
//     winston.format.errors({ stack: false }),
//     winston.format.colorize({ all: config.app.env === 'development' }),
//     winston.format.printf(({ timestamp, level, message, ...meta }) => {
//         if (config.app.env === 'production') {
//             return JSON.stringify({
//                 timestamp,
//                 level,
//                 message,
//                 ...meta,
//             });
//         }

//         let log = `${timestamp} [${level}]: ${message}`;

//         if (Object.keys(meta).length > 0) {
//             log += ` ${JSON.stringify(meta, null, 2)}`;
//         }

//         return log;
//     })
// );

// const fileRotationTransport = new DailyRotateFile({
//     dirname: LOG_DIR,
//     filename: "app-%DATE%.log",
//     datePattern: 'YYYY-MM-DD',
//     zippedArchive: true, // Compress old logs
//     maxSize: '20m', // Rotate if file exceeds 20MB
//     maxFiles: '14d', // Keep logs for 14 days
//     format: winston.format.combine(
//         winston.format.timestamp(),
//         winston.format.json()
//     ),
// });


// const errorFileTransport = new DailyRotateFile({
//     dirname: LOG_DIR,
//     filename: "error-%DATE%.log",
//     datePattern: 'YYYY-MM-DD',
//     zippedArchive: true,
//     maxSize: '20m',
//     maxFiles: '30d', // Keep error logs longer (30 days)
//     level: 'error', // Only errors
//     format: winston.format.combine(
//         winston.format.timestamp(),
//         winston.format.json()
//     ),
// });

// /**
//  * Create logger instance
//  */
// export const logger = winston.createLogger({
//     level: config.logging.level || 'info',
//     format: logFormat,

//     // Default metadata (added to all logs)
//     defaultMeta: {
//         service: "logger",
//         environment: config.app.env,
//     },

//     // Transports (where logs go)
//     transports: [
//         // File transports
//         fileRotationTransport,
//         errorFileTransport,
//     ],

//     // Don't exit on handled exceptions
//     exitOnError: false,
// });

// /**
//  * Console transport for development
//  * WHY: Easy to see logs while developing
//  */
// if (config.app.env !== 'production') {
//     logger.add(
//         new winston.transports.Console({
//             format: winston.format.combine(
//                 winston.format.colorize(),
//                 winston.format.simple()
//             ),
//         })
//     );
// }


// /**
//  * Log info message
//  * @param {string} message - Log message
//  * @param {object} meta - Additional metadata
//  */
// function info(message: string, meta: object = {}) {
//     logger.info(message, meta);
// }

// /**
//  * Log warning message
//  * @param {string} message - Log message
//  * @param {object} meta - Additional metadata
//  */
// function warn(message: string, meta: object = {}) {
//     logger.warn(message, meta);
// }

// /**
//  * Log error message
//  * @param {string} message - Log message
//  * @param {Error|object} error - Error object or metadata
//  */
// function error(message: string, errorObj = {}) {
//     if (errorObj instanceof Error) {
//         logger.error(message, {
//             error: errorObj.message,
//             stack: errorObj.stack,
//         });
//     } else {
//         logger.error(message, errorObj);
//     }
// }

// /**
//  * Log debug message (only in development)
//  * @param {string} message - Log message
//  * @param {object} meta - Additional metadata
//  */
// function debug(message: string, meta: object = {}) {
//     logger.debug(message, meta);
// }

// /**
//  * Log HTTP request
//  * WHY: Track all API requests for debugging and audit
//  * 
//  * @param {object} req - Express request object
//  * @param {object} res - Express response object
//  * @param {number} responseTime - Response time in ms
//  */
// function http(req: Request, res: Response, responseTime: number) {
//     logger.http('HTTP Request', {
//         method: req.method,
//         url: req.originalUrl || req.url,
//         statusCode: res.statusCode,
//         responseTime: `${responseTime}ms`,
//         ip: req.ip,
//         userAgent: req.get('user-agent'),
//         userId: req.user?.userId || 'anonymous',
//     });
// }

// /**
//  * Log transaction (critical for fintech!)
//  * WHY: Complete audit trail of all financial operations
//  * 
//  * @param {string} type - Transaction type
//  * @param {string} transactionId - Transaction ID
//  * @param {object} data - Transaction data
//  */
// function transaction(type: string, transactionId: string, data: object) {
//     logger.info(`Transaction: ${type}`, {
//         transactionId,
//         type,
//         ...data,
//         // Mark as transaction for easy filtering
//         category: 'TRANSACTION',
//     });
// }

// /**
//  * Log authentication event
//  * WHY: Security - track all auth attempts
//  * 
//  * @param {string} event - Auth event type
//  * @param {string} userId - User ID
//  * @param {object} data - Additional data
//  */
// function auth(event: string, userId: string, data: object = {}) {
//     logger.info(`Auth: ${event}`, {
//         event,
//         userId,
//         ...data,
//         category: 'AUTHENTICATION',
//     });
// }

// /**
//  * Log security event
//  * WHY: Detect suspicious activities
//  * 
//  * @param {string} event - Security event
//  * @param {object} data - Event data
//  */
// function security(event: string, data: object = {}) {
//     logger.warn(`Security: ${event}`, {
//         event,
//         ...data,
//         category: 'SECURITY',
//     });
// }


// /**
//  * Create child logger with persistent metadata
//  * WHY: Add context to all logs from a specific module
//  * 
//  * @param {object} metadata - Metadata to add to all logs
//  * @returns {object} - Child logger
//  */
// function child(metadata: object): object {
//     return logger.child(metadata);
// }

// /**
//  * Stream for Morgan HTTP logger middleware
//  * WHY: Integrate with Express middleware
//  */
// const stream = {
//     write: (message: string) => {
//         logger.http(message.trim());
//     },
// };

// // Export logger functions
// module.exports = {
//     // Basic logging
//     info,
//     warn,
//     error,
//     debug,

//     // Specialized logging
//     http,
//     transaction,
//     auth,
//     security,

//     // Utilities
//     child,
//     stream,

//     // Raw logger (for advanced use)
//     logger,
// };




// src/core/logging/logger.ts
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import chalk from "chalk";
import path from "path";

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), "logs");
const isProd = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL || (isProd ? "info" : "debug");

function safeReplacer(key: string, value: any) {
    // This ensures BigInts are converted to strings before stringification
    return typeof value === "bigint" ? value.toString() : value
}

// Custom format for Development Console output
const devConsoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const ts = chalk.gray(timestamp as string);
    const lvl = level === "error" ? chalk.red(level) : chalk.blue(level);
    // CRITICAL FIX: Use safeReplacer here when stringifying metadata
    const metaStr = Object.keys(meta).length ? chalk.gray(JSON.stringify(meta, safeReplacer, 2)) : "";
    return `${ts} ${lvl}: ${message} ${metaStr}`;
});


// --- Core Formats for JSON Logs (Production Console and Files) ---

// Define the base format that handles errors (suppressing stack) and uses JSON
const baseJsonFormat = winston.format.combine(
    winston.format.timestamp(),
    // 1. CRITICAL FIX: Process Error objects and suppress the full stack trace
    winston.format.errors({ stack: false }),
    // 2. Use JSON serialization with the safeReplacer to handle BigInt
    winston.format.json({ replacer: safeReplacer })
);

const transports: winston.transport[] = [];

// --- Transports ---

// Console transport
transports.push(
    new winston.transports.Console({
        level,
        // If in production, use the JSON format (which suppresses stack)
        format: isProd
            ? baseJsonFormat
            // If in development, use the custom dev format (which now uses safeReplacer)
            : winston.format.combine(winston.format.timestamp(), devConsoleFormat),
        handleExceptions: true,
    })
);

// File rotation (info+) - Uses the baseJsonFormat
transports.push(
    new DailyRotateFile({
        level: "info",
        dirname: LOG_DIR,
        filename: "app-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        maxFiles: "30d",
        zippedArchive: true,
        format: baseJsonFormat, // <-- Applied the format that suppresses stack
    })
);

// File rotation for errors - Uses the baseJsonFormat
transports.push(
    new DailyRotateFile({
        level: "error",
        dirname: LOG_DIR,
        filename: "error-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        maxFiles: "90d",
        zippedArchive: true,
        format: baseJsonFormat, // <-- Applied the format that suppresses stack
    })
);

const logger = winston.createLogger({
    level,
    transports,
    exitOnError: false,
});

export { logger };