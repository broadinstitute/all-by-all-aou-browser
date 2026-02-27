# Multi-stage build for axaou-server
# hail-decoder is fetched from git during cargo build

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
RUN cargo build --release && rm -rf src target/release/deps/axaou_server*

# Copy the actual source code
COPY src ./src

# Build the final binary
RUN cargo build --release

# Runtime stage - minimal image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false axaou

WORKDIR /app

COPY --from=builder /app/target/release/axaou-server /usr/local/bin/axaou-server

USER axaou

ENV PORT=8080
ENV RUST_LOG=info

EXPOSE 8080

CMD ["axaou-server", "serve", "--port", "8080"]
