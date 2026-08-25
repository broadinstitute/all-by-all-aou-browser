#!/usr/bin/env bash
# Start the current ClickHouse SSH tunnel and both local development servers.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

GCP_PROJECT="${GCP_PROJECT:-aou-neale-gwas-browser}"
GCP_ZONE="${GCP_ZONE:-us-central1-a}"
CLICKHOUSE_INSTANCE="${CLICKHOUSE_INSTANCE:-axaou-clickhouse-2}"
CLICKHOUSE_LOCAL_PORT="${CLICKHOUSE_LOCAL_PORT:-8123}"
CLICKHOUSE_NATIVE_LOCAL_PORT="${CLICKHOUSE_NATIVE_LOCAL_PORT:-9000}"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:${CLICKHOUSE_LOCAL_PORT}}"
LOCAL_API_HOST="${LOCAL_API_HOST:-http://localhost:3001}"
LOCAL_API_PATH="${LOCAL_API_PATH:-/api}"
TUNNEL_LOG="${TUNNEL_LOG:-/tmp/axaou-clickhouse-tunnel.log}"

TUNNEL_PID=""
OWNS_TUNNEL=false

cleanup() {
    if [[ "$OWNS_TUNNEL" == true && -n "$TUNNEL_PID" ]]; then
        OWNS_TUNNEL=false
        echo "Stopping ClickHouse tunnel (PID: $TUNNEL_PID)..."
        kill "$TUNNEL_PID" 2>/dev/null || true
        wait "$TUNNEL_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

for command in gcloud curl; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "Missing required command: $command" >&2
        exit 1
    fi
done

if curl --silent --fail --max-time 2 "$CLICKHOUSE_URL/" >/dev/null 2>&1; then
    echo "Using the existing ClickHouse tunnel at $CLICKHOUSE_URL"
else
    echo "Starting tunnel to ${CLICKHOUSE_INSTANCE} (${GCP_PROJECT}/${GCP_ZONE})..."
    echo "Tunnel log: $TUNNEL_LOG"

    gcloud compute ssh "$CLICKHOUSE_INSTANCE" \
        --project "$GCP_PROJECT" \
        --zone "$GCP_ZONE" \
        --tunnel-through-iap \
        -- -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
        -L "${CLICKHOUSE_LOCAL_PORT}:127.0.0.1:8123" \
        -L "${CLICKHOUSE_NATIVE_LOCAL_PORT}:127.0.0.1:9000" \
        >"$TUNNEL_LOG" 2>&1 &
    TUNNEL_PID=$!
    OWNS_TUNNEL=true

    for _ in {1..30}; do
        if curl --silent --fail --max-time 2 "$CLICKHOUSE_URL/" >/dev/null 2>&1; then
            echo "ClickHouse is available at $CLICKHOUSE_URL"
            break
        fi
        if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
            echo "ClickHouse tunnel exited before becoming ready:" >&2
            tail -n 20 "$TUNNEL_LOG" >&2 || true
            exit 1
        fi
        sleep 1
    done

    if ! curl --silent --fail --max-time 2 "$CLICKHOUSE_URL/" >/dev/null 2>&1; then
        echo "Timed out waiting for ClickHouse at $CLICKHOUSE_URL" >&2
        tail -n 20 "$TUNNEL_LOG" >&2 || true
        exit 1
    fi
fi

cd "$PROJECT_DIR"
echo "Starting backend and frontend..."
echo "  ClickHouse: $CLICKHOUSE_URL"
echo "  Backend:    $LOCAL_API_HOST"
echo "  Frontend:   http://localhost:${FRONTEND_PORT:-8003}"

PYTHON_API_HOST="$LOCAL_API_HOST" \
PYTHON_API_PATH="$LOCAL_API_PATH" \
CLICKHOUSE_URL="$CLICKHOUSE_URL" \
./scripts/dev.sh
