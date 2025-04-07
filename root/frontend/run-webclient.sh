#!/bin/bash

git fetch
git pull
pnpm update
echo "building..."
cd dacroq_web
pnpm build --no-lint
echo "running"
pnpm start