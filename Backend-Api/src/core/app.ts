import express, { Application } from 'express';
import Controller from "@/interfaces/controller.interfaces"
import ErrorMiddleware from '@/app/middleware/errorHandler';
import { requestLogger } from '@/app/logging/request-logger';
import { requestIdMiddleware } from '@/app/middleware/requestId.middleware.';
import logger from '@/app/logging/logger';
import { mongoConnect } from '@/config/mongo';


class App {
    public express: Application;
    public port: number;
    private server: any

    constructor(public controllers: Controller[], port: number) {
        this.express = express()
        this.port = port;
        

        this.initializeDbConnection();
        this.initializeMiddleware();
        this.initializeRoutes(controllers);
        this.initializeGraphql();
        this.initializeErrorMiddleware();
        this.gracefulShutdown()
    }

        public gracefulShutdown(): void {
            //Handle Uncaught Rejection
            process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
            logger.error('[FATAL] Unhandled Rejection at Promise:', { reason, promise });
            // Perform graceful exit after logging
            this.server.close(() => {
                process.exit(1); 
            });
        });

        // 2. Handle Uncaught Exceptions
        process.on('uncaughtException', (error: Error) => {
            logger.error('[FATAL] Uncaught Exception:', error);
            // Perform graceful exit after logging
            this.server.close(() => {
                process.exit(1);
            });
        });

    }

        private initializeMiddleware(): void {
            this.express.use(express.json());
            this.express.use(express.urlencoded({ extended: true }));
            this.express.use(requestIdMiddleware)
            this.express.use(requestLogger);
        }

        private initializeRoutes(controllers: Controller[]): void {
            controllers.forEach(controller => {
                this.express.use('/api/V1', controller.route);
            });
        }

        private initializeGraphql(): void {
        }

        private initializeErrorMiddleware(): void {
            this.express.use(ErrorMiddleware)
        }

        public async initializeDbConnection(): Promise<void> {
            // implement your DB connection logic here
            await mongoConnect();
            // const client = await connectDB()
            // //GraceFul shutdown
            process.on('SIGINT', async () => {
            console.log('SIGINT signal received. Closing MongoDB connection...');
            })
        }

        public listen(): void {
            this.express.listen(this.port, () => {
                console.log(`🚀 Server running on port ${this.port}`);
            });
        }
}

export default App;