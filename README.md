# axaou-rust

Rust backend for the AxAoU browser - Phase 1: Analysis Metadata endpoint.

## axaou-server

A Rust binary that reads the analysis metadata Hail Table directly from GCS using `hail-decoder` and serves it via an HTTP API.

### Building

```bash
cd axaou-server
cargo build --release
```

### Running

**Prerequisites:**
- Google Cloud authentication configured (e.g., `gcloud auth application-default login`)
- Access to `gs://aou_results/414k/utils/aou_phenotype_meta_info.ht`

```bash
# Development (default port 3000)
cargo run

# Custom port
PORT=3001 cargo run

# With debug logging
RUST_LOG=debug cargo run

# Production
./target/release/axaou-server
```

The server will:
1. Load analysis metadata from GCS at startup
2. Listen on `http://0.0.0.0:3000`
3. Serve the `/api/analyses` endpoint

### API

**GET /api/analyses**

Returns analysis metadata as JSON array.

Query parameters:
- `ancestry_group` (optional): Filter by ancestry group (case-insensitive). Values: `meta`, `EUR`, `AFR`, `AMR`, `EAS`, `MID`, `SAS`

Example:
```bash
# Get all analyses
curl http://localhost:3000/api/analyses

# Get meta-analysis only (what frontend requests)
curl "http://localhost:3000/api/analyses?ancestry_group=meta"
```

### Testing with Frontend

1. **Start the Rust Server:**
   ```bash
   cd axaou-server
   cargo run
   ```

2. **Configure and Start the Frontend:**
   ```bash
   cd /path/to/karyogram/apps/axaou-ui
   PYTHON_API_HOST=http://localhost:3000 pnpm start
   ```

3. **Verify:**
   - Open browser to `http://localhost:8000`
   - Open Developer Tools > Network tab
   - Observe request to `/api/analyses` returns 200 OK
   - Verify the "Phenotype" dropdown populates correctly
