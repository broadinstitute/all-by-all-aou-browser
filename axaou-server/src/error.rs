//! Custom error handling for the AxAoU server

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(thiserror::Error, Debug)]
pub enum AppError {
    #[error("Hail Decoder Error: {0}")]
    HailDecoder(#[from] hail_decoder::HailError),

    #[error("Failed to transform data: {0}")]
    DataTransformError(String),

    #[error("Internal task error: {0}")]
    JoinError(#[from] tokio::task::JoinError),

    #[error("Invalid interval: {0}")]
    InvalidInterval(String),

    #[error("Not found: {0}")]
    NotFound(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            AppError::HailDecoder(_) | AppError::DataTransformError(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
            AppError::JoinError(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            AppError::InvalidInterval(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, self.to_string()),
        };

        let body = Json(json!({ "error": error_message }));
        (status, body).into_response()
    }
}
