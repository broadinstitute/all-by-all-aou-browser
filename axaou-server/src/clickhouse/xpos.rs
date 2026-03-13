//! xpos coordinate utilities
//!
//! The xpos format encodes (chromosome, position) as a single i64 value,
//! enabling efficient range queries across chromosomes.
//!
//! Formula: `xpos = contig_num * 1_000_000_000 + position`
//!
//! Contig mapping:
//! - 1-22: Autosomes
//! - 23: X chromosome
//! - 24: Y chromosome
//! - 25: MT/M chromosome

use crate::error::AppError;

/// Convert chromosome and position to xpos (legacy gnomAD style int64)
///
/// Formula: `contig_num * 1_000_000_000 + position`
pub fn compute_xpos(contig: &str, position: u32) -> i64 {
    let contig_normalized = contig.trim_start_matches("chr");
    let contig_num = match contig_normalized.to_uppercase().as_str() {
        "X" => 23,
        "Y" => 24,
        "M" | "MT" => 25,
        _ => contig_normalized.parse::<i64>().unwrap_or(0),
    };

    if contig_num == 0 {
        return 0; // Invalid contig
    }

    contig_num * 1_000_000_000 + position as i64
}

/// Parse variant ID "chr1-12345-A-T" or "1-12345-A-T" -> (xpos, ref, alt)
pub fn parse_variant_id(variant_id: &str) -> Result<(i64, String, String), AppError> {
    let parts: Vec<&str> = variant_id.split('-').collect();
    if parts.len() != 4 {
        return Err(AppError::InvalidInterval(format!(
            "Invalid variant ID format '{}'. Expected chr-pos-ref-alt",
            variant_id
        )));
    }

    let contig = parts[0];
    let pos: u32 = parts[1].parse().map_err(|_| {
        AppError::InvalidInterval(format!("Invalid position in variant ID: {}", parts[1]))
    })?;
    let ref_allele = parts[2].to_string();
    let alt_allele = parts[3].to_string();

    let xpos = compute_xpos(contig, pos);
    if xpos == 0 {
        return Err(AppError::InvalidInterval(format!(
            "Invalid chromosome in variant ID: {}",
            contig
        )));
    }

    Ok((xpos, ref_allele, alt_allele))
}

/// Reverse xpos back to (chromosome, position)
///
/// Formula: `contig_num = xpos / 1_000_000_000`, `position = xpos % 1_000_000_000`
pub fn reverse_xpos(xpos: i64) -> (String, u32) {
    let contig_num = xpos / 1_000_000_000;
    let position = (xpos % 1_000_000_000) as u32;

    let contig = match contig_num {
        1..=22 => contig_num.to_string(),
        23 => "X".to_string(),
        24 => "Y".to_string(),
        25 => "M".to_string(),
        _ => "?".to_string(),
    };

    (contig, position)
}

/// Generate a variant ID string from components
///
/// Format: "chr{contig}-{position}-{ref}-{alt}"
pub fn make_variant_id(contig: &str, position: u32, ref_allele: &str, alt_allele: &str) -> String {
    let normalized = contig.trim_start_matches("chr");
    format!("chr{}-{}-{}-{}", normalized, position, ref_allele, alt_allele)
}

/// Generate a variant ID string from xpos and alleles
///
/// Format: "chr{contig}-{position}-{ref}-{alt}"
pub fn make_variant_id_from_xpos(xpos: i64, ref_allele: &str, alt_allele: &str) -> String {
    let (contig, position) = reverse_xpos(xpos);
    make_variant_id(&contig, position, ref_allele, alt_allele)
}

/// Parsed partial variant ID for search queries.
pub struct PartialVariantId {
    pub contig: String,
    pub position_prefix: String,
    pub ref_allele: String,
    pub alt_allele: String,
}

/// Parse a partial variant ID string for autocomplete search.
/// Returns the contig and position prefix (as a string for LIKE matching),
/// plus optional ref/alt alleles.
///
/// e.g. "chr13-32400"  -> contig="chr13", position_prefix="32400"
/// e.g. "1-12345-A-T"  -> contig="1", position_prefix="12345", ref="A", alt="T"
pub fn parse_partial_variant_id(query: &str) -> Option<PartialVariantId> {
    let parts: Vec<&str> = query.split(|c| c == '-' || c == ':').collect();
    if parts.len() < 2 {
        return None;
    }

    let contig = parts[0];
    let pos_str = parts[1];

    // Position must be non-empty digits
    if pos_str.is_empty() || !pos_str.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }

    // Validate contig is real
    if compute_xpos(contig, 1) == 0 {
        return None;
    }

    let ref_allele = parts.get(2).unwrap_or(&"").to_uppercase();
    let alt_allele = parts.get(3).unwrap_or(&"").to_uppercase();

    Some(PartialVariantId {
        contig: contig.to_string(),
        position_prefix: pos_str.to_string(),
        ref_allele,
        alt_allele,
    })
}

pub fn parse_interval_to_xpos(interval: &str) -> Result<(i64, i64), AppError> {
    let parts: Vec<&str> = interval.split(':').collect();
    if parts.len() != 2 {
        return Err(AppError::InvalidInterval(format!(
            "Invalid interval format '{}'. Expected chr:start-end",
            interval
        )));
    }

    let contig = parts[0];
    let range_parts: Vec<&str> = parts[1].split('-').collect();
    if range_parts.len() != 2 {
        return Err(AppError::InvalidInterval(format!(
            "Invalid range format in interval '{}'. Expected start-end",
            interval
        )));
    }

    let start: u32 = range_parts[0].parse().map_err(|_| {
        AppError::InvalidInterval(format!("Invalid start position: {}", range_parts[0]))
    })?;
    let end: u32 = range_parts[1].parse().map_err(|_| {
        AppError::InvalidInterval(format!("Invalid end position: {}", range_parts[1]))
    })?;

    let xpos_start = compute_xpos(contig, start);
    let xpos_end = compute_xpos(contig, end);

    if xpos_start == 0 || xpos_end == 0 {
        return Err(AppError::InvalidInterval(format!(
            "Invalid chromosome in interval: {}",
            contig
        )));
    }

    Ok((xpos_start, xpos_end))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_xpos() {
        assert_eq!(compute_xpos("chr1", 12345), 1_000_012_345);
        assert_eq!(compute_xpos("1", 12345), 1_000_012_345);
        assert_eq!(compute_xpos("chr22", 1000), 22_000_001_000);
        assert_eq!(compute_xpos("X", 5000), 23_000_005_000);
        assert_eq!(compute_xpos("chrX", 5000), 23_000_005_000);
        assert_eq!(compute_xpos("Y", 100), 24_000_000_100);
        assert_eq!(compute_xpos("MT", 1), 25_000_000_001);
    }

    #[test]
    fn test_parse_variant_id() {
        let (xpos, ref_a, alt_a) = parse_variant_id("chr1-12345-A-T").unwrap();
        assert_eq!(xpos, 1_000_012_345);
        assert_eq!(ref_a, "A");
        assert_eq!(alt_a, "T");

        let (xpos, ref_a, alt_a) = parse_variant_id("22-1000-ACGT-G").unwrap();
        assert_eq!(xpos, 22_000_001_000);
        assert_eq!(ref_a, "ACGT");
        assert_eq!(alt_a, "G");
    }

    #[test]
    fn test_parse_interval() {
        let (start, end) = parse_interval_to_xpos("chr1:100-200").unwrap();
        assert_eq!(start, 1_000_000_100);
        assert_eq!(end, 1_000_000_200);
    }

    #[test]
    fn test_reverse_xpos() {
        assert_eq!(reverse_xpos(1_000_012_345), ("1".to_string(), 12345));
        assert_eq!(reverse_xpos(22_000_001_000), ("22".to_string(), 1000));
        assert_eq!(reverse_xpos(23_000_005_000), ("X".to_string(), 5000));
        assert_eq!(reverse_xpos(24_000_000_100), ("Y".to_string(), 100));
        assert_eq!(reverse_xpos(25_000_000_001), ("M".to_string(), 1));
    }

    #[test]
    fn test_make_variant_id() {
        assert_eq!(
            make_variant_id("1", 12345, "A", "T"),
            "chr1-12345-A-T"
        );
        assert_eq!(
            make_variant_id("chr22", 1000, "ACGT", "G"),
            "chr22-1000-ACGT-G"
        );
    }

    #[test]
    fn test_parse_partial_variant_id() {
        let p = parse_partial_variant_id("chr1-123").unwrap();
        assert_eq!(p.contig, "chr1");
        assert_eq!(p.position_prefix, "123");
        assert_eq!(p.ref_allele, "");
        assert_eq!(p.alt_allele, "");

        let p = parse_partial_variant_id("chr13-32400").unwrap();
        assert_eq!(p.contig, "chr13");
        assert_eq!(p.position_prefix, "32400");

        let p = parse_partial_variant_id("1-12345-A-T").unwrap();
        assert_eq!(p.contig, "1");
        assert_eq!(p.position_prefix, "12345");
        assert_eq!(p.ref_allele, "A");
        assert_eq!(p.alt_allele, "T");

        // Invalid contig returns None
        assert!(parse_partial_variant_id("chrZ-123").is_none());
        // Need at least chr + pos
        assert!(parse_partial_variant_id("chr1").is_none());
    }

    #[test]
    fn test_make_variant_id_from_xpos() {
        assert_eq!(
            make_variant_id_from_xpos(1_000_012_345, "A", "T"),
            "chr1-12345-A-T"
        );
        assert_eq!(
            make_variant_id_from_xpos(23_000_005_000, "C", "G"),
            "chrX-5000-C-G"
        );
    }
}
