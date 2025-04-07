#!/bin/bash

git fetch
git pull
go fix tidy
echo "Initializing api..."
cd api
go build
./dacroq
