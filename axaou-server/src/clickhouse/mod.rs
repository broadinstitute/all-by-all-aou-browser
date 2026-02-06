//! ClickHouse client and data access layer
//!
//! Provides connectivity to ClickHouse for variant and locus queries.

pub mod client;
pub mod models;
pub mod xpos;

pub use client::connect;
pub use models::*;
pub use xpos::*;
