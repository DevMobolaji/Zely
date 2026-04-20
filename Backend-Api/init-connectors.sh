#!/bin/bash

set -a
source /home/beejay/Beejay/Zely/Backend-Api/.env
set +a

CONNECTOR_NAME="mongo-outbox-connector"
DEBEZIUM_URL="http://localhost:8083/connectors"
CONFIG_FILE="/tmp/mongo-outbox-connector.json"

echo "⏳ Waiting for Debezium to be ready..."
until curl -s -o /dev/null -w "%{http_code}" "$DEBEZIUM_URL" | grep -q "200"; do
  sleep 2
done
echo "✅ Debezium is ready!"

# Delete existing connector if present
echo "🗑️  Deleting existing connector..."
curl -s -X DELETE "$DEBEZIUM_URL/$CONNECTOR_NAME" > /dev/null
echo "✅ Deleted"

# Write connector config to a clean temp file
cat > "$CONFIG_FILE" << ENDJSON
{
  "name": "mongo-outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.mongodb.MongoDbConnector",
    "mongodb.connection.string": "mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0&authSource=admin",
    "mongodb.name": "zely_app_cluster",
    "topic.prefix": "outbox",
    "database.include.list": "zely_app",
    "collection.include.list": "zely_app.outboxevents",
    "capture.mode": "change_streams_update_full",
    "snapshot.mode": "never",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.connector.mongodb.transforms.ExtractNewDocumentState",
    "transforms.unwrap.drop.tombstones": "false",
    "transforms.unwrap.delete.handling.mode": "drop",
    "transforms.unwrap.sanitize.field.names": "false",
    "key.converter": "org.apache.kafka.connect.storage.StringConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter.schemas.enable": "false",
    "errors.tolerance": "none",
    "errors.log.enable": "true",
    "errors.log.include.messages": "true"
  }
}
ENDJSON

echo "🔌 Registering $CONNECTOR_NAME..."

RESPONSE=$(curl -s \
  -o /tmp/debezium_response.json \
  -w "%{http_code}" \
  -X POST "$DEBEZIUM_URL" \
  -H "Content-Type: application/json" \
  -d @"$CONFIG_FILE")

if [ "$RESPONSE" = "201" ]; then
  echo "✅ Connector registered successfully!"
  cat /tmp/debezium_response.json
else
  echo "❌ Failed (HTTP $RESPONSE)"
  cat /tmp/debezium_response.json
  exit 1
fi