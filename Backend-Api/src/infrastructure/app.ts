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
import mongo from '@/infrastructure/database/mongo'
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

// Middleware
import { attachRequestContext, deviceMiddleware } from '@/shared/middleware/request.context';
import { requestIdMiddleware } from "@/shared/middleware/request-id.middleware";
import { requestLogger } from '@/shared/logging/request-logger';
import ErrorMiddleware from '@/shared/middleware/errorHandler';


//KAFKA
import { startKafkaProducer, shutdownKafkaProducer, setupKafkaTopics } from "@/kafka/config"
import { isTransferConsumerReady, runTransferConsumer } from '@/kafka/consumer/transfer.consumer';
//import { reconciliationQueue } from '@/workers/reconcileLedger.worker';
import { runAuthConsumer, stopAuthConsumer } from '@/kafka/consumer/auth.consumer';
import { waitForTopicsReady } from '@/kafka/config/waitForTopicsReady';
import { kafka } from '@/kafka/config/kafka.config';
import { getKafkaHealthStatus } from '@/kafka/config/kafka.health';
import { TOPICS } from '@/kafka/config/kafka.topics';


// Config
import { config } from '@/config/index';
import { logger } from '@/shared/utils/logger';
import mongoose from 'mongoose';
import emailQueue from './queues/email.queue';
import { requestIdempotencyKey } from '@/shared/middleware/request-idempotency';
import { runPasswordConsumer, stopPasswordConsumer } from '@/kafka/consumer/resetPassword.consumer';
import { runRetryConsumer, stopRetryConsumer } from '@/kafka/consumer/retryConsumer';
import { startDLQSink, stopDLQSink } from '@/kafka/consumer/dlq.consumer';
import { runVaultConsumer, stopVaultConsumer } from '@/kafka/consumer/vault.consumer';
import { runProjectionConsumer, stopProjectionConsumer } from '@/kafka/consumer/projectConsumer';
import { runOutboxRouter, stopOutboxRouter } from '@/kafka/config/debezium.outboxrouter';
import { registry } from './resilience';
import { metricsMiddleware } from '@/shared/middleware/metrics.middleware';
import { seedFeeConfig } from '@/infrastructure/seeder/fee.seeder';
import ensureSystemLedger from '@/modules/ledger/system ledger/create.system.ledger';
import { ensureTransactionLimits } from './seeder/transactionLimits.seeder';
import { runKycConsumer } from '@/kafka/consumer/kyc.consumer';
import { SKIP_PATHS } from './helpers/skip.rule.helper';





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
        this.initializeCustomMiddleware();
        this.initializeRoutes(controllers);
        this.initializeHealthChecks();
        this.initializedMetricsEndpoint();
        this.initializeBullBoard();
        this.initializeErrorMiddleware();
        this.initializeGracefulShutdown();
    }

    public async initialize(): Promise<void> {
        try {
            logger.info('Starting application initialization...');
            await this.connectToMongoDB();
            await this.connectToRedis();
            await this.initializeKafka();

            logger.info('✅ All services initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize application', error);
            throw error;
        }
    }

    private async connectToMongoDB(): Promise<void> {
        try {
            await mongo.connect();
            logger.info('✅ MongoDB connected successfully');

            await ensureSystemLedger('NGN');
            logger.info('✅ System accounts ready');

            await seedFeeConfig();
            logger.info('✅ Fee config ready');

            await ensureTransactionLimits();
            logger.info('✅ Transaction limits initialized');

        } catch (error) {
            logger.error('❌ MongoDB connection failed:', error);
            throw new Error('MongoDB connection failed - cannot start application');
        }
    }

    private async connectToRedis(): Promise<void> {
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
            await waitForTopicsReady(kafka, Object.values(TOPICS));
            await startKafkaProducer();
            await runAuthConsumer()
            await runPasswordConsumer()
            await runTransferConsumer();
            await runProjectionConsumer()
            await runVaultConsumer()
            await runKycConsumer()
            await runRetryConsumer()
            await startDLQSink()

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
                queues: [new BullMQAdapter(emailQueue) /* Add other queues here */],
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

        //NoSQL Injection Prevention
        // this.express.use(mongoSanitize({ 
        //     replaceWith: '_', 
        //     sanitizeQuery: false, 
        //     sanitizeParams: false, 
        //     sanitizeBody: false, 
        // }));
    }

    private initializeParsingMiddleware(): void {
        this.express.use(express.json({ limit: '10mb', strict: true, }));
        this.express.use(express.urlencoded({ extended: true, limit: '10mb', }));
        this.express.use(cookieParser());
        this.express.use(compression());
    }


    // ================================================
    // LOGGING MIDDLEWARE
    // ================================================

    private initializeLoggingMiddleware(): void {
        const skipNoise = (req: Request, res: Response): boolean => {
            if (SKIP_PATHS.has(req.path)) return true;
            const ua = req.get("User-Agent") ?? "";
            if (ua.startsWith("Prometheus/")) return true;
            return false;
        };

        if (config.app.env === "development") {
            this.express.use(morgan("dev", { skip: skipNoise }));
        } else {
            this.express.use(
                morgan("combined", {
                    // Production: skip non-errors AND skip noise on errors too
                    skip: (req, res) => res.statusCode < 400 || skipNoise(req, res),
                    stream: {
                        write: (message: string) => logger.info(message.trim()),
                    },
                })
            );
        }
    }

    /**
     * ================================================
     * CUSTOM MIDDLEWARE
     * ================================================
     */

    private initializeCustomMiddleware(): void {
        this.express.set("trust proxy", 1)
        this.express.use(metricsMiddleware); // Metrics middleware should be first to capture all requests
        this.express.use(requestIdMiddleware);
        this.express.use("/transfer", requestIdempotencyKey)
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
        this.express.get('/', (req: Request, res: Response) => {
            res.json({
                success: true,
                message: `Welcome to ${config.app.name}`,
                version: config.app.apiVersion,
                environment: config.app.env,
                documentation: `/api/${config.app.apiVersion}/docs`,
                health: '/health',
                metric: '/metric',
            });
        });

        // API routes
        controllers.forEach((controller) => {
            this.express.use(`/api/${config.app.apiVersion}`, controller.route);
        });
    }

    private initializedMetricsEndpoint(): void {
        // In initializeHealthChecks or initializeRoutes
        this.express.get('/metrics', async (req: Request, res: Response) => {
            try {
                res.set('Content-Type', registry.contentType);
                res.end(await registry.metrics());
            } catch (err) {
                res.status(500).end(err);
            }
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
                const consumerReady = isTransferConsumerReady();

                const health = {
                    success: true,
                    status: 'OK',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    environment: config.app.env,
                    services: {
                        transferConsumer: { ready: consumerReady },
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
        const shutdown = async (signal: string, exitCode = 0) => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;
            logger.info(`Received ${signal}. Starting graceful shutdown...`);

            // Hard deadline — no matter what
            const hardExit = setTimeout(() => {
                logger.error('Shutdown timed out — forcing exit');
                process.exit(1);
            }, 30_000).unref();

            try {
                if (this.server) {
                    await Promise.race([
                        new Promise<void>((resolve) => this.server!.close(() => resolve())),
                        new Promise<void>((_, reject) =>
                            setTimeout(() => reject(new Error('Server close timeout')), 10_000)
                        ),
                    ]);
                    logger.info('✅ HTTP server closed');
                }
                await shutdownKafkaProducer().catch((e) => logger.error('Kafka shutdown error', e));
                await redis.disconnect().catch((e) => logger.error('Redis shutdown error', e));
                await mongo.disconnect().catch((e) => logger.error('Mongo shutdown error', e));

                clearTimeout(hardExit);
                logger.info('Graceful shutdown complete');
                process.exit(exitCode);
            } catch (err) {
                logger.error('Shutdown error', err);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('uncaughtException', (err) => {
            logger.error('[FATAL] Uncaught Exception:', err);
            setTimeout(() => process.exit(1), 5_000).unref();
            shutdown('uncaughtException', 1);
        });
        process.on('unhandledRejection', (reason) => {
            logger.error('[FATAL] Unhandled Rejection:', reason);
            setTimeout(() => process.exit(1), 5_000).unref();
            shutdown('unhandledRejection', 1);
        });
        process.on('message', (msg) => { if (msg === 'shutdown') shutdown('PM2'); });
    }
}

export default App;