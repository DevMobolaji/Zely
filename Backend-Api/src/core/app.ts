import express, { Application } from 'express';
import Controller from "@/interfaces/controller.interfaces"
import { Pool, PoolClient } from "pg"
import { mongoConnect } from '@/config/mongo';
import ErrorMiddleware from '@/app/middleware/errorHandler';
import { requestLogger } from '@/app/logging/request-logger';
import { requestIdMiddleware } from '@/app/middleware/requestId.middleware.';
import logger from '@/app/logging/logger';


class App {
    public express: Application;
    public port: number;
    private server: any

    constructor(public controllers: Controller[], port: number) {
        this.express = express()
        this.port = port;
        

        this.initializeMiddleware();
        this.initializeRoutes(controllers);
        this.initializeGraphql();
        this.initializeErrorMiddleware();
        this.initializeDbConnection();
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
            await mongoConnect() // implement your DB connection logic here
            // const pool = new Pool({
            //     user: process.env.DB_USER,
            //     host: process.env.DB_HOST,
            //     database: process.env.DB_NAME,
            //     password: process.env.DB_PASSWORD,
            //     port: process.env.DB_PORT ? +process.env.DB_PORT : undefined
            //     });

            //     // 3. Test the connection and start the server
            //     pool.connect((err: Error | undefined, client: PoolClient | undefined, release: (release?: any) => void) => {
            //     if (err) {
            //         // Log the error and exit if the database connection fails
            //         return console.error('Error acquiring client', err.stack);
            //     }
            //     console.log('Successfully connected to the PostgreSQL database!');
            //     release(); // Release the client connection
            //         // 
            //         })
                }

        // 1. Handle Unhandled Promise Rejections
        



        


        public listen(): void {
            this.express.listen(this.port, () => {
                console.log(`🚀 Server running on port ${this.port}`);
            });
        }
}

export default App;