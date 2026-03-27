#!/usr/bin/env bash
# Benchmark Cloud Run cold start times.
#
# Usage:
#   ./scripts/bench-cold-start.sh                          # measure current state
#   ./scripts/bench-cold-start.sh --force-cold              # scale to 0, then measure
#   ./scripts/bench-cold-start.sh --id baseline             # tag this run for comparison
#   ./scripts/bench-cold-start.sh --force-cold --id tuned   # cold start with tag
#
# Results are saved as JSON to scripts/bench-results/<id>/<timestamp>.json
# Plot with: python3 scripts/plot-cold-start.py scripts/bench-results/
#
# Requires: gcloud CLI authenticated with access to the Cloud Run services.

set -euo pipefail

ENV="${ENV:-dev}"
REGION="${REGION:-us-central1}"
FORCE_COLD=false
RUN_ID="default"

for arg in "$@"; do
  case "$arg" in
    --force-cold) FORCE_COLD=true ;;
    --env=*) ENV="${arg#*=}" ;;
    --id=*) RUN_ID="${arg#*=}" ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/bench-results/${RUN_ID}"
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
RESULT_FILE="${RESULTS_DIR}/${TIMESTAMP}.json"

BACKEND_SVC="axaou-backend-${ENV}"
FRONTEND_SVC="axaou-app-${ENV}"

BACKEND_URL=$(gcloud run services describe "$BACKEND_SVC" --region="$REGION" --format='value(status.url)' 2>/dev/null)
FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SVC" --region="$REGION" --format='value(status.url)' 2>/dev/null)

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
  echo "ERROR: Could not resolve service URLs for env=$ENV"
  exit 1
fi

echo "=== Cold Start Benchmark (env=$ENV, id=$RUN_ID) ==="
echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo "Output:   $RESULT_FILE"
echo ""

# --- Check current instance counts ---
echo ">> Instance status:"
for svc in "$BACKEND_SVC" "$FRONTEND_SVC"; do
  count=$(gcloud run services describe "$svc" --region="$REGION" \
    --format='value(status.conditions[0].message)' 2>/dev/null || echo "unknown")
  # Get active instance count from metrics
  instances=$(gcloud run revisions list --service="$svc" --region="$REGION" \
    --format='value(status.conditions[0].type,status.conditions[0].status)' --limit=1 2>/dev/null || echo "unknown")
  min_scale=$(gcloud run services describe "$svc" --region="$REGION" \
    --format='value(spec.template.metadata.annotations["autoscaling.knative.dev/minScale"])' 2>/dev/null || echo "?")
  max_scale=$(gcloud run services describe "$svc" --region="$REGION" \
    --format='value(spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"])' 2>/dev/null || echo "?")
  printf "  %-30s  min=%s  max=%s\n" "$svc" "$min_scale" "$max_scale"
done
echo ""

# --- Force cold start by scaling to 0, then restoring ---
if [ "$FORCE_COLD" = true ]; then
  echo ">> Forcing cold start: deploying new revision to kill all instances ..."
  # Deploy a no-op env var change — this creates a new revision which
  # terminates all existing instances. The new revision starts with 0
  # instances until the first request arrives.
  COLD_TAG="bench-$(date +%s)"
  gcloud run services update "$BACKEND_SVC" --region="$REGION" \
    --update-env-vars="BENCH_COLD_TAG=$COLD_TAG" --quiet 2>&1 | tail -1
  gcloud run services update "$FRONTEND_SVC" --region="$REGION" \
    --update-env-vars="BENCH_COLD_TAG=$COLD_TAG" --quiet 2>&1 | tail -1

  echo "   New revisions deployed (tag=$COLD_TAG). Waiting 5s for old instances to drain..."
  sleep 5
  echo "   All instances are cold."
  echo ""
fi

# --- Timing helper ---
# Outputs a JSON object per request; also prints human-readable line.
CURL_FMT='{"dns":%{time_namelookup},"connect":%{time_connect},"tls":%{time_appconnect},"ttfb":%{time_starttransfer},"total":%{time_total},"http_code":%{http_code},"size_bytes":%{size_download}}'

# Collect all results as JSON array
RESULTS="[]"

time_request() {
  local label="$1"
  local url="$2"
  local phase="$3"
  local token=""

  token=$(gcloud auth print-identity-token 2>/dev/null || true)

  local result
  if [ -n "$token" ]; then
    result=$(curl -o /dev/null -s -w "$CURL_FMT" -H "Authorization: Bearer $token" "$url")
  else
    result=$(curl -o /dev/null -s -w "$CURL_FMT" "$url")
  fi

  # Append to results array
  RESULTS=$(echo "$RESULTS" | python3 -c "
import sys, json
results = json.load(sys.stdin)
timing = json.loads('$result')
timing['label'] = '$label'
timing['phase'] = '$phase'
timing['url'] = '$url'
results.append(timing)
json.dump(results, sys.stdout)
")

  # Print human-readable
  local ttfb total http_code
  ttfb=$(echo "$result" | python3 -c "import sys,json; print(f'{json.load(sys.stdin)[\"ttfb\"]:.3f}')")
  total=$(echo "$result" | python3 -c "import sys,json; print(f'{json.load(sys.stdin)[\"total\"]:.3f}')")
  http_code=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['http_code'])")

  printf "  %-45s  HTTP %s  TTFB: %6ss  Total: %6ss\n" \
    "$label" "$http_code" "$ttfb" "$total"
}

# --- Run benchmarks ---

echo ">> Backend (direct) — triggers backend cold start only"
echo "   -------"
time_request "health check"            "${BACKEND_URL}/api/health"               "backend_cold"
time_request "phenotypes summary"      "${BACKEND_URL}/api/phenotypes/summary"   "backend_cold"
time_request "genes summary"           "${BACKEND_URL}/api/genes/summary"        "backend_cold"
time_request "top variants (meta)"     "${BACKEND_URL}/api/variants/top?ancestry=meta&max_p=0.000001&limit=1000" "backend_cold"

echo ""
echo ">> Frontend (full chain) — triggers frontend + backend cold start"
echo "   -------"
time_request "index.html"              "${FRONTEND_URL}/"                        "frontend_chain"
time_request "api via proxy: health"   "${FRONTEND_URL}/api/health"              "frontend_chain"
time_request "api via proxy: phenos"   "${FRONTEND_URL}/api/phenotypes/summary"  "frontend_chain"

echo ""
echo ">> Warm comparison (repeat — should be fast if instances are still alive)"
echo "   -------"
time_request "backend health (warm)"   "${BACKEND_URL}/api/health"               "warm"
time_request "backend phenos (warm)"   "${BACKEND_URL}/api/phenotypes/summary"   "warm"
time_request "frontend index (warm)"   "${FRONTEND_URL}/"                        "warm"

# --- Write JSON result file ---
echo "$RESULTS" | python3 -c "
import sys, json
results = json.load(sys.stdin)
output = {
    'id': '$RUN_ID',
    'timestamp': '$TIMESTAMP',
    'env': '$ENV',
    'force_cold': $( [ \"$FORCE_COLD\" = true ] && echo 'True' || echo 'False' ),
    'backend_url': '$BACKEND_URL',
    'frontend_url': '$FRONTEND_URL',
    'results': results
}
json.dump(output, sys.stdout, indent=2)
" > "$RESULT_FILE"

echo ""
echo "Results saved to $RESULT_FILE"
echo "Plot with: python3 scripts/plot-cold-start.py scripts/bench-results/"
