//! Response wrapper types for API endpoints
//!
//! These types provide consistent response envelopes that match
//! the frontend's expected `LookupResult<T>` interface.

use serde::Serialize;

/// Standard response envelope that wraps list data.
///
/// Matches the frontend's `LookupResult<T>` TypeScript interface:
/// ```typescript
/// interface LookupResult<T> {
///   count: number
///   data: T[]
///   storage_source: string
///   time: number
/// }
/// ```
#[derive(Debug, Serialize)]
pub struct LookupResult<T> {
    /// The data payload
    pub data: Vec<T>,
    /// Number of items returned
    pub count: usize,
    /// Source of the data (e.g., "clickhouse")
    pub storage_source: String,
    /// Query execution time in seconds
    pub time: f64,
}

impl<T> LookupResult<T> {
    /// Create a new LookupResult with the given data and execution time.
    ///
    /// # Arguments
    /// * `data` - The vector of results
    /// * `time` - Query execution time in seconds
    pub fn new(data: Vec<T>, time: f64) -> Self {
        Self {
            count: data.len(),
            data,
            storage_source: "clickhouse".to_string(),
            time,
        }
    }

    /// Create a LookupResult from an iterator with execution time.
    pub fn from_iter<I: IntoIterator<Item = T>>(iter: I, time: f64) -> Self {
        let data: Vec<T> = iter.into_iter().collect();
        Self::new(data, time)
    }
}

/// Helper trait for measuring query execution time
pub struct QueryTimer {
    start: std::time::Instant,
}

impl QueryTimer {
    /// Start a new timer
    pub fn start() -> Self {
        Self {
            start: std::time::Instant::now(),
        }
    }

    /// Get elapsed time in seconds
    pub fn elapsed(&self) -> f64 {
        self.start.elapsed().as_secs_f64()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lookup_result_new() {
        let data = vec![1, 2, 3];
        let result = LookupResult::new(data, 0.123);

        assert_eq!(result.count, 3);
        assert_eq!(result.data, vec![1, 2, 3]);
        assert_eq!(result.storage_source, "clickhouse");
        assert!((result.time - 0.123).abs() < 0.001);
    }

    #[test]
    fn test_lookup_result_empty() {
        let data: Vec<String> = vec![];
        let result = LookupResult::new(data, 0.0);

        assert_eq!(result.count, 0);
        assert!(result.data.is_empty());
    }
}
