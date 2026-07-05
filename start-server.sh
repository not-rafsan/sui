#!/bin/bash
cd /home/z/my-project
rm -rf .next/cache
while true; do
  echo "[$(date)] Starting Next.js dev server..."
  npx next dev -p 3000 2>&1 | tee -a /tmp/next-dev.log
  echo "[$(date)] Server exited. Restarting in 3s..."
  sleep 3
done
