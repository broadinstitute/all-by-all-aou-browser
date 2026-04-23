//! Curated display name overrides for phenotype descriptions.
//!
//! Maps analysis_id → standardized clinical display name. The JSON lives at
//! `axaou-server/src/phenotype/phenotype_display_names.json`.
//!
//! For descriptions not in the override map, applies title-case normalization
//! to any all-lowercase descriptions (common in lab_measurement, physical_measurement,
//! and r_drug categories).

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
        serde_json::from_str(json).expect("phenotype_display_names.json must be valid JSON");
    entries
        .into_iter()
        .map(|(id, entry)| (id, entry.display))
        .collect()
});

/// Words that should be fully uppercased.
const UPPERCASE_WORDS: &[&str] = &[
    "hdl", "ldl", "lpa", "ace", "bun", "mch", "mcv", "inr", "acth", "icd", "icd10",
];

/// Words that should stay lowercase (unless at the start).
const LOWERCASE_WORDS: &[&str] = &[
    "in", "or", "and", "of", "by", "a", "the", "to", "for", "with",
];

/// Title-case a string, preserving known abbreviations.
fn title_case(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut is_start = true;

    for part in s.split_inclusive(|c: char| c == ' ' || c == '-' || c == '/') {
        let word = part.trim_end_matches(|c: char| c == ' ' || c == '-' || c == '/');
        let sep = &part[word.len()..];

        if word.is_empty() {
            result.push_str(sep);
            continue;
        }

        let lower = word.to_lowercase();
        if UPPERCASE_WORDS.iter().any(|&w| w == lower) {
            result.push_str(&word.to_uppercase());
        } else if !is_start && LOWERCASE_WORDS.iter().any(|&w| w == lower) {
            result.push_str(&lower);
        } else {
            let mut chars = lower.chars();
            if let Some(first) = chars.next() {
                result.extend(first.to_uppercase());
                result.push_str(chars.as_str());
            }
        }
        result.push_str(sep);
        is_start = false;
    }

    result
}

/// Returns true if the description is all-lowercase (has letters but none uppercase).
fn is_all_lowercase(s: &str) -> bool {
    s.chars().any(|c| c.is_alphabetic()) && !s.chars().any(|c| c.is_uppercase())
}

/// Convert "drug name; route" to "Drug Name (Route)".
fn semicolon_to_parens(s: &str) -> String {
    match s.rfind("; ") {
        Some(pos) => {
            let name = &s[..pos];
            let route = &s[pos + 2..];
            format!("{} ({})", name, route)
        }
        None => s.to_string(),
    }
}

/// Apply display name override, falling back to title-case for all-lowercase descriptions.
pub fn apply_display_name(analysis_id: &str, description: &str) -> String {
    if let Some(override_name) = DISPLAY_NAMES.get(analysis_id) {
        return override_name.clone();
    }
    if is_all_lowercase(description) {
        let cased = title_case(description);
        return semicolon_to_parens(&cased);
    }
    description.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_title_case() {
        assert_eq!(title_case("alanine aminotransferase"), "Alanine Aminotransferase");
        assert_eq!(title_case("high density lipoprotein"), "High Density Lipoprotein");
        assert_eq!(title_case("ace inhibitors, plain"), "ACE Inhibitors, Plain");
        assert_eq!(title_case("blood-pressure-diastolic-mean"), "Blood-Pressure-Diastolic-Mean");
        assert_eq!(
            title_case("antiinflammatory products for vaginal administration"),
            "Antiinflammatory Products for Vaginal Administration"
        );
        assert_eq!(
            title_case("hypnotics and sedatives in combination, excl. barbiturates"),
            "Hypnotics and Sedatives in Combination, Excl. Barbiturates"
        );
    }

    #[test]
    fn test_override_applied() {
        assert_eq!(apply_display_name("3006923", "alanine aminotransferase"), "Alanine Aminotransferase (ALT)");
    }

    #[test]
    fn test_fallback_title_case() {
        assert_eq!(apply_display_name("unknown_id", "some lowercase description"), "Some Lowercase Description");
    }

    #[test]
    fn test_semicolon_to_parens() {
        assert_eq!(
            apply_display_name("unknown_id", "heparin, combinations; parenteral"),
            "Heparin, Combinations (Parenteral)"
        );
        assert_eq!(
            apply_display_name("unknown_id", "acetylsalicylic acid; oral"),
            "Acetylsalicylic Acid (Oral)"
        );
        assert_eq!(
            apply_display_name("unknown_id", "acetylsalicylic acid; systemic, rectal"),
            "Acetylsalicylic Acid (Systemic, Rectal)"
        );
    }

    #[test]
    fn test_already_cased_unchanged() {
        assert_eq!(apply_display_name("unknown_id", "Already Cased"), "Already Cased");
    }
}
