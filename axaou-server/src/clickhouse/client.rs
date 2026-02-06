//! ClickHouse client connection management

use crate::error::AppError;
use clickhouse::Client;
use std::env;

/// Create a ClickHouse client connection
///
/// Reads configuration from environment variables:
/// - `CLICKHOUSE_URL`: Connection URL (default: `http://localhost:8123`)
/// - `CLICKHOUSE_DATABASE`: Database name (default: `default`)
pub fn connect() -> Client {
    let url = env::var("CLICKHOUSE_URL").unwrap_or_else(|_| "http://localhost:8123".to_string());
    let database = env::var("CLICKHOUSE_DATABASE").unwrap_or_else(|_| "default".to_string());

    Client::default().with_url(url).with_database(database)
}

/// Check ClickHouse connectivity
pub async fn health_check(client: &Client) -> Result<(), AppError> {
    client
        .query("SELECT 1")
        .fetch_one::<u8>()
        .await
        .map_err(|e| AppError::DataTransformError(format!("ClickHouse health check failed: {}", e)))?;
    Ok(())
}
