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
# Deploy to dev using the tracked safe defaults
./deploy.sh dev

# Use ignored local overrides when needed
cp infra/cloud-run/dev.tfvars.example infra/cloud-run/dev.tfvars
$EDITOR infra/cloud-run/dev.tfvars
./deploy.sh dev

# Or point to an explicit variables file
TFVARS_FILE=/secure/path/dev.tfvars ./deploy.sh dev
```

## Manual Terraform Operations

```bash
cd infra/cloud-run

# Initialize (first time only)
terraform init

# Plan changes from tracked safe defaults
terraform plan -var-file=dev.tfvars.example

# Apply only after reviewing the plan
terraform apply -var-file=dev.tfvars.example

# View outputs
terraform output
```

## Configuration

See `variables.tf` for configurable options. The tracked
`dev.tfvars.example` and `prod.tfvars.example` files provide deployable,
non-secret defaults. Local `*.tfvars` overrides remain ignored.

- `env`: Environment name (dev, prod)
- `min_instances`: Minimum Cloud Run instances (manifest default 1; dev example 0)
- `max_instances`: Maximum Cloud Run instances (default 5)

## State

Terraform state is stored in GCS bucket `axaou-browser-tf` under prefix `tf/cloud-run`.
