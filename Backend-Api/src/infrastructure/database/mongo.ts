
import mongoose, { ConnectOptions } from 'mongoose';
import { config } from "@/config/index";
import { logger } from '@/shared/utils/logger';

class MongoDBConnection {
  isConnected = false;

  constructor() {
    this.isConnected = false;

    // Listen to MongoDB events to track connection state
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Connection successful
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
    });

    // Connection error
    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB: Connection error:', err.message);
      this.isConnected = false;
    });

    // Connection disconnected
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB: Disconnected');
      this.isConnected = false;
    });

    // Application termination - close connection gracefully
    // WHY: Prevents connection leaks and ensures clean shutdown

    //APP.JS HANDLES THIS NOW
    // process.on('SIGINT', async () => {
    //   await this.disconnect();
    //   process.exit(0);
    // });

    // MongoDB driver reconnection (automatic)
    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB: Reconnected');
      this.isConnected = true;
    });
  }


  async connect(retries = 5, delay = 5000): Promise<void> {
    // If already connected, skip
    if (this.isConnected) {
      logger.info('ℹ️  MongoDB: Already connected');
      return;
    }

    try {
      // Close any existing connection before retrying
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();  // ← add this
      }
      // IMPORTANT: For fintech, we MUST enable replica sets for transactions
      const options: any = {
        ...config.database.mongodb.options,
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        readPreference: 'primary',
        w: 'majority',
        retryWrites: true,
      };

      logger.info('🔌 MongoDB: Connecting...');
      await mongoose.connect(config.database.mongodb.uri, options);

      // Additional check: Ensure we can run transactions
      // WHY: Transactions require replica sets in MongoDB
      // if (config.app.env === 'production') {
      //   await this.checkTransactionSupport();
      // }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ MongoDB: Connection failed (${retries} retries left):`, errorMessage);

      // RETRY LOGIC with exponential backoff
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect(retries - 1, delay * 2);
      }

      // Out of retries - this is critical for a fintech app
      throw new Error('MongoDB connection failed after multiple retries. Cannot start application.');
    }
  }


  async checkTransactionSupport() {
    try {
      if (!mongoose.connection.db) {
        throw new Error("MongoDB connection is not ready");
      }
      const admin = mongoose.connection.db.admin();
      const serverInfo = await admin.serverStatus();

      // Check if replica set is configured
      if (!serverInfo.repl || !serverInfo.repl.ismaster) {
        logger.warn('⚠️  WARNING: MongoDB is not running as a replica set!');
        logger.warn('⚠️  Transactions will NOT work. This is CRITICAL for production!');
        logger.warn('⚠️  Please configure MongoDB replica set.');

        if (config.app.env === 'production') {
          throw new Error('Replica set required in production for transaction support');
        }
      } else {
        logger.info('✅ MongoDB: Replica set detected - transactions supported');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ MongoDB: Failed to check transaction support:', errorMessage);
    }
  }

  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.connection.close();
      logger.info('👋 MongoDB: Disconnected gracefully');
      this.isConnected = false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ MongoDB: Error during disconnection:', errorMessage);
      throw error;
    }
  }

  getHealthStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };
  }

  getInstance() {
    return mongoose;
  }
}

const mongo = new MongoDBConnection();
export default mongo