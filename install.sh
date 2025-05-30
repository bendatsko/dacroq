#!/bin/bash

BASE_PATH=$(pwd)

# need to add 
    # sudo apt-get install nodejs 
    # npm install -g pnpm

sudo apt-get install nodejs 
sudo apt-get install npm
sudo apt-get install python3
npm install -g pnpm

cd "${BASE_PATH}/daemon"
pnpm install

cd "${BASE_PATH}/web"
pnpm install
