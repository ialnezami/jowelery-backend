#!/bin/sh
set -e

echo "Running database seed..."
node dist/prisma/seed.js && echo "Seed complete." || echo "Seed skipped (already seeded or non-fatal error)."

echo "Starting server..."
exec node dist/main
