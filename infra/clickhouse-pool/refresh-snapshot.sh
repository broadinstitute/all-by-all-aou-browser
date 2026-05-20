#!/bin/bash
# Refresh the ClickHouse data snapshot and rolling-restart the replica pool.
# Run this after `cargo run -- ingest` or `cargo run -- derive` to propagate
# data changes to all replicas.
#
# Usage: ./refresh-snapshot.sh

set -euo pipefail

PROJECT="aou-neale-gwas-browser"
ZONE="us-central1-a"
DISK="axaou-clickhouse-1-data-pd"
SNAP_PREFIX="axaou-clickhouse-1-data-pd-snap"
MIG="axaou-ch-pool"
TF_DIR="$(dirname "$0")"

SNAP_NAME="${SNAP_PREFIX}-$(date +%Y%m%d-%H%M)"

echo "=== Creating snapshot: ${SNAP_NAME} ==="
gcloud compute snapshots create "$SNAP_NAME" \
  --source-disk="$DISK" \
  --source-disk-zone="$ZONE" \
  --project="$PROJECT" \
  --description="Auto-snapshot after data refresh"

echo ""
echo "=== Updating Terraform snapshot_name ==="
# Update the default in variables.tf
cd "$TF_DIR"
sed -i.bak "s/default *= *\"${SNAP_PREFIX}-[0-9-]*/default = \"${SNAP_NAME}/" variables.tf
rm -f variables.tf.bak

echo ""
echo "=== Applying Terraform (new instance template + rolling restart) ==="
terraform init -input=false
terraform apply -auto-approve -var="snapshot_name=${SNAP_NAME}"

echo ""
echo "=== Done ==="
echo "New snapshot: ${SNAP_NAME}"
echo "MIG will rolling-restart replicas with the new data."
echo ""
echo "To switch Cloud Run to use the pool:"
echo "  cd ../cloud-run"
echo "  terraform apply -var='clickhouse_url_override=\$(cd ../clickhouse-pool && terraform output -raw clickhouse_url)'"
