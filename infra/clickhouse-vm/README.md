# ClickHouse VMs

ClickHouse database VMs for the axaou data store.

## Instances

| Instance | Machine | Data Disk |
|----------|---------|-----------|
| `clickhouse-vm` | n2-highmem-8 (8 vCPUs, 64GB RAM) | 500GB SSD |
| `axaou-clickhouse-1` | n2-highmem-8 (8 vCPUs, 64GB RAM) | 750GB SSD |
| `axaou-clickhouse-2` | n2-highmem-8 (8 vCPUs, 64GB RAM) | 750GB SSD |

## Deploy

```bash
cd infra/clickhouse-vm
terraform init
terraform apply
```

## Connect

SSH tunnel for current local development:
```bash
gcloud compute ssh --tunnel-through-iap axaou-clickhouse-2 -- -N -L 8123:127.0.0.1:8123 -L 9000:127.0.0.1:9000

# Or, from the repository root:
make tunnel-clickhouse
```

Use different local ports if connecting to another instance simultaneously:
```bash
gcloud compute ssh --tunnel-through-iap axaou-clickhouse-1 -- -N -L 8124:127.0.0.1:8123 -L 9001:127.0.0.1:9000
gcloud compute ssh --tunnel-through-iap clickhouse-vm -- -N -L 8125:127.0.0.1:8123 -L 9002:127.0.0.1:9000
```

Then connect:
```bash
curl http://localhost:8123/   # axaou-clickhouse-2

gcloud compute ssh --tunnel-through-iap axaou-clickhouse-2
ch  # alias for clickhouse-client
```

## Configuration

Both instances share the same configuration:
- **Machine**: n2-highmem-8 (8 vCPUs, 64GB RAM)
- **ClickHouse data**: `/data/clickhouse/`
- **Ports**: 8123 (HTTP), 9000 (native)

Data disk sizes:
- `clickhouse-vm`: 500GB SSD
- `axaou-clickhouse-1`: 750GB SSD
- `axaou-clickhouse-2`: 750GB SSD

## Load Data

From the VM:
```bash
# Download parquet from GCS
gsutil cp gs://axaou-central-tmp/manhattans/height17/exome_significant.parquet /data/

# Load into ClickHouse
clickhouse-client --query "INSERT INTO significant_variants FROM INFILE '/data/exome_significant.parquet' FORMAT Parquet"
```
