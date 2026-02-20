# axaou-rust

Rust backend for the AxAoU browser.

## Quick Start

```bash
# Install dependencies
make install

# Start frontend + backend with hot reloading
make dev
```

This starts:
- **Backend:** http://localhost:3001 (Rust server with cargo-watch)
- **Frontend:** http://localhost:8000 (Vite dev server with HMR)

## Infrastructure Setup

### ClickHouse VM

Create a ClickHouse VM in GCP:

```bash
# Create VM (example using n2-standard-8)
gcloud compute instances create clickhouse-vm \
    --zone=<your-zone> \
    --machine-type=n2-standard-8 \
    --boot-disk-size=500GB \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud

# SSH and install ClickHouse
gcloud compute ssh clickhouse-vm --zone=<your-zone>
# Then follow ClickHouse installation docs
```

### SSH Tunnels

Forward ClickHouse to localhost for local development:

```bash
# Forward ClickHouse (port 8123)
gcloud compute ssh clickhouse-vm --zone=<your-zone> --tunnel-through-iap -- -L 8123:localhost:8123 -N

# Forward hail-decoder dashboard (port 3000)
gcloud compute ssh heavy-coordinator --zone=<your-zone> --tunnel-through-iap -- -L 3000:localhost:3000 -N
```

## Asset Discovery

Before loading phenotype data, discover available assets from GCS:

```bash
cd axaou-server

# Discover all assets and save to JSON
cargo run -- discover -o assets.json

# Filter by known phenotypes in metadata
cargo run -- discover -o assets.json --filter-by-metadata
```

Query the discovered assets:

```bash
# List all unique phenotype IDs
cargo run -- query-assets -i assets.json --ids-only

# Filter by ancestry and sequencing type
cargo run -- query-assets -i assets.json --ancestry meta --seq-type exomes

# Get URIs for specific phenotype
cargo run -- query-assets -i assets.json --analysis-id height --uris-only

# Sample 10% of phenotypes
cargo run -- query-assets -i assets.json --sample 0.1 --ids-only
```

## axaou-server

Rust binary for serving analysis metadata, gene models, and variant data via HTTP API.

### Building

```bash
cd axaou-server
cargo build --release
```

### Running

**Prerequisites:**
- Google Cloud authentication: `gcloud auth application-default login`
- ClickHouse running on localhost:8123 (or SSH tunnel)

```bash
# Development with hot reloading (recommended)
make dev

# Or run manually
cd axaou-server
cargo run -- serve --port 3001

# With debug logging
RUST_LOG=debug cargo run -- serve
```

### API

**GET /api/analyses**

Returns analysis metadata as JSON array.

Query parameters:
- `ancestry_group` (optional): Filter by ancestry (meta, EUR, AFR, AMR, EAS, MID, SAS)

```bash
curl "http://localhost:3001/api/analyses?ancestry_group=meta"
```

## Data Loading

Data is ingested from Hail Tables into ClickHouse using `hail-decoder`. Commands are run from the `axaou-server` directory.

### Prerequisites

1. **Configure hail-decoder** (`~/.config/hail-decoder/config.toml`):
   ```toml
   [defaults]
   project = "<your-gcp-project>"
   zone = "<your-zone>"
   network = "<your-network>"
   subnet = "<your-subnet>"
   staging_bucket = "<your-staging-bucket>"

   [export.clickhouse]
   url = "http://localhost:8123"

   # Pool profiles - create with: hail-decoder pool create <name>
   [pools.heavy]
   machine_type = "n1-standard-96"
   workers = 2
   starting_workers = 2
   spot = false
   with_coordinator = true

   [pools.memheavy]
   machine_type = "n2-highmem-48"
   workers = 4
   starting_workers = 4
   spot = false
   with_coordinator = true
   ```

2. **Create a worker pool** (one-time setup):
   ```bash
   hail-decoder pool create heavy
   ```

3. **ClickHouse running** on localhost:8123 (or configure remote URL)

### Reference Data (run once)

These tables are shared across all phenotypes. Annotations require high-memory workers (`memheavy` pool):

```bash
# Create memheavy pool for annotation loading
hail-decoder pool create memheavy

# Genome variant annotations (~1.3B rows) - requires high memory
cargo run -- ingest genome-annotations \
    --pool memheavy \
    --force \
    --clickhouse-url http://localhost:8123 \
    --remote-clickhouse-url http://<clickhouse-internal-ip>:8123

# Exome variant annotations (~142M rows) - requires high memory
cargo run -- ingest exome-annotations \
    --pool memheavy \
    --force \
    --clickhouse-url http://localhost:8123 \
    --remote-clickhouse-url http://<clickhouse-internal-ip>:8123

# Gene models (Gencode v39)
cargo run -- ingest gene-models \
    --pool memheavy \
    --force \
    --clickhouse-url http://localhost:8123 \
    --remote-clickhouse-url http://<clickhouse-internal-ip>:8123

# Analysis metadata (~25K rows: 3600 phenotypes x 7 ancestries)
cargo run -- ingest analysis-metadata \
    --pool memheavy \
    --force \
    --clickhouse-url http://localhost:8123 \
    --remote-clickhouse-url http://<clickhouse-internal-ip>:8123
```

### Manhattan Plots & Significant Variants

Phenotype-specific data is configured in `axaou-server/phenotype-data.toml`:

```toml
[job]
assets_json = "/path/to/assets.json"
output_dir = "gs://<your-bucket>/manhattans"
analysis_ids = ["height", "3013429", ...]  # Phenotypes to process
ancestries = ["meta"]

[ingest]
clickhouse_url = "http://<clickhouse-internal-ip>:8123"
database = "default"
init_strategy = "replace"  # or "append"
```

**Generate Manhattan plots and locus data:**
```bash
hail-decoder pool submit heavy --batch-size 100 -- \
    manhattan-batch --config axaou-server/phenotype-data.toml
```

**Ingest into ClickHouse:**
```bash
hail-decoder pool submit heavy --batch-size 100 -- \
    ingest manhattan --config axaou-server/phenotype-data.toml
```

### Tables Created

| Table | Description | Rows |
|-------|-------------|------|
| `analysis_metadata` | Phenotype info (description, n_cases, etc.) | ~25K |
| `exome_annotations` | VEP annotations for exome variants | ~142M |
| `genome_annotations` | VEP annotations for genome variants | ~1.3B |
| `gene_models` | Gencode v39 gene definitions | ~62K |
| `significant_variants` | Variants with p < 5e-8 | varies |
| `loci` | GWAS locus definitions | varies |
| `loci_variants` | Variants within each locus | varies |
| `gene_associations` | Gene burden test results | ~2.3M |
