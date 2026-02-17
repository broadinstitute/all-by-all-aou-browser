#!/bin/bash
# Smoke test for axaou-server API endpoints
# Usage: ./scripts/smoke_test.sh [base_url]

set -e

BASE_URL="${1:-http://localhost:3001}"
ANALYSIS_ID="height"
ANCESTRY="meta"
GENE_ID="ENSG00000139618"  # BRCA2
GENE_SYMBOL="BRCA2"
SEQUENCING_TYPE="genomes"
VARIANT_ID="chr10-121479995-G-T"
INTERVAL="chr10:121379990-121579996"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Results tracking
PASSED=0
FAILED=0
TOTAL=0

echo ""
echo "=============================================="
echo "  AxAoU Server API Smoke Test"
echo "  Base URL: $BASE_URL"
echo "=============================================="
echo ""

# Function to test an endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expect_array="${3:-true}"

    TOTAL=$((TOTAL + 1))

    # Make request and capture response
    start_time=$(python3 -c 'import time; print(int(time.time() * 1000))')

    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$url" 2>/dev/null)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    end_time=$(python3 -c 'import time; print(int(time.time() * 1000))')
    elapsed=$((end_time - start_time))

    # Check status
    if [ "$status_code" = "200" ]; then
        # Try to get item count if it's an array
        if [ "$expect_array" = "true" ]; then
            count=$(echo "$body" | jq 'if type == "array" then length else "object" end' 2>/dev/null || echo "?")
            detail="items: $count"
        else
            detail="object"
        fi

        printf "${GREEN}%-45s${NC} ${GREEN}%3s${NC}  %-15s  ${YELLOW}%4dms${NC}\n" "$name" "$status_code" "$detail" "$elapsed"
        PASSED=$((PASSED + 1))
    else
        error=$(echo "$body" | jq -r '.error // "unknown error"' 2>/dev/null || echo "$body" | head -c 50)
        printf "${RED}%-45s${NC} ${RED}%3s${NC}  %-15s  ${YELLOW}%4dms${NC}\n" "$name" "$status_code" "$error" "$elapsed"
        FAILED=$((FAILED + 1))
    fi
}

echo "Endpoint                                      Code  Details          Time"
echo "--------------------------------------------------------------------------------"

# Static endpoints
test_endpoint "GET /api/config" "/api/config" false

# Analysis metadata
test_endpoint "GET /api/analyses" "/api/analyses"
test_endpoint "GET /api/analyses/:id" "/api/analyses/$ANALYSIS_ID" false
test_endpoint "GET /api/categories" "/api/categories"

# Gene models (Hail Table)
test_endpoint "GET /api/genes/model/:gene_id" "/api/genes/model/$GENE_ID" false
test_endpoint "GET /api/genes/model/interval/:interval" "/api/genes/model/interval/$INTERVAL"

# Gene associations (ClickHouse)
test_endpoint "GET /api/genes/phewas/:gene_id" "/api/genes/phewas/$GENE_SYMBOL?ancestry=$ANCESTRY"
test_endpoint "GET /api/genes/top-associations" "/api/genes/top-associations?ancestry=$ANCESTRY&limit=10"
test_endpoint "GET /api/genes/all-symbols" "/api/genes/all-symbols"
test_endpoint "GET /api/genes/associations/interval" "/api/genes/associations/interval/$INTERVAL?ancestry=$ANCESTRY&limit=10"

# Phenotype endpoints (ClickHouse)
test_endpoint "GET /api/phenotype/:id/loci" "/api/phenotype/$ANALYSIS_ID/loci?ancestry=$ANCESTRY&sequencing_type=$SEQUENCING_TYPE"
test_endpoint "GET /api/phenotype/:id/significant" "/api/phenotype/$ANALYSIS_ID/significant?ancestry=$ANCESTRY&sequencing_type=$SEQUENCING_TYPE&limit=10"
test_endpoint "GET /api/phenotype/:id/plots" "/api/phenotype/$ANALYSIS_ID/plots?ancestry=$ANCESTRY"
test_endpoint "GET /api/phenotype/:id/qq" "/api/phenotype/$ANALYSIS_ID/qq?ancestry=$ANCESTRY&sequencing_type=$SEQUENCING_TYPE"
test_endpoint "GET /api/phenotype/:id/genes" "/api/phenotype/$ANALYSIS_ID/genes?ancestry=$ANCESTRY"
test_endpoint "GET /api/phenotype/:id/genes/:gene_id" "/api/phenotype/$ANALYSIS_ID/genes/$GENE_ID?ancestry=$ANCESTRY"

# Variant annotations (ClickHouse)
test_endpoint "GET /api/variants/annotations/:variant_id" "/api/variants/annotations/$VARIANT_ID"
test_endpoint "GET /api/variants/annotations/interval" "/api/variants/annotations/interval/$INTERVAL?limit=10"
test_endpoint "GET /api/variants/annotations/gene/:gene_id" "/api/variants/annotations/gene/$GENE_ID?limit=10"

# Variant associations (ClickHouse)
test_endpoint "GET /api/variants/associations/variant" "/api/variants/associations/variant/$VARIANT_ID?analysis_id=$ANALYSIS_ID"
test_endpoint "GET /api/variants/associations/interval" "/api/variants/associations/interval/$INTERVAL?analysis_id=$ANALYSIS_ID&limit=10"
test_endpoint "GET /api/variants/associations/gene/:gene_id" "/api/variants/associations/gene/$GENE_ID?analysis_id=$ANALYSIS_ID&limit=10"
test_endpoint "GET /api/variants/associations/manhattan/top" "/api/variants/associations/manhattan/$ANALYSIS_ID/top?ancestry=$ANCESTRY&limit=10"

# PheWAS (ClickHouse)
test_endpoint "GET /api/variants/associations/phewas/:variant" "/api/variants/associations/phewas/$VARIANT_ID"
test_endpoint "GET /api/variants/associations/phewas/interval" "/api/variants/associations/phewas/interval/$INTERVAL?ancestry=$ANCESTRY&limit=10"
test_endpoint "GET /api/variants/associations/top" "/api/variants/associations/top?ancestry=$ANCESTRY&limit=10"

echo "--------------------------------------------------------------------------------"
echo ""

# Summary
if [ $FAILED -eq 0 ]; then
    printf "${GREEN}All $TOTAL tests passed!${NC}\n"
else
    printf "${GREEN}Passed: $PASSED${NC} / ${RED}Failed: $FAILED${NC} / Total: $TOTAL\n"
fi
echo ""
