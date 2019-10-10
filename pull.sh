#!/usr/bin/env bash

git pull
export NPMRC=`cat .npmrc`
docker-compose build
docker-compose down
docker-compose up -d
