#!/bin/bash
# End-to-end test: hive + minion + curl (controller)
# Run from packages/hive/

set -e

HIVE_PORT=8080
MINION_PORT=18791
HIVE_DIR="$(cd "$(dirname "$0")" && pwd)"
MINION_DIR="$(cd "$HIVE_DIR/../minion" && pwd)"

echo "=== Starting Hive on port $HIVE_PORT ==="
cd "$HIVE_DIR"
npx tsx src/index.ts &
HIVE_PID=$!
sleep 2

echo ""
echo "=== Step 1: Register a minion device via REST ==="
REGISTER_RESULT=$(curl -s -X POST http://localhost:$HIVE_PORT/api/devices \
  -H "Content-Type: application/json" \
  -d '{"id":"test-minion","name":"Test Minion","type":"minion"}')
echo "$REGISTER_RESULT"

# Extract API key
API_KEY=$(echo "$REGISTER_RESULT" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
echo "Extracted API key: $API_KEY"

echo ""
echo "=== Step 2: Start minion with hive connection ==="
cd "$MINION_DIR"

# Create temp config for the minion
cat > /tmp/test-minion-config.json <<EOF
{
  "hiveUrl": "ws://localhost:$HIVE_PORT",
  "apiKey": "$API_KEY",
  "deviceName": "test-minion",
  "tags": ["test"],
  "allowedOps": ["exec", "read", "write", "http"],
  "workDir": "/tmp/hive-workspace",
  "localApi": { "enabled": false, "port": $MINION_PORT, "bind": "127.0.0.1" },
  "maxOutputBytes": 10485760
}
EOF

npx tsx src/index.ts --config /tmp/test-minion-config.json &
MINION_PID=$!
sleep 2

echo ""
echo "=== Step 3: Check devices (should show test-minion as online) ==="
curl -s http://localhost:$HIVE_PORT/api/devices | python3 -m json.tool

echo ""
echo "=== Step 4: Send a task via REST (controller role) ==="
TASK_RESULT=$(curl -s -X POST http://localhost:$HIVE_PORT/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"targetDevice":"test-minion","instruction":{"type":"exec","command":"echo hello from the hive && whoami"}}')
echo "$TASK_RESULT"

TASK_ID=$(echo "$TASK_RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Task ID: $TASK_ID"

# Wait for execution
sleep 2

echo ""
echo "=== Step 5: Get task result ==="
curl -s http://localhost:$HIVE_PORT/api/tasks/$TASK_ID | python3 -m json.tool

echo ""
echo "=== Cleanup ==="
kill $MINION_PID 2>/dev/null || true
kill $HIVE_PID 2>/dev/null || true
rm -f /tmp/test-minion-config.json
echo "Done!"
