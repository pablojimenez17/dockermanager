#!/bin/sh
# EveBox 0.24.x: server + agent (busybox-compatible)

echo "[EveBox] Starting server (SQLite mode)..."
evebox server --no-auth -D /var/lib/evebox --datastore sqlite &
SERVER_PID=$!

echo "[EveBox] Waiting 5s for server to bind port 5636..."
sleep 5

# Verify server is still alive
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "[EveBox] ERROR: Server crashed at startup!"
    exit 1
fi
echo "[EveBox] Server is up (PID $SERVER_PID)"

echo "[EveBox] Starting agent (file reader)..."
evebox agent \
  --server http://localhost:5636 \
  --data-directory /var/lib/evebox \
  /var/log/suricata/eve.json &
AGENT_PID=$!
echo "[EveBox] Agent started (PID $AGENT_PID)"

# Keep container alive and restart agent if it dies
while true; do
    sleep 30
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "[EveBox] Server died — exiting."
        exit 1
    fi
    if ! kill -0 $AGENT_PID 2>/dev/null; then
        echo "[EveBox] Agent died — restarting..."
        evebox agent \
          --server http://localhost:5636 \
          --data-directory /var/lib/evebox \
          /var/log/suricata/eve.json &
        AGENT_PID=$!
        echo "[EveBox] Agent restarted (PID $AGENT_PID)"
    fi
done
