import express, { Application } from 'express';
import Controller from "@/interfaces/controller.interfaces";
import ErrorMiddleware from '@/app/middleware/errorHandler';

import { requestLogger } from '@/app/logging/request-logger';
import logger from '@/app/logging/logger';
import { mongoConnect, mongoDisconnect } from '@/config/mongo';
import { requestIdMiddleware } from '@/app/middleware/requestId.middleware.';
import cookieParser from 'cookie-parser';

class App {
    public express: Application;
    public port: number;
    private server: ReturnType<Application['listen']> | null = null;

    constructor(controllers: Controller[], port: number) {
        this.express = express();
        this.port = port;

        this.initializeDbConnection();
        this.initializeMiddleware();
        this.initializeRoutes(controllers);
        this.initializeGraphql();
        this.initializeErrorMiddleware();
        this.initializeGracefulShutdown();
    }

    private initializeMiddleware(): void {
        this.express.use(express.json());
        this.express.use(cookieParser())
        this.express.use(express.urlencoded({ extended: true }));
        this.express.use(requestIdMiddleware);
        this.express.use(requestLogger);
    }

    private initializeRoutes(controllers: Controller[]): void {
        controllers.forEach(controller => {
            this.express.use('/api/v1', controller.route);
        });
    }

    private initializeGraphql(): void {
        // Initialize GraphQL here if needed
    }

    private initializeErrorMiddleware(): void {
        this.express.use(ErrorMiddleware);
    }

    private async initializeDbConnection(): Promise<void> {
        try {
            await mongoConnect();
            console.info('MongoDB connected successfully');
        } catch (err) {
            console.error('Failed to connect to MongoDB', err);
            process.exit(1);
        }
    }

    public listen(): void {
        this.server = this.express.listen(this.port, () => {
            console.info(`🚀 Server running on port ${this.port}`);
        });
    }

    private initializeGracefulShutdown(): void {
        const shutdown = async (exitCode = 0) => {
            logger.info('Shutting down gracefully...');
            try {
                if (this.server) {
                    this.server.close(() => logger.info('HTTP server closed'));
                }
                await mongoDisconnect();
                logger.info('MongoDB connection closed');
            } catch (err) {
                logger.error('Error during shutdown', err);
            } finally {
                process.exit(exitCode);
            }
        };

        process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
            logger.error('[FATAL] Unhandled Rejection:', { reason, promise });
            shutdown(1);
        });

        process.on('uncaughtException', (error: Error) => {
            logger.error('[FATAL] Uncaught Exception:', error);
            shutdown(1);
        });

        process.on('SIGINT', () => {
            logger.info('SIGINT received, shutting down...');
            shutdown(0);
        });

        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down...');
            shutdown(0);
        });
    }
}

export default App;
