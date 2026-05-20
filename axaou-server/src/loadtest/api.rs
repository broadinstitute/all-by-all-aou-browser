//! HTTP API routes for the load test dashboard.
//!
//! Provides endpoints to start/stop tests, stream live results via SSE,
//! and browse past run history.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{
        sse::{Event, Sse},
        IntoResponse, Json,
    },
    routing::{get, post},
    Router,
};
use std::convert::Infallible;
use std::sync::Arc;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;

use super::{LoadTestConfig, LoadTestEvent, LoadTestState};
use super::runner::{RunnerOptions, run_loadtest};

/// Build the load test API router.
pub fn router(state: Arc<LoadTestState>) -> Router {
    Router::new()
        .route("/start", post(start_test))
        .route("/stop/:run_id", post(stop_test))
        .route("/stream/:run_id", get(stream_test))
        .route("/runs", get(list_runs))
        .route("/runs/:run_id", get(get_run))
        .with_state(state)
}

// ---------------------------------------------------------------------------
// POST /api/loadtest/start
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
struct StartRequest {
    #[serde(flatten)]
    config: LoadTestConfig,
}

#[derive(serde::Serialize)]
struct StartResponse {
    run_id: String,
}

async fn start_test(
    State(state): State<Arc<LoadTestState>>,
    Json(req): Json<StartRequest>,
) -> Result<Json<StartResponse>, (StatusCode, String)> {
    let run_id = uuid::Uuid::new_v4().to_string();

    // Create broadcast channel for this run (buffer 1024 events)
    let (event_tx, _) = tokio::sync::broadcast::channel::<LoadTestEvent>(1024);

    // Register the active run
    state
        .active_runs
        .write()
        .await
        .insert(run_id.clone(), event_tx.clone());

    let db = state.db.clone();
    let run_id_clone = run_id.clone();
    let active_runs = Arc::clone(&state);

    // Spawn the load test in the background
    tokio::spawn(async move {
        let opts = RunnerOptions {
            db: Some(db),
            event_tx: Some(event_tx),
            run_id: Some(run_id_clone.clone()),
            quiet: true,
        };

        match run_loadtest(req.config, opts).await {
            Ok(_report) => {
                tracing::info!("Load test {} completed", run_id_clone);
            }
            Err(e) => {
                tracing::error!("Load test {} failed: {}", run_id_clone, e);
            }
        }

        // Clean up active run after completion
        active_runs.active_runs.write().await.remove(&run_id_clone);
    });

    Ok(Json(StartResponse { run_id }))
}

// ---------------------------------------------------------------------------
// POST /api/loadtest/stop/:run_id
// ---------------------------------------------------------------------------

async fn stop_test(
    State(state): State<Arc<LoadTestState>>,
    Path(run_id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Remove from active runs — the broadcast channel drop will signal the runner
    // (In practice, the runner checks for subscriber count and we could add a
    // cancellation token. For now, dropping the sender causes SSE to end.)
    let removed = state.active_runs.write().await.remove(&run_id);

    if removed.is_some() {
        // Mark as aborted in DB
        let _ = state.db.abort_run(&run_id).await;
        Ok(StatusCode::OK)
    } else {
        Err((
            StatusCode::NOT_FOUND,
            format!("No active run with id {}", run_id),
        ))
    }
}

// ---------------------------------------------------------------------------
// GET /api/loadtest/stream/:run_id (SSE)
// ---------------------------------------------------------------------------

async fn stream_test(
    State(state): State<Arc<LoadTestState>>,
    Path(run_id): Path<String>,
) -> Result<Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>>, (StatusCode, String)>
{
    let runs = state.active_runs.read().await;
    let tx = runs.get(&run_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            format!("No active run with id {}", run_id),
        )
    })?;

    let rx = tx.subscribe();
    drop(runs);

    let stream = BroadcastStream::new(rx).filter_map(|result| match result {
        Ok(event) => {
            let json = serde_json::to_string(&event).unwrap_or_default();
            Some(Ok(Event::default().data(json)))
        }
        Err(_) => None, // Lagged — skip
    });

    Ok(Sse::new(stream))
}

// ---------------------------------------------------------------------------
// GET /api/loadtest/runs
// ---------------------------------------------------------------------------

async fn list_runs(
    State(state): State<Arc<LoadTestState>>,
) -> Result<Json<Vec<super::db::RunSummary>>, (StatusCode, String)> {
    state
        .db
        .list_runs()
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

// ---------------------------------------------------------------------------
// GET /api/loadtest/runs/:run_id
// ---------------------------------------------------------------------------

async fn get_run(
    State(state): State<Arc<LoadTestState>>,
    Path(run_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    match state.db.get_run(&run_id).await {
        Ok(Some(detail)) => Ok(Json(detail)),
        Ok(None) => Err((StatusCode::NOT_FOUND, format!("Run {} not found", run_id))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
