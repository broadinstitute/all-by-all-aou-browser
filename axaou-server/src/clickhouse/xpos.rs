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

/// Parse interval "chr1:100-200" or "1:100-200" -> (xpos_start, xpos_end)
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
}
