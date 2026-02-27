#!/bin/bash
#
# deploy.sh - One-command deployment for axaou-rust to Cloud Run
#
# Usage: ./deploy.sh [dev|prod] [--frontend-only]
#
# This script:
# 1. Ensures Artifact Registry exists (terraform apply -target)
# 2. Builds the frontend (webpack)
# 3. Builds and pushes Docker images to Artifact Registry
# 4. Deploys to Cloud Run via Terraform
#
# Options:
#   --frontend-only   Skip backend build (much faster)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Parse arguments
FRONTEND_ONLY=false
ENV="dev"

for arg in "$@"; do
    case $arg in
        --frontend-only)
            FRONTEND_ONLY=true
            ;;
        dev|prod)
            ENV="$arg"
            ;;
    esac
done
PROJECT_ID="aou-neale-gwas-browser"
REGION="us-central1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/axaou"
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
# Push to :latest - Terraform uses docker provider to detect digest changes
FRONTEND_IMAGE="${REGISTRY}/axaou-frontend:latest"
BACKEND_IMAGE="${REGISTRY}/axaou-backend:latest"
DEPLOY_SA="axaou-deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==================================="
echo "Deploying axaou-rust to Cloud Run"
echo "Environment: ${ENV}"
echo "Frontend only: ${FRONTEND_ONLY}"
echo "Registry: ${REGISTRY}"
echo "==================================="

# Check prerequisites
if ! command -v docker &> /dev/null; then
    echo "Error: docker is not installed"
    exit 1
fi

if ! command -v terraform &> /dev/null; then
    echo "Error: terraform is not installed"
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud is not installed"
    exit 1
fi

# Step 0: Initialize terraform and ensure Artifact Registry exists
echo ""
echo ">>> Initializing Terraform..."
cd infra/cloud-run

if [ ! -d ".terraform" ]; then
    terraform init
fi

echo ">>> Ensuring APIs and Artifact Registry exist..."
terraform apply \
    -target=google_project_service.cloudbuild \
    -target=google_project_service.run \
    -target=google_project_service.artifactregistry \
    -target=google_artifact_registry_repository.axaou \
    -auto-approve -var="env=${ENV}"

cd "$SCRIPT_DIR"

# Ensure Docker is authenticated for Artifact Registry
echo ""
echo ">>> Authenticating Docker with Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# Step 1: Build frontend
echo ""
echo ">>> Building frontend..."
cd frontend
./build.sh
cd ..

# Step 2: Build and push frontend Docker image
echo ""
echo ">>> Building frontend Docker image..."
docker build --platform linux/amd64 \
    -t "${FRONTEND_IMAGE}" \
    -f frontend/Dockerfile \
    frontend/

echo ">>> Pushing frontend Docker image..."
docker push "${FRONTEND_IMAGE}"

# Step 3: Build and push backend Docker image (skip if --frontend-only)
if [ "$FRONTEND_ONLY" = false ]; then
    echo ""
    echo ">>> Building backend Docker image with Cloud Build..."

    # Cloud Build fetches hail-decoder from git during cargo build
    # Use --async to avoid VPC-SC log streaming issues, then poll for completion
    BUILD_OUTPUT=$(gcloud builds submit axaou-server \
        --tag "${BACKEND_IMAGE}" \
        --project "${PROJECT_ID}" \
        --timeout=20m \
        --machine-type=e2-highcpu-8 \
        --impersonate-service-account="${DEPLOY_SA}" \
        --async \
        --format='value(id)')

    BUILD_ID="${BUILD_OUTPUT}"
    echo ">>> Cloud Build started: ${BUILD_ID}"
    echo ">>> Logs: https://console.cloud.google.com/cloud-build/builds/${BUILD_ID}?project=${PROJECT_ID}"

    # Poll for build completion
    echo ">>> Waiting for build to complete..."
    while true; do
        STATUS=$(gcloud builds describe "${BUILD_ID}" \
            --project="${PROJECT_ID}" \
            --impersonate-service-account="${DEPLOY_SA}" \
            --format='value(status)' 2>/dev/null)

        case "${STATUS}" in
            SUCCESS)
                echo ">>> Build completed successfully!"
                break
                ;;
            FAILURE|TIMEOUT|CANCELLED|EXPIRED)
                echo ">>> Build failed with status: ${STATUS}"
                exit 1
                ;;
            *)
                echo -n "."
                sleep 10
                ;;
        esac
    done
else
    echo ""
    echo ">>> Skipping backend build (--frontend-only)"
fi

# Step 4: Deploy with Terraform
echo ""
echo ">>> Deploying to Cloud Run with Terraform..."
cd infra/cloud-run

echo ">>> Running Terraform plan..."
terraform plan -var="env=${ENV}" -out=plan.tfplan

echo ">>> Applying Terraform plan..."
terraform apply plan.tfplan

# Clean up plan file
rm -f plan.tfplan

# Show outputs
echo ""
echo "==================================="
echo "Deployment complete!"
echo "==================================="
echo "Git SHA: ${GIT_SHA}"
terraform output

echo ""
echo "Frontend URL: $(terraform output -raw frontend_url)"

cd "$SCRIPT_DIR"
