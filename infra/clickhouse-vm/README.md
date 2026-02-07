# ClickHouse VM

ClickHouse database VM for the axaou data store.

## Deploy

```bash
cd infra/clickhouse-vm
terraform init
terraform apply
```

## Connect

SSH tunnel for local access:
```bash
gcloud compute ssh --tunnel-through-iap clickhouse-vm -- -N -L 8123:127.0.0.1:8123 -L 9000:127.0.0.1:9000
```

Then connect:
```bash
# HTTP interface
curl http://localhost:8123/

# CLI (on VM)
gcloud compute ssh --tunnel-through-iap clickhouse-vm
ch  # alias for clickhouse-client
```

## Configuration

- **Machine**: n2-highmem-8 (8 vCPUs, 64GB RAM)
- **Data disk**: 500GB SSD mounted at `/data`
- **ClickHouse data**: `/data/clickhouse/`
- **Ports**: 8123 (HTTP), 9000 (native)

## Load Data

From the VM:
```bash
# Download parquet from GCS
gsutil cp gs://axaou-central-tmp/manhattans/height17/exome_significant.parquet /data/

# Load into ClickHouse
clickhouse-client --query "INSERT INTO significant_variants FROM INFILE '/data/exome_significant.parquet' FORMAT Parquet"
```
