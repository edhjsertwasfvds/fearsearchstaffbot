#!/bin/bash
set -e

if [ -n "$DISCORD_TOKEN" ]; then
    echo "Starting FearSearch Bot (Python)..."
    exec python bot.py
else
    echo "Starting FearSearch Site (Node.js)..."
    cd VibeCodingBdd
    exec node src/server.js
fi
