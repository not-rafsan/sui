#!/bin/sh
# Run Prisma DB push to ensure tables exist (SQLite auto-creates file)
npx prisma db push --skip-generate --accept-data-loss 2>&1
echo "[Startup] Database ready"
# Start the app
exec node server.js