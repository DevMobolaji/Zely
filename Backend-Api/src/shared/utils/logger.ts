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


// Define the base format that handles errors (suppressing stack) and uses JSON
const baseJsonFormat = winston.format.combine(
    winston.format.timestamp(),
    // 1. CRITICAL FIX: Process Error objects and suppress the full stack trace
    winston.format.errors({ stack: false }),
    // 2. Use JSON serialization with the safeReplacer to handle BigInt
    winston.format.json({ replacer: safeReplacer })
);

const transports: winston.transport[] = [];

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