#!/bin/bash
cd /home/z/my-project
rm -rf .next/cache
mkdir -p temp/ig-queue/pending temp/ig-queue/done

# Start the IG posting daemon (separate process, won't crash Next.js)
node scripts/ig-poster-daemon.js > /tmp/ig-daemon.log 2>&1 &
DAEMON_PID=$!

while true; do
  echo "[$(date)] Starting Next.js dev server..."
  npx next dev -p 3000 2>&1 | tee -a /tmp/next-dev.log
  echo "[$(date)] Server exited. Restarting in 3s..."
  # Check daemon is still alive
  if ! kill -0 $DAEMON_PID 2>/dev/null; then
    echo "[$(date)] Restarting daemon too..."
    node scripts/ig-poster-daemon.js > /tmp/ig-daemon.log 2>&1 &
    DAEMON_PID=$!
  fi
  sleep 3
done