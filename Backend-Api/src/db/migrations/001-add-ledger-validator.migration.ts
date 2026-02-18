import { ledgerEntryValidator } from "db/ledgerEntry.validator"


type MongoDb = {
  command: (cmd: Record<string, unknown>) => Promise<unknown>
  listCollections: (filter: Record<string, unknown>) => {
    toArray: () => Promise<unknown[]>
  }
}

export async function up(db: MongoDb) {
  const exists = await db
    .listCollections({ name: "ledgerentries" })
    .toArray()

  if (exists.length === 0) {
    // Collection does not exist → create with validator
    await db.command({
      create: "ledgerentries",
      validator: ledgerEntryValidator,
      validationLevel: "strict",
      validationAction: "error",
    })
  } else {
    // Collection exists → modify validator
    await db.command({
      collMod: "ledgerentries",
      validator: ledgerEntryValidator,
      validationLevel: "strict",
      validationAction: "error",
    })
  }
}

export async function down(db: MongoDb) {
  await db.command({
    collMod: "ledgerentries",
    validator: {},
    validationLevel: "off",
  })
}
