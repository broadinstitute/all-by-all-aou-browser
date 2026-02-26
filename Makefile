# Development Makefile for axaou-rust
# Provides unified commands for running frontend + backend with hot reloading

.PHONY: dev dev-backend dev-frontend install stop clean help

# Default target
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Development:"
	@echo "  dev           - Start both frontend and backend with hot reloading"
	@echo "  dev-backend   - Start only the Rust backend with hot reloading"
	@echo "  dev-frontend  - Start only the frontend with HMR"
	@echo "  stop          - Stop all running dev servers"
	@echo ""
	@echo "Setup:"
	@echo "  install       - Install dependencies (cargo-watch, pnpm)"
	@echo ""
	@echo "Build:"
	@echo "  build         - Build both frontend and backend for production"
	@echo "  build-backend - Build only the Rust backend"
	@echo "  build-frontend- Build only the frontend"
	@echo ""
	@echo "Testing:"
	@echo "  test          - Run all tests"
	@echo "  smoke-test    - Run API smoke tests"
	@echo ""
	@echo "Utilities:"
	@echo "  clean         - Clean build artifacts"
	@echo "  logs          - Tail logs from dev servers"

# Install dependencies
install:
	@echo "Installing cargo-watch for Rust hot reloading..."
	cargo install cargo-watch
	@echo "Installing frontend dependencies..."
	cd frontend && pnpm install

# Start both frontend and backend with hot reloading
dev:
	@echo "Starting development servers..."
	@echo "  Backend:  http://localhost:3001"
	@echo "  Frontend: http://localhost:8000"
	@echo ""
	@echo "Press Ctrl+C to stop all servers"
	@./scripts/dev.sh

# Start only backend with hot reloading
dev-backend:
	@echo "Starting Rust backend with hot reloading on http://localhost:3001"
	@if [ -f "$(HOME)/data/axaou-local/v8-assets.json" ]; then \
		echo "Using pre-computed assets: $(HOME)/data/axaou-local/v8-assets.json"; \
		cd axaou-server && cargo watch -x 'run -- serve --port 3001 --assets-file $(HOME)/data/axaou-local/v8-assets.json'; \
	else \
		echo "No assets file found, will discover from GCS on-demand"; \
		cd axaou-server && cargo watch -x 'run -- serve --port 3001'; \
	fi

# Start only frontend with HMR
dev-frontend:
	@echo "Starting frontend with HMR on http://localhost:8000"
	cd frontend && pnpm start

# Stop all dev servers
stop:
	@echo "Stopping dev servers..."
	-pkill -f "cargo watch" 2>/dev/null || true
	-pkill -f "axaou-server" 2>/dev/null || true
	-pkill -f "webpack" 2>/dev/null || true
	-pkill -f "nodemon" 2>/dev/null || true
	@echo "Done"

# Build for production
build: build-backend build-frontend

build-backend:
	@echo "Building Rust backend..."
	cd axaou-server && cargo build --release

build-frontend:
	@echo "Building frontend..."
	cd frontend && pnpm build

# Run tests
test:
	@echo "Running backend tests..."
	cd axaou-server && cargo test
	@echo "Running frontend tests..."
	cd frontend && pnpm test || true

# Run API smoke tests
smoke-test:
	./axaou-server/scripts/smoke_test.sh

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	cd axaou-server && cargo clean
	cd frontend && rm -rf dist node_modules/.cache
	@echo "Done"

# Tail logs (useful when running in background)
logs:
	@echo "Tailing dev logs... (Ctrl+C to exit)"
	tail -f /tmp/axaou-*.log 2>/dev/null || echo "No log files found. Start dev servers first."
