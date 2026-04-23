//! Curated display name overrides for phenotype descriptions.
//!
//! Maps analysis_id → standardized clinical display name. The source JSON
//! is shared with the frontend and lives at
//! `frontend/src/client/PhenotypeList/phenotypeDisplayNames.json`.

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::LazyLock;

#[derive(Deserialize)]
struct DisplayNameEntry {
    display: String,
    #[allow(dead_code)]
    original: String,
}

static DISPLAY_NAMES: LazyLock<HashMap<String, String>> = LazyLock::new(|| {
    let json = include_str!("phenotype/phenotype_display_names.json");
    let entries: HashMap<String, DisplayNameEntry> =
        serde_json::from_str(json).expect("phenotypeDisplayNames.json must be valid JSON");
    entries
        .into_iter()
        .map(|(id, entry)| (id, entry.display))
        .collect()
});

/// Apply display name override to a description, falling back to the original.
pub fn apply_display_name(analysis_id: &str, description: &str) -> String {
    DISPLAY_NAMES
        .get(analysis_id)
        .cloned()
        .unwrap_or_else(|| description.to_string())
}
