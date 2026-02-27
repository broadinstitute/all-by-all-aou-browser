# Cloud Run Infrastructure

Terraform configuration for deploying axaou-rust to Google Cloud Run.

## Architecture

- **Frontend**: Node.js SSR app serving the React UI
- **Backend**: Rust axaou-server providing the API
- **Database**: ClickHouse running on `clickhouse-vm` (managed separately)

Both services run on Cloud Run with VPC access to the `large-vm-network` for ClickHouse connectivity.

## Prerequisites

1. GCP authentication: `gcloud auth application-default login`
2. Docker authenticated: `gcloud auth configure-docker us-central1-docker.pkg.dev`
3. Terraform installed: `brew install terraform`

## Deployment

Use the root-level deploy script:

```bash
# Deploy to dev
./deploy.sh dev

# Or use make
make deploy-dev
```

## Manual Terraform Operations

```bash
cd infra/cloud-run

# Initialize (first time only)
terraform init

# Plan changes
terraform plan -var="env=dev"

# Apply changes
terraform apply -var="env=dev"

# View outputs
terraform output
```

## Configuration

See `variables.tf` for configurable options:
- `env`: Environment name (dev, prod)
- `min_instances`: Minimum Cloud Run instances (default 0)
- `max_instances`: Maximum Cloud Run instances (default 5)

## State

Terraform state is stored in GCS bucket `axaou-browser-tf` under prefix `tf/cloud-run`.
