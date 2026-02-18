// src/database/runMigrations.ts

import { MongoClient } from "mongodb"
import { up as addLedgerValidator } from "./migrations/001-add-ledger-validator.migration"
import { config } from "../config"

async function run() {
  const client = new MongoClient(config.database.mongodb.uri!)
  await client.connect()
  console.log("MongoDB connected"
  )

  const db = client.db()

  await addLedgerValidator(db)

  await client.close()
}

run()
