#!/bin/bash

echo "building..."
cd dacroq_web
pnpm built --no-lint
echo "running"
pnpm start