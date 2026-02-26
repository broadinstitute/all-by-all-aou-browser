#!/bin/bash
# Unified development script for axaou-rust
# Starts both frontend (with HMR) and backend (with cargo-watch) in parallel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-8000}"
LOG_DIR="/tmp"
ASSETS_FILE="${ASSETS_FILE:-$HOME/data/axaou-local/v8-assets.json}"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down dev servers...${NC}"

    # Kill background jobs
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi

    # Kill any remaining processes
    pkill -f "cargo watch.*axaou" 2>/dev/null || true
    pkill -f "axaou-server.*serve" 2>/dev/null || true

    echo -e "${GREEN}Done${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM EXIT

# Check dependencies
check_deps() {
    local missing=()

    if ! command -v cargo &> /dev/null; then
        missing+=("cargo (Rust)")
    fi

    if ! command -v cargo-watch &> /dev/null; then
        echo -e "${YELLOW}cargo-watch not found. Installing...${NC}"
        cargo install cargo-watch
    fi

    if ! command -v pnpm &> /dev/null; then
        missing+=("pnpm")
    fi

    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "${RED}Missing dependencies: ${missing[*]}${NC}"
        echo "Please install them and try again."
        exit 1
    fi
}

# Start backend with hot reloading
start_backend() {
    echo -e "${BLUE}[Backend]${NC} Starting Rust server with hot reloading..."
    cd "$PROJECT_DIR/axaou-server"

    # Use cargo-watch to rebuild and restart on changes
    local assets_flag=""
    if [ -f "$ASSETS_FILE" ]; then
        assets_flag="--assets-file $ASSETS_FILE"
        echo -e "${GREEN}[Backend]${NC} Using pre-computed assets: $ASSETS_FILE"
    else
        echo -e "${YELLOW}[Backend]${NC} No assets file found, will discover from GCS on-demand"
    fi

    cargo watch \
        -w src \
        -w Cargo.toml \
        -s "cargo run -- serve --port $BACKEND_PORT $assets_flag" \
        2>&1 | while IFS= read -r line; do
            echo -e "${BLUE}[Backend]${NC} $line"
        done &
    BACKEND_PID=$!

    echo -e "${GREEN}[Backend]${NC} Started on http://localhost:$BACKEND_PORT (PID: $BACKEND_PID)"
}

# Start frontend with HMR
start_frontend() {
    echo -e "${YELLOW}[Frontend]${NC} Starting with hot module reloading..."
    cd "$PROJECT_DIR/frontend"

    # Run the existing start script which uses webpack-dev-server with HMR
    ./start.sh $FRONTEND_PORT 2>&1 | while IFS= read -r line; do
        echo -e "${YELLOW}[Frontend]${NC} $line"
    done &
    FRONTEND_PID=$!

    echo -e "${GREEN}[Frontend]${NC} Started on http://localhost:$FRONTEND_PORT (PID: $FRONTEND_PID)"
}

# Main
main() {
    echo -e "${GREEN}=============================================="
    echo "  AxAoU Development Server"
    echo "==============================================${NC}"
    echo ""

    check_deps

    # Kill any existing servers
    pkill -f "cargo watch.*axaou" 2>/dev/null || true
    pkill -f "axaou-server.*serve" 2>/dev/null || true

    echo -e "${GREEN}Starting services...${NC}"
    echo ""

    start_backend
    sleep 2  # Give backend a head start
    start_frontend

    echo ""
    echo -e "${GREEN}=============================================="
    echo "  Development servers running:"
    echo "  - Backend:  http://localhost:$BACKEND_PORT"
    echo "  - Frontend: http://localhost:$FRONTEND_PORT"
    echo ""
    echo "  Press Ctrl+C to stop all servers"
    echo "==============================================${NC}"
    echo ""

    # Wait for background processes
    wait
}

main "$@"
