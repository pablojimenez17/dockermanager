#!/bin/sh
# EveBox 0.24.x: server + agent must run together for file ingestion
set -e

echo "[EveBox] Starting server (SQLite mode)..."
evebox server --no-auth -D /var/lib/evebox --datastore sqlite &
SERVER_PID=$!

# Wait for server to be ready
sleep 3

echo "[EveBox] Starting agent (file reader)..."
evebox agent \
  --server http://localhost:5636 \
  --data-directory /var/lib/evebox \
  /var/log/suricata/eve.json &
AGENT_PID=$!

echo "[EveBox] Server PID: $SERVER_PID | Agent PID: $AGENT_PID"

# Exit if either process dies
wait -n $SERVER_PID $AGENT_PID
