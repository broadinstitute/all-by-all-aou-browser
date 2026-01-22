#!/bin/bash

set -eu

if [ -f .env ]; then
	export $(grep -v '^#' .env | xargs)
fi

PROJECT_DIR=$(dirname "${BASH_SOURCE}")
cd $PROJECT_DIR

export PATH=$PATH:$PROJECT_DIR/node_modules/.bin

export NODE_ENV=development

DEFAULT_PYTHON_API_HOST=https://allbyall.researchallofus.org
export PYTHON_API_HOST=${PYTHON_API_HOST:-$DEFAULT_PYTHON_API_HOST}

DEFAULT_PYTHON_API_PATH=/api
export PYTHON_API_PATH=${PYTHON_API_PATH:-$DEFAULT_PYTHON_API_PATH}

DEFAULT_PORT=8000
WEBPACK_DEV_SERVER_PORT=${2:-$DEFAULT_PORT}
export PORT=$(expr $WEBPACK_DEV_SERVER_PORT + 10)

rm -rf "dist"

# Bundle server once before starting nodemon
pnpm webpack --config=webpack.config.server.js

pnpm webpack serve --config=./webpack.config.client.js --hot --port $WEBPACK_DEV_SERVER_PORT &
PID[0]=$!

pnpm webpack --config=webpack.config.server.js --watch &
PID[1]=$!

nodemon dist/server.js &
PID[2]=$!

trap "kill ${PID[0]} ${PID[1]} ${PID[2]}; exit 1" INT

wait
