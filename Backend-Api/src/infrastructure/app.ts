// Dependencies
import express, { Application, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';

// Interfaces
import Controller from '@/config/interfaces/controller.interfaces';

// Infrastructure
import redis from "@/infrastructure/cache/redis.cli";
import mongo from "@/config/mongo"
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

// Middleware
import { attachRequestContext, deviceMiddleware } from '@/shared/middleware/request.context';
import { requestIdMiddleware } from "@/shared/middleware/request-id.middleware";
import { requestLogger } from '@/shared/logging/request-logger';
import ErrorMiddleware from '@/shared/middleware/errorHandler';


//KAFKA
import { startAuditConsumer, shutdownAuditConsumer } from '@/kafka/consumer/audit.consumer';
import { startKafkaProducer, shutdownKafkaProducer, setupKafkaTopics } from "@/kafka/config"
import { waitForTopicsReady } from '@/kafka/config/waitForTopicsReady';
import { kafka } from '@/kafka/config/kafka.config';
import { getKafkaHealthStatus } from '@/kafka/config/kafka.health';
import { TOPICS } from '@/kafka/config/topics';


// Config
import { config } from '@/config/index';
import { logger } from '@/shared/utils/logger';
import mongoose from 'mongoose';
import emailQueue from './queues/email.queue';
import { runUserRegisteredConsumer } from '@/kafka/consumer/userCreated.cosumer';
import { runEmailVerifiedConsumer } from '@/kafka/consumer/emailVerify.consumer';




class App {
    public express: Application;
    public port: number;
    private server: ReturnType<Application['listen']> | null = null;
    private isShuttingDown: boolean = false;

    constructor(controllers: Controller[], port: number) {
        this.express = express();
        this.port = port;


        this.initializeSecurityMiddleware();
        this.initializeParsingMiddleware();
        this.initializeLoggingMiddleware();
        this.initializeBullBoard();
        this.initializeCustomMiddleware();
        this.initializeRoutes(controllers);
        this.initializeHealthChecks();
        this.initializeErrorMiddleware();
        this.initializeGracefulShutdown();
    }

    public async initialize(): Promise<void> {
        try {
            logger.info('Starting application initialization...');
            await this.connectToMongoDB();
            await this.connectToRedis();
            await this.initializeKafka();
            await this.initializeBullBoard();

            logger.info('✅ All services initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize application', error);
            throw error;
        }
    }

    private async connectToMongoDB(): Promise<void> {
        logger.info('Connecting to MongoDB...');

        try {
            await mongo.connect();
            logger.info('✅ MongoDB connected successfully');
        } catch (error) {
            logger.error('❌ MongoDB connection failed:', error);
            throw new Error('MongoDB connection failed - cannot start application');
        }
    }

    private async connectToRedis(): Promise<void> {
        logger.info('Connecting to Redis...');

        try {
            await redis.connect();
            logger.info('✅ Redis connected successfully');
        } catch (error) {
            logger.error('❌ Redis connection failed:', error);
            throw new Error('Redis connection failed - cannot start application');
        }
    }

    private async initializeKafka(): Promise<void> {
        logger.info('Initializing Kafka...');

        try {
            await setupKafkaTopics();
            await startKafkaProducer();

            await waitForTopicsReady(kafka, Object.values(TOPICS));
            await runUserRegisteredConsumer();
            await runEmailVerifiedConsumer();
            logger.info('✅ Kafka consumer started');

            logger.info('✅ Kafka system ready');
        } catch (error) {
            logger.error('⚠️  Kafka initialization failed (non-critical):', error);
            logger.warn('Application will continue without Kafka event streaming');
        }
    }

    private async initializeBullBoard(): Promise<void> {
        logger.info('Initializing BullBoard...');
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/admin/queues');

        try {
            createBullBoard({
                queues: [ new BullMQAdapter(emailQueue)],
                serverAdapter,
            });
            this.express.use('/admin/queues', serverAdapter.getRouter());

            logger.info('✅ BullBoard initialized successfully');
        } catch (error) {
            logger.error('⚠️  BullBoard initialization failed (non-critical):', error);
            logger.warn('Application will continue without BullBoard');
        }
    }

    private initializeSecurityMiddleware(): void {
        this.express.use(helmet({
            contentSecurityPolicy: config.app.env === 'production',
            crossOriginEmbedderPolicy: config.app.env === 'production',
        }));

        this.express.use(cors({
            origin: (origin, callback) => {
                // Allow requests with no origin (mobile apps, Postman)
                if (!origin) {
                    return callback(null, true);
                }

                const allowedOrigins = config.cors.origin;

                if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                    callback(null, true);
                } else {
                    logger.warn('CORS: Blocked request from unauthorized origin', { origin });
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-Device-ID',
                'X-Idempotency-Key',
                'X-Request-ID',
            ],
        }));

        // NoSQL Injection Prevention
        // this.express.use(mongoSanitize({ 
        //     replaceWith: '_', 
        //     sanitizeQuery: false, 
        //     // sanitizeParams: false, 
        //     // sanitizeBody: false, 
        // }));
    }

    private initializeParsingMiddleware(): void {
        this.express.use(express.json({ limit: '10mb', strict: true, }));
        this.express.use(express.urlencoded({ extended: true, limit: '10mb', }));
        this.express.use(cookieParser());
        this.express.use(compression());
    }

    /**
     * ================================================
     * LOGGING MIDDLEWARE
     * ================================================
     */
    private initializeLoggingMiddleware(): void {
        // Morgan HTTP logger
        if (config.app.env === 'development') {
            this.express.use(morgan('dev'));
        } else {
            this.express.use(morgan('combined', {
                skip: (req, res) => res.statusCode < 400, // Only log errors in production
                stream: {
                    write: (message: string) => logger.info(message.trim())
                }
            }));
        }
    }

    /**
     * ================================================
     * CUSTOM MIDDLEWARE
     * ================================================
     */

    private initializeCustomMiddleware(): void {
        this.express.use(requestIdMiddleware);
        this.express.use(deviceMiddleware);
        this.express.use(attachRequestContext);
        this.express.use(requestLogger);
    }

    /**
     * ================================================
     * ROUTES
     * ================================================
     */
    private initializeRoutes(controllers: Controller[]): void {
        // Welcome route
        this.express.get('/', (req: Request, res: Response) => {
            res.json({
                success: true,
                message: `Welcome to ${config.app.name}`,
                version: config.app.apiVersion,
                environment: config.app.env,
                documentation: `/api/${config.app.apiVersion}/docs`,
                health: '/health',
            });
        });

        // API routes
        controllers.forEach((controller) => {
            this.express.use(`/api/${config.app.apiVersion}`, controller.route);
        });
    }

    private initializeHealthChecks(): void {
        this.express.get('/health', (req: Request, res: Response) => {
            res.status(200).json({
                success: true,
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: config.app.env,
            });
        });

        this.express.get('/health/detailed', async (req: Request, res: Response) => {

            try {
                const mongoHealth = await this.checkMongoHealth();
                const redisHealth = await redis.getHealthStatus();
                const kafkaHealth = await getKafkaHealthStatus();

                const health = {
                    success: true,
                    status: 'OK',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    environment: config.app.env,
                    services: {
                        mongodb: mongoHealth,
                        redis: redisHealth,
                        kafka: kafkaHealth,
                    },
                };

                // Determine overall health
                const isHealthy =
                    mongoHealth.isConnected &&
                    redisHealth.isConnected;

                res.status(isHealthy ? 200 : 503).json(health);
            } catch (error) {
                logger.error('Health check failed', error);
                res.status(503).json({
                    success: false,
                    status: 'ERROR',
                    message: 'Health check failed',
                    timestamp: new Date().toISOString(),
                });
            }
        });
    }

    /**
     * Check MongoDB health
     */
    private async checkMongoHealth(): Promise<any> {
        const readyState = mongoose.connection.readyState;
        try {
            return {
                isConnected: readyState === 1,
                readyState: readyState,
                // host: mongoose.connection.host,
                // name: mongoose.connection.name,
            };
        } catch (error) {
            return {
                isConnected: false,
                error: (error as Error).message,
            };
        }
    }

    private initializeErrorMiddleware(): void {
        this.express.use((req: Request, res: Response) => {
            res.status(404).json({
                success: false,
                message: 'Route not found',
                path: req.originalUrl,
                method: req.method,
            });
        });

        // Global error handler
        this.express.use(ErrorMiddleware);
    }

    /**
     * ================================================
     * START HTTP SERVER
     * ================================================
     */
    public listen(): void {
        this.server = this.express.listen(this.port, () => {
            console.log('');
            console.log('╔════════════════════════════════════════════╗');
            console.log(`║   ✅ Server running on port ${this.port}           ║`);
            console.log(`║   🌍 Environment: ${config.app.env.padEnd(21)}║`);
            console.log(`║   📡 API Version: ${config.app.apiVersion.padEnd(22)}║`);
            console.log('╚════════════════════════════════════════════╝');
            console.log('');
            console.log(`🔗 Local:            http://localhost:${this.port}`);
            console.log(`🔗 Health Check:     http://localhost:${this.port}/health`);
            console.log(`🔗 Detailed Health:  http://localhost:${this.port}/health/detailed`);
            console.log(`🔗 API Base:         http://localhost:${this.port}/api/${config.app.apiVersion}`);
            console.log('');

            logger.info('Server started successfully', {
                port: this.port,
                env: config.app.env,
                apiVersion: config.app.apiVersion,
            });
        });

        // Handle server errors
        this.server.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${this.port} is already in use`);
                process.exit(1);
            } else {
                logger.error('Server error', error);
                process.exit(1);
            }
        });
    }

    private initializeGracefulShutdown(): void {
        const shutdown = async (signal: string, exitCode: number = 0) => {
            // Prevent multiple shutdown calls
            if (this.isShuttingDown) {
                logger.warn('Shutdown already in progress');
                return;
            }

            this.isShuttingDown = true;

            logger.info(`Received ${signal}. Starting graceful shutdown...`);

            try {
                // Step 1: Stop accepting new requests
                if (this.server) {
                    await new Promise<void>((resolve) => {
                        this.server!.close(() => {
                            logger.info('✅ HTTP server closed');
                            resolve();
                        });
                    });

                    // Give active requests 30 seconds to complete
                    setTimeout(() => {
                        logger.warn('Forcing shutdown after timeout');
                    }, 30000);
                }

                // Step 2: Close Kafka connections (non-critical)
                try {
                    await shutdownAuditConsumer();
                    await shutdownKafkaProducer();
                    logger.info('✅ Kafka connections closed');
                } catch (error) {
                    logger.error('Error closing Kafka:', error);
                }

                // Step 3: Close Redis connection
                try {
                    await redis.disconnect();
                    logger.info('✅ Redis connection closed');
                } catch (error) {
                    logger.error('Error closing Redis:', error);
                }

                // Step 4: Close MongoDB connection (LAST)
                try {
                    await mongo.disconnect();
                    logger.info('✅ MongoDB connection closed');
                } catch (error) {
                    logger.error('Error closing MongoDB:', error);
                }

                logger.info('Graceful shutdown completed');
                process.exit(exitCode);
            } catch (error) {
                logger.error('Error during graceful shutdown', error);
                process.exit(1);
            }
        };

        // Handle uncaught exceptions
        process.on('uncaughtException', (error: Error) => {
            logger.error('[FATAL] Uncaught Exception:', error);
            shutdown('uncaughtException', 1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
            logger.error('[FATAL] Unhandled Rejection:', { reason, promise });
            shutdown('unhandledRejection', 1);
        });

        // Handle SIGTERM (from Docker, Kubernetes, etc.)
        process.on('SIGTERM', () => {
            shutdown('SIGTERM', 0);
        });

        // Handle SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
            shutdown('SIGINT', 0);
        });

        // Handle PM2 graceful reload
        process.on('message', (msg) => {
            if (msg === 'shutdown') {
                shutdown('PM2 shutdown', 0);
            }
        });
    }
}

export default App;