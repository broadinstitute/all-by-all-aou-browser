# Load environment variables for the AXAOU pipeline and define server port
configure_environment() {
	export GIT_ROOT=$(git rev-parse --show-toplevel)
	source $GIT_ROOT/.venv/bin/activate
	export AXAOU_BROWSER_UI_DIR=$GIT_ROOT/apps/axaou-ui
	export AXAOU_BROWSER_DATA_DIR=$GIT_ROOT/datasets/axaou-browser-data
	export DATA_ENVIRONMENT=local
	export COMPUTE_ENVIRONMENT=local
	export LOG_LEVEL=INFO

	DEFAULT_UVICORN_PORT=8900
	export UVICORN_PORT="${3:-$DEFAULT_UVICORN_PORT}"
	while lsof -i :$UVICORN_PORT &>/dev/null; do
		echo "Port $UVICORN_PORT is already in use. Trying next available port..."
		UVICORN_PORT=$((UVICORN_PORT + 1))
	done
}

run_test_pipeline() {
	cd "$AXAOU_BROWSER_DATA_DIR" || exit
	python -m axaou_browser_data.pipeline.run_test_pipeline
	echo $HDS_PIPELINE_ROOT

	mkdir -p $AXAOU_BROWSER_UI_DIR/src/client/types/server
	cp $AXAOU_BROWSER_DATA_DIR/src/axaou_browser_data/types/typescript/* \
		$AXAOU_BROWSER_UI_DIR/src/client/types/server/
}

start_uvicorn() {
	echo "Starting uvicorn on port $UVICORN_PORT"
	cd "$AXAOU_BROWSER_DATA_DIR" || exit
	uvicorn axaou_browser_data.run:app --port "$UVICORN_PORT" &
	PID_UVICORN=$!
	trap 'kill "$PID_UVICORN" 2>/dev/null; exit 1' INT TERM
}

configure_environment
run_test_pipeline
start_uvicorn

wait "$PID_UVICORN"
