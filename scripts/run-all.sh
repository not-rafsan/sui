#!/bin/bash
# Start both daemon and server
cd /home/z/my-project

# Start daemon in background
node scripts/ig-poster-daemon.js > /tmp/ig-daemon.log 2>&1 &
DAEMON_PID=$!
echo "Daemon PID: $DAEMON_PID"

# Start server in background
npx next dev -p 3000 > /tmp/next-dev.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for either to exit
wait -n $DAEMON_PID $SERVER_PID 2>/dev/null
echo "One process exited. Restarting..."
sleep 3
exec bash /home/z/my-project/scripts/run-all.sh