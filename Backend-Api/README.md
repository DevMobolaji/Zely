# Zely

A robust, crash-resistant, and production-grade fintech backend built with Node.js, TypeScript, MongoDB, Redis, Kafka, and Debezium. Zely is built around distributed systems best practices — transactional outbox, CDC-based event streaming, two-phase idempotency, and composable circuit breakers — with every core pattern designed to be reusable and app-agnostic.

> الحمد لله — All praise is due to Allah

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [System Design Patterns](#-system-design-patterns)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Roadmap](#-roadmap)

---

## ✨ Features

- 🔐 **Secure Authentication** — JWT-based auth with refresh tokens and 2FA support
- 💳 **Account Management** — Multiple account types with balance tracking and full audit trail
- 💸 **Transactions** — Transfers, payments, and refunds with exactly-once guarantees
- 📬 **Transactional Outbox** — Atomic event publishing via MongoDB outbox + Debezium CDC
- 🔄 **Event-Driven Architecture** — Kafka for async, durable event streaming
- 🛡️ **Idempotent Consumers** — Two-phase `PROCESSING → COMPLETED` state machine prevents duplicate processing
- ⚡ **Circuit Breakers** — Cockatiel-powered fault tolerance across all external dependencies
- 📊 **Caching & Distributed Locking** — Redis for idempotency locks and hot-path caching
- 🌐 **Universal User ID** — Single ID tracks users across all services
- 📝 **Comprehensive Logging** — Winston-based audit trail for compliance
- 🔍 **Device & Session Tracking** — Monitor user devices and active sessions
- 🛑 **Graceful Shutdown** — Clean disconnect with `Promise.race` timeout safety net
- 🚦 **Consumer-Ready Guard** — Middleware blocks writes during Kafka rebalance

---

## 🛠 Tech Stack

### Core
| | |
|---|---|
| Runtime | Node.js 18+ |
| Language | TypeScript |
| Framework | Express.js |

### Database & Storage
| | |
|---|---|
| Primary Database | MongoDB 6+ (replica set — required for transactions and CDC) |
| Cache / Locks | Redis with ioredis |
| Event Streaming | Apache Kafka with KafkaJS |
| CDC | Debezium (monitors MongoDB oplog, publishes to Kafka) |
| Job Queue | BullMQ |

### Reliability
| | |
|---|---|
| Circuit Breaker | Cockatiel (composable retry + timeout + circuit breaker policies) |
| Idempotency | Two-phase Redis lock + MongoDB atomic state machine |
| Outbox Pattern | MongoDB transactional outbox → Debezium → Kafka |

### Services & Security
| | |
|---|---|
| Email | Resend |
| SMS | Twilio (optional) |
| Authentication | JWT (jsonwebtoken) |
| Password Hashing | bcrypt |
| Security Headers | Helmet |
| Rate Limiting | express-rate-limit with Redis store |
| Input Sanitization | express-mongo-sanitize |

### Logging & Monitoring
| | |
|---|---|
| Logger | Winston with daily file rotation |
| HTTP Logging | Morgan |

---

## 🏗 Architecture

Zely follows a **modular monolith** — single codebase, single deployment, organized by domain. Each domain is self-contained and can be extracted into a microservice independently.

```
Client Request
     │
     ▼
Express API
(requireConsumerReady middleware — blocks writes during Kafka rebalance)
     │
     ▼
MongoDB Replica Set ──► Outbox Collection (written in same transaction)
                               │
                          Debezium CDC
                          (monitors oplog)
                               │
                               ▼
                          Kafka Topic
                               │
                    ┌──────────┘
                    ▼
              KafkaJS Consumer
              (two-phase idempotency: PROCESSING → COMPLETED)
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    BullMQ Queue          Redis Cache
    (workers: email,      (idempotency
     notifications)        locks, hot data)
         │
         ▼
    Resend / External APIs
    (all calls wrapped with Cockatiel circuit breaker)
```

All external calls — MongoDB, Kafka, Redis, Resend — pass through a reusable Cockatiel circuit breaker wrapper, providing consistent retry, timeout, and half-open recovery behaviour across the entire app.

---

## 📦 Prerequisites

- Node.js 18.x or higher
- Docker (recommended — starts all infrastructure in one command)
- MongoDB running as a **replica set** (required for transactions and Debezium change streams)
- Apache Kafka + Zookeeper
- Redis 6.x or higher
- Debezium Connect

### Quick Setup with Docker (Recommended)

```bash
docker-compose up -d
```

This starts MongoDB (replica set), Kafka, Zookeeper, Debezium Connect, and Redis.

### Manual Setup

**MongoDB (replica set)**
```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

mongosh
> rs.initiate()
```

**Redis**
```bash
# macOS
brew install redis && brew services start redis

# Linux
sudo apt-get install redis-server && sudo systemctl start redis
```

**Kafka**
```bash
# macOS
brew install kafka
brew services start zookeeper
brew services start kafka
```

---

## 🚀 Installation

```bash
# 1. Clone
git clone https://github.com/your-org/zely.git
cd zely

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
nano .env

# 4. Generate secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## ⚙️ Configuration

```env
# App
NODE_ENV=development
PORT=3000

# MongoDB (replica set required)
MONGO_URI=mongodb://localhost:27017/zely?replicaSet=rs0

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=zely-consumer-group

# JWT (use generated secrets)
JWT_ACCESS_SECRET=your-generated-secret-here
JWT_REFRESH_SECRET=your-generated-secret-here

# Email
RESEND_API_KEY=re_xxxxxxxxxxxx

# SMS (optional)
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
```

See `.env.example` for all available options.

---

## 🏃 Running the Application

**Development (with hot reload)**
```bash
npm run dev
```

Nodemon restarts on file changes. Each run gets a unique Kafka `clientId` (via `uuidv4()`) to avoid session conflicts during rapid restarts before the previous session expires.

**Production**
```bash
npm run build
npm start
```

**Health Checks**
```bash
# Basic
curl http://localhost:3000/health

# Detailed (all services)
curl http://localhost:3000/health/detailed
```

---

## 📁 Project Structure

```
src/
├── config/                  # Kafka, MongoDB, Redis client setup
│
├── modules/                 # Feature modules (domain-driven)
│   ├── auth/               # Authentication & authorization
│   ├── users/              # User management
│   ├── accounts/           # Account operations
│   ├── transactions/       # Transaction processing
│   ├── payments/           # Payment integrations
│   ├── notifications/      # Email/SMS notifications
│   └── compliance/         # KYC/AML
│
├── consumers/               # KafkaJS consumers (idempotency logic)
├── outbox/                  # Outbox write helpers + Debezium transformer
├── queues/                  # BullMQ queue definitions and workers
│
├── shared/
│   ├── middleware/          # requireConsumerReady, auth guards, rate limiting
│   ├── utils/
│   │   ├── circuitBreaker.ts   # Reusable Cockatiel wrapper
│   │   ├── retryOrDLQ.ts       # Kafka retry / dead-letter logic
│   │   ├── shutdown.ts         # Graceful shutdown orchestration
│   │   ├── idGenerator.ts      # Universal ID generator
│   │   └── logger.ts           # Winston logger
│   ├── constants/
│   ├── types/
│   └── validators/
│
├── infrastructure/
│   ├── database/            # MongoDB connection
│   ├── cache/               # Redis connection
│   ├── queue/               # BullMQ setup
│   └── events/              # Kafka setup
│
├── app.ts                   # Express app
└── server.ts                # Server entry point

tests/
├── unit/
├── integration/
└── e2e/
```

---

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Health Endpoints

**`GET /health`** — Basic health check
```json
{
  "status": "OK",
  "timestamp": "2025-01-01T10:30:00.000Z",
  "uptime": 3600
}
```

**`GET /health/detailed`** — All services
```json
{
  "status": "OK",
  "timestamp": "2025-01-01T10:30:00.000Z",
  "uptime": 3600,
  "services": {
    "mongodb": {
      "isConnected": true,
      "readyState": 1,
      "replicaSet": "rs0"
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
      "activeConsumers": 3,
      "consumerReady": true
    },
    "debezium": {
      "isConnected": true,
      "activeConnectors": 1
    }
  }
}
```

### Auth Endpoints *(Phase 2)*

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, receive access + refresh tokens |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Invalidate session |
| POST | `/auth/2fa/enable` | Enable two-factor auth (TOTP) |

### Account Endpoints *(Phase 2)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/accounts` | List user accounts |
| POST | `/accounts` | Create new account |
| GET | `/accounts/:id/balance` | Get current balance |
| GET | `/accounts/:id/transactions` | Paginated transaction history |

### Transaction Endpoints *(Phase 2)*

| Method | Endpoint | Description |
|---|---|---|
| POST | `/transactions/transfer` | Initiate transfer (idempotency key required) |
| GET | `/transactions/:id` | Get transaction status |
| POST | `/transactions/:id/refund` | Refund a transaction |

> All mutating endpoints require an `Idempotency-Key` header. This is enforced at the middleware level and guaranteed end-to-end by the two-phase consumer state machine.

---

## 🎓 System Design Patterns

### 1. Transactional Outbox + CDC
Writes to the primary collection and the outbox happen inside a single MongoDB transaction. Debezium monitors the outbox via change streams and publishes to Kafka — guaranteeing no event is lost even if the process crashes between the write and the publish.

### 2. Two-Phase Idempotency (`PROCESSING → COMPLETED`)
Kafka consumers acquire a Redis lock, transition the outbox record to `PROCESSING`, execute the operation, then transition to `COMPLETED`. Duplicate messages are detected by checking state before any work is done — safe across restarts, rebalances, and retries.

### 3. Circuit Breaker (Cockatiel)
A reusable `circuitBreaker.ts` wraps every external call with composable retry, timeout, and half-open recovery policies. Cockatiel was chosen over Opossum for its TypeScript-native API and policy composition model.

### 4. Consumer-Ready Middleware (`requireConsumerReady`)
Blocks inbound API requests (e.g. transfers) during Kafka consumer group rebalance, preventing writes from racing ahead of an unready partition assignment.

### 5. Graceful Shutdown
All `SIGTERM`/`SIGINT` signals are handled centrally. Kafka consumers and producers disconnect cleanly, BullMQ workers drain active jobs, and a `Promise.race` timeout forces exit if a dependency hangs.

### 6. Universal User ID
A single generated ID tracks users across all services and domains — simplifying event correlation, analytics, and debugging.

### 7. Event Sourcing & CQRS
All state changes are recorded as events. Read and write paths are separated for performance and compliance auditability.

### 8. Connection Pooling & Caching
Database connections are pooled and reused. Redis caches hot-path reads and serves as the idempotency lock store to prevent race conditions on concurrent requests.

---

## 🧪 Testing

```bash
# All tests
npm test

# With coverage report
npm test -- --coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests
npm run test:e2e
```

---

## 🚢 Deployment

Zely deploys to [Railway](https://railway.app) via GitHub Actions CI/CD.

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - uses: railwayapp/railway-github-action@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
```

### Production Checklist

- [ ] `NODE_ENV=production`
- [ ] Strong JWT secrets (64-byte random, not committed to git)
- [ ] MongoDB replica set enabled and healthy
- [ ] Redis persistence configured (`appendonly yes`)
- [ ] Kafka cluster (multi-broker for HA)
- [ ] Debezium connector deployed and healthy
- [ ] CORS origins locked to known domains
- [ ] SSL/TLS configured
- [ ] Rate limiting enabled on all public endpoints
- [ ] Firewall rules in place
- [ ] Consumer lag monitoring active (Kafka consumer group metrics)
- [ ] Circuit breaker state alerting configured
- [ ] Automated database backups enabled
- [ ] All secrets in Railway secrets panel
- [ ] CI/CD pipeline passing

### Docker

```bash
# Build
docker build -t zely .

# Run
docker run -p 3000:3000 --env-file .env zely
```

---

## 🗺 Roadmap

- [x] Transactional outbox pattern (EmailOutbox)
- [x] Kafka consumer idempotency (two-phase `PROCESSING → COMPLETED`)
- [x] Debezium CDC integration
- [x] Graceful shutdown with `Promise.race` timeout
- [x] `requireConsumerReady` middleware
- [ ] Cockatiel circuit breaker wrapper across all dependencies
- [ ] Full CI/CD pipeline on Railway
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Consumer lag monitoring
- [ ] 2FA (TOTP)
- [ ] KYC/AML compliance module
- [ ] Multi-region failover strategy

---

## 📖 Learning Resources

- [MongoDB Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [Debezium MongoDB Connector](https://debezium.io/documentation/reference/stable/connectors/mongodb.html)
- [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [KafkaJS Documentation](https://kafka.js.org/docs/getting-started)
- [Cockatiel — Resilience library](https://github.com/connor4312/cockatiel)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [System Design Primer](https://github.com/donnemartin/system-design-primer)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📝 License

Private — all rights reserved.
