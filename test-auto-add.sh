#!/bin/bash

# Local test script for auto-add
# This reads from .env.local and runs the script

if [ ! -f .env.local ]; then
    echo "Error: .env.local not found!"
    echo ""
    echo "Create .env.local with:"
    echo "REAL_DEBRID_API_KEY=your-key-here"
    echo "TRAKT_CLIENT_ID=your-trakt-client-id"
    exit 1
fi

# Load environment variables from .env.local
export $(cat .env.local | grep -v '^#' | xargs)

# Run the script
node scripts/auto-add-quality.js
