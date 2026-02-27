#!/bin/bash
#
# deploy.sh - One-command deployment for axaou-rust to Cloud Run
#
# Usage: ./deploy.sh [dev|prod]
#
# This script:
# 1. Ensures Artifact Registry exists (terraform apply -target)
# 2. Builds the frontend (webpack)
# 3. Builds and pushes Docker images to Artifact Registry
# 4. Deploys to Cloud Run via Terraform
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
ENV="${1:-dev}"
PROJECT_ID="aou-neale-gwas-browser"
REGION="us-central1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/axaou"
# Use git SHA for unique image tags (forces Cloud Run to redeploy)
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
FRONTEND_IMAGE="${REGISTRY}/axaou-frontend:${GIT_SHA}"
BACKEND_IMAGE="${REGISTRY}/axaou-backend:${GIT_SHA}"
DEPLOY_SA="axaou-deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==================================="
echo "Deploying axaou-rust to Cloud Run"
echo "Environment: ${ENV}"
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

# Step 3: Build and push backend Docker image
echo ""
echo ">>> Building backend Docker image with Cloud Build..."

# Cloud Build fetches hail-decoder from git during cargo build
gcloud builds submit axaou-server \
    --tag "${BACKEND_IMAGE}" \
    --project "${PROJECT_ID}" \
    --timeout=20m \
    --machine-type=e2-highcpu-8 \
    --impersonate-service-account="${DEPLOY_SA}"

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

cd "$SCRIPT_DIR"

# Step 5: Force Cloud Run to use the new images
echo ""
echo ">>> Updating Cloud Run services with new images..."
gcloud run services update "axaou-backend-${ENV}" \
    --image="${BACKEND_IMAGE}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --quiet

gcloud run services update "axaou-app-${ENV}" \
    --image="${FRONTEND_IMAGE}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --quiet

# Show outputs
echo ""
echo "==================================="
echo "Deployment complete!"
echo "==================================="
echo "Images deployed: ${GIT_SHA}"
terraform output

echo ""
echo "Frontend URL: $(terraform output -raw frontend_url)"
