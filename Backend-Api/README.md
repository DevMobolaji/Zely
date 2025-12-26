# 🏦 Production-Grade Fintech API

> بسم الله الرحمن الرحيم - In the Name of Allah, the Most Gracious, the Most Merciful

A robust, scalable, and secure fintech application built with Node.js, MongoDB, Redis, and Kafka.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [System Design Concepts](#system-design-concepts)

## ✨ Features

- **🔐 Secure Authentication** - JWT-based auth with refresh tokens, 2FA support
- **💳 Account Management** - Multiple account types, balance tracking
- **💸 Transactions** - Transfers, payments, refunds with full audit trail
- **🔄 Event-Driven Architecture** - Kafka for async processing
- **📊 Real-time Updates** - Redis for caching and real-time data
- **🛡️ Security First** - Multiple layers of security, rate limiting
- **📝 Comprehensive Logging** - Audit trail for compliance
- **🔍 Device Tracking** - Monitor user devices and sessions
- **🌐 Universal User ID** - Track users across all services

## 🛠 Tech Stack

### Core
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: JavaScript (ES6+)

### Database & Storage
- **Primary Database**: MongoDB 4.0+ with Mongoose ODM
- **Cache**: Redis with ioredis
- **Event Streaming**: Apache Kafka with KafkaJS

### Services
- **Email**: Resend
- **SMS**: Twilio (Optional)

### Security
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Security Headers**: Helmet
- **Rate Limiting**: express-rate-limit with Redis store
- **Input Sanitization**: express-mongo-sanitize

### Logging & Monitoring
- **Logger**: Winston with daily file rotation
- **HTTP Logging**: Morgan

## 🏗 Architecture

### Modular Monolith
This project follows a **modular monolith** architecture:
- Single codebase, single deployment
- Organized by domain (auth, accounts, transactions)
- Easy to extract into microservices later
- Shared infrastructure (MongoDB, Redis, Kafka)

### System Design Patterns
- **Event Sourcing**: All state changes recorded as events
- **CQRS**: Separate read and write operations
- **Circuit Breaker**: Graceful degradation of services
- **Idempotency**: Prevent duplicate operations
- **Distributed Locking**: Prevent race conditions

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher
- **MongoDB** 4.0+ (with replica set for transactions)
- **Redis** 6.x or higher
- **Apache Kafka** 2.8+ (with Zookeeper)

### Quick Setup with Docker (Recommended)

```bash
# Start all services with Docker Compose
docker-compose up -d
```

### Manual Setup

#### MongoDB
```bash
# macOS (with Homebrew)
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Enable replica set (required for transactions)
mongosh
> rs.initiate()
```

#### Redis
```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis
```

#### Kafka
```bash
# macOS
brew install kafka
brew services start zookeeper
brew services start kafka
```

## 🚀 Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/fintech-api.git
cd fintech-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
# Copy example env file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

4. **Generate secrets**
```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## ⚙️ Configuration

### Environment Variables

Edit the `.env` file with your configuration:

```env
# Application
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/fintech_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka
KAFKA_BROKERS=localhost:9092

# JWT (use generated secrets)
JWT_ACCESS_SECRET=your-generated-secret-here
JWT_REFRESH_SECRET=your-generated-secret-here

# Email (Resend)
RESEND_API_KEY=your-resend-api-key

# Other configurations...
```

See `.env.example` for all available options.

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```
Server will start with hot-reload enabled.

### Production Mode
```bash
npm start
```

### Check Health
```bash
# Basic health check
curl http://localhost:5000/health

# Detailed health check (all services)
curl http://localhost:5000/health/detailed
```

## 📁 Project Structure

```
fintech-api/
├── src/
│   ├── config/                 # Configuration files
│   │   └── index.js           # Central config
│   │
│   ├── modules/               # Feature modules (domain-driven)
│   │   ├── auth/             # Authentication & authorization
│   │   ├── users/            # User management
│   │   ├── accounts/         # Account operations
│   │   ├── transactions/     # Transaction processing
│   │   ├── payments/         # Payment integrations
│   │   ├── notifications/    # Email/SMS notifications
│   │   └── compliance/       # KYC/AML
│   │
│   ├── shared/               # Shared utilities
│   │   ├── middleware/       # Express middleware
│   │   ├── utils/           # Utility functions
│   │   │   ├── idGenerator.js    # Universal ID generator
│   │   │   └── logger.js         # Winston logger
│   │   ├── constants/       # App constants
│   │   ├── types/           # Type definitions
│   │   └── validators/      # Input validators
│   │
│   ├── infrastructure/       # External services
│   │   ├── database/        # MongoDB connection
│   │   ├── cache/           # Redis connection
│   │   ├── queue/           # Job queues
│   │   └── events/          # Kafka events
│   │
│   ├── app.js               # Express app
│   └── server.js            # Server startup
│
├── tests/                    # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── logs/                     # Application logs
├── scripts/                  # Utility scripts
├── docs/                     # Documentation
│
├── .env                      # Environment variables (gitignored)
├── .env.example             # Example env file
├── .gitignore
├── package.json
└── README.md
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Health Endpoints

#### GET /health
Basic health check

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-03-18T10:30:00.000Z",
  "uptime": 3600
}
```

#### GET /health/detailed
Detailed system health

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-03-18T10:30:00.000Z",
  "uptime": 3600,
  "services": {
    "mongodb": {
      "isConnected": true,
      "readyState": 1,
      "host": "localhost",
      "name": "fintech_db"
    },
    "redis": {
      "isConnected": true,
      "uptime": "3600",
      "connectedClients": "2",
      "usedMemory": "1.5MB"
    },
    "kafka": {
      "isConnected": true,
      "hasProducer": true,
      "activeConsumers": 3
    }
  }
}
```

### Authentication Endpoints
(Coming in Phase 2)

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Run Specific Tests
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration
```

## 🚢 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets
- [ ] Enable MongoDB replica set
- [ ] Configure Redis persistence
- [ ] Set up Kafka cluster
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerts
- [ ] Configure automated backups
- [ ] Review all environment variables
- [ ] Set up CI/CD pipeline

### Docker Deployment
```bash
# Build image
docker build -t fintech-api .

# Run container
docker run -p 5000:5000 --env-file .env fintech-api
```

## 🎓 System Design Concepts

This project demonstrates several important system design concepts:

### 1. **Modular Monolith**
- Organized by domain, not technical layers
- Easy to understand and maintain
- Can be split into microservices when needed

### 2. **Event-Driven Architecture**
- Decoupled services via Kafka
- Async processing for better performance
- Complete audit trail

### 3. **Universal User ID**
- Single ID tracks users across all services
- Easy to correlate user activities
- Simplifies analytics and debugging

### 4. **Idempotency**
- Prevent duplicate transactions
- Use idempotency keys for critical operations
- Safe retries

### 5. **Circuit Breaker Pattern**
- Graceful degradation
- Prevent cascading failures
- Quick recovery

### 6. **Connection Pooling**
- Reuse database connections
- Better performance
- Lower resource usage

### 7. **Caching Strategy**
- Redis for frequently accessed data
- Reduce database load
- Faster response times

### 8. **Graceful Shutdown**
- Clean up resources before exit
- Finish pending requests
- Prevent data loss

## 📖 Learning Resources

- [MongoDB Transactions](https://docs.mongodb.com/manual/core/transactions/)
- [Redis Best Practices](https://redis.io/topics/best-practices)
- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [System Design Primer](https://github.com/donnemartin/system-design-primer)

## 🤝 Contributing

This is a learning project, but contributions are welcome!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

الحمد لله (Alhamdulillah) - All praise is due to Allah

---

**Built with ❤️ for learning and production use**

For questions or support, please open an issue on GitHub.