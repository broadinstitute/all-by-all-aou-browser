# Multi-stage build for axaou-server
#
# Build stages:
# 1. builder  - Compiles Rust binary (hail-decoder fetched from git)
# 2. assets   - Downloads pre-computed GCS assets (requires gcloud auth)
# 3. runtime  - Final minimal image with binary + assets
#
# The assets stage downloads v8-assets.json from GCS to avoid slow on-demand
# discovery at runtime (which can take 30-60s and timeout on Cloud Run).
#
# To update assets:
#   cargo run -- discover --output v8-assets.json
#   gsutil cp v8-assets.json gs://axaou-central/browserv2/v8-assets.json

FROM rust:1.85-slim-bookworm AS builder

# Install build dependencies (git needed for cargo to fetch git dependencies)
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Cargo files for dependency caching
COPY Cargo.toml Cargo.lock ./

# Create dummy src for dependency compilation
RUN mkdir src && echo 'fn main() {}' > src/main.rs

# Build dependencies only (this layer will be cached)
# Use git CLI for fetching (avoids SSH auth issues with cargo's native fetcher)
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
# genohype-cli embeds dashboard assets via RustEmbed at compile time;
# create the expected directory so the build succeeds (axaou-server doesn't serve the dashboard)
RUN cargo fetch && \
    CLI_DIR=$(find /usr/local/cargo/git/checkouts/genohype-* -maxdepth 2 -name "cli" -type d | head -1) && \
    mkdir -p "$CLI_DIR/static/dist" && \
    echo '<html></html>' > "$CLI_DIR/static/dist/index.html" && \
    cargo build --release && rm -rf src target/release/deps/axaou_server*

# Copy the actual source code
COPY src ./src

# Build the final binary
RUN cargo build --release

# Asset download stage - downloads pre-computed assets from GCS
FROM google/cloud-sdk:slim AS assets

WORKDIR /assets

# Download pre-computed assets from GCS to avoid slow on-demand discovery
# This file is generated with: cargo run -- discover --output v8-assets.json
# and uploaded to: gs://axaou-central/browserv2/v8-assets.json
RUN gsutil cp gs://axaou-central/browserv2/v8-assets.json /assets/v8-assets.json

# Runtime stage - minimal image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false axaou

WORKDIR /app

COPY --from=builder /app/target/release/axaou-server /usr/local/bin/axaou-server
COPY --from=assets /assets/v8-assets.json /app/v8-assets.json

RUN chown axaou:axaou /app/v8-assets.json

USER axaou

ENV PORT=8080
ENV RUST_LOG=info

EXPOSE 8080

CMD ["axaou-server", "serve", "--port", "8080", "--assets-file", "/app/v8-assets.json"]
