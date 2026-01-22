#!/bin/bash

set -eu

PROJECT_DIR=$(dirname "${BASH_SOURCE}")
cd $PROJECT_DIR

export PATH=$PATH:$PROJECT_DIR/node_modules/.bin

if [ -f .env ]; then
	export $(grep -v '^#' .env | xargs)
fi

rm -rf dist

export NODE_ENV=${NODE_ENV:-"production"}

webpack --config=webpack.config.client.js

webpack --config=webpack.config.server.js
