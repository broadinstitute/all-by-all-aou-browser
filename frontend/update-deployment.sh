#!/bin/bash

set -e

usage() {
	echo "Usage: $0 [--env dev|main|both]"
	exit 1
}

env_to_update="both"

while [[ "$#" -gt 0 ]]; do
	case $1 in
	--env)
		env_to_update="$2"
		shift
		;;
	*) usage ;;
	esac
	shift
done

./build.sh

docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/demorepo/kgdocker/axaou-ui:latest .

docker push us-central1-docker.pkg.dev/demorepo/kgdocker/axaou-ui:latest

if [[ "$env_to_update" == "dev" || "$env_to_update" == "both" ]]; then
	cd "$(dirname "$0")/../../infra/axaou-infrastructure/environments/dev/"
	terraform plan -out=plan.tfplan && terraform apply plan.tfplan
fi

if [[ "$env_to_update" == "main" || "$env_to_update" == "both" ]]; then
	cd "$(dirname "$0")/../../infra/axaou-infrastructure/environments/main/"
	terraform plan -out=plan.tfplan && terraform apply plan.tfplan
fi
