#!/bin/bash

BASE_PATH=$(pwd)

cd "${BASE_PATH}/daemon"
pnpm install

cd "${BASE_PATH}/web"
pnpm install
