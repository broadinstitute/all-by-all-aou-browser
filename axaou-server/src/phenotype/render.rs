//! Viewport-aware rendering engine for region locus plots.
//!
//! Uses tiny-skia to rasterize variants server-side, matching the exact
//! visual parameters of the frontend canvas plot (LocusPvaluePlot.tsx).

use crate::error::AppError;
use tiny_skia::{Color, FillRule, Paint, PathBuilder, Pixmap, Stroke, StrokeDash, Transform};

// =============================================================================
// Data Models
// =============================================================================

/// A variant prepared for server-side rendering in the region plot.
#[derive(Debug, Clone)]
pub struct RenderVariant {
    pub position: i32,
    pub pvalue: f64,
    /// Pre-computed -log10(p) to handle extremely small p-values safely.
    pub neg_log10_p: Option<f64>,
    pub consequence: Option<String>,
    pub af: Option<f64>,
}

/// Consequence categories ordered by severity for Z-ordering (drawn back-to-front).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ConsequenceCategory {
    Other = 1,
    Synonymous = 2,
    Missense = 3,
    PLoF = 4,
}

impl ConsequenceCategory {
    /// Maps a VEP consequence string to its visual category, matching the
    /// frontend `getCategoryFromConsequence` (vepConsequences.ts).
    pub fn from_str(consequence: Option<&str>) -> Self {
        match consequence {
            Some("pLoF") | Some("lof") | Some("transcript_ablation")
            | Some("splice_acceptor_variant") | Some("splice_donor_variant")
            | Some("stop_gained") | Some("frameshift_variant") => Self::PLoF,

            Some("missense") | Some("missenseLC") | Some("stop_lost")
            | Some("start_lost") | Some("inframe_insertion")
            | Some("inframe_deletion") | Some("missense_variant") => Self::Missense,

            Some("synonymous") | Some("synonymous_variant") => Self::Synonymous,

            _ => Self::Other,
        }
    }

    /// Returns the RGBA color matching frontend `consequenceCategoryColorsMap` with 0.7 alpha.
    pub fn color(&self) -> Color {
        match self {
            Self::PLoF => Color::from_rgba8(255, 88, 63, 178),
            Self::Missense => Color::from_rgba8(240, 201, 77, 178),
            Self::Synonymous => Color::from_rgba8(128, 128, 128, 178),
            Self::Other => Color::from_rgba8(211, 211, 211, 178),
        }
    }
}

// =============================================================================
// Scales and Layout
// =============================================================================

/// Maps -log10(pvalue) values to pixel Y coordinates using a hybrid linear-log scale.
/// Matches `createLogLogScaleY` from frontend `logLogScale.ts`.
#[derive(Clone, Copy, Debug)]
pub struct YScale {
    height: f32,
    log_threshold: f64,
    linear_fraction: f64,
    max_log_val: f64,
}

impl YScale {
    pub fn new(height: u32) -> Self {
        Self {
            height: height as f32,
            log_threshold: 10.0,
            linear_fraction: 0.6,
            max_log_val: 300.0,
        }
    }

    pub fn get_y(&self, pvalue: f64, neg_log10_p: Option<f64>) -> f32 {
        let neg_log_p = if let Some(nlp) = neg_log10_p {
            nlp
        } else if pvalue <= 0.0 {
            self.max_log_val
        } else if pvalue > 1.0 || !pvalue.is_finite() {
            return self.height;
        } else {
            -pvalue.log10()
        };

        let linear_height = self.height as f64 * self.linear_fraction;
        let log_height = self.height as f64 * (1.0 - self.linear_fraction);

        if neg_log_p <= self.log_threshold {
            // Linear portion: [0, LOG_THRESHOLD] maps to [bottom, split_point]
            let normalized = neg_log_p / self.log_threshold;
            self.height - (normalized * linear_height) as f32
        } else {
            // Logarithmic portion: [LOG_THRESHOLD, MAX_NEG_LOG_P]
            let log_val = (neg_log_p / self.log_threshold).ln();
            let log_max = (self.max_log_val / self.log_threshold).ln();
            let normalized = (log_val / log_max).min(1.0);

            let y_in_log = normalized * log_height;
            ((self.height as f64 - linear_height - y_in_log) as f32).max(0.0)
        }
    }
}

/// Compute base circle radius from allele frequency, mapped logarithmically.
/// `[1e-6, 0.1]` -> `[2.0, 4.0]`.
fn compute_base_radius(af: Option<f64>) -> f32 {
    let af = af.unwrap_or(0.0);
    if af <= 1e-6 {
        return 2.0;
    }
    if af >= 0.1 {
        return 4.0;
    }
    let log_af = af.log10();
    let log_min = -6.0_f64; // log10(1e-6)
    let log_max = -1.0_f64; // log10(0.1)
    let fraction = (log_af - log_min) / (log_max - log_min);

    2.0 + (fraction * 2.0) as f32
}

// =============================================================================
// Renderer
// =============================================================================

/// Configuration parameters defining the viewport and scale.
#[derive(Debug, Clone)]
pub struct LocusPlotConfig {
    /// Physical pixel width (CSS width * DPR)
    pub width: u32,
    /// Physical pixel height (CSS height * DPR)
    pub height: u32,
    /// Device Pixel Ratio for scaling radii and strokes
    pub dpr: f32,
    /// Genomic start coordinate of the visible viewport
    pub start_pos: i32,
    /// Genomic end coordinate of the visible viewport
    pub end_pos: i32,
}

impl LocusPlotConfig {
    /// Map genomic position to pixel X coordinate.
    pub fn get_x(&self, pos: i32) -> f32 {
        let range = (self.end_pos - self.start_pos) as f64;
        if range <= 0.0 {
            return 0.0;
        }
        let fraction = (pos - self.start_pos) as f64 / range;
        (fraction * self.width as f64) as f32
    }
}

pub struct LocusRenderer {
    pixmap: Pixmap,
    config: LocusPlotConfig,
}

impl LocusRenderer {
    /// Create a new renderer with a transparent pixmap.
    pub fn new(config: LocusPlotConfig) -> Self {
        let pixmap = Pixmap::new(config.width, config.height)
            .expect("Failed to allocate pixmap. Dimensions may be too large.");

        Self { pixmap, config }
    }

    /// Draw a dashed horizontal line at the genome-wide significance threshold.
    pub fn draw_threshold_line(&mut self, pvalue: f64) {
        let scale = YScale::new(self.config.height);
        let y = scale.get_y(pvalue, None);

        let mut paint = Paint::default();
        // #DCDCDC (gainsboro) matching frontend canvas plot
        paint.set_color_rgba8(220, 220, 220, 255);
        paint.anti_alias = true;

        let mut stroke = Stroke::default();
        stroke.width = 2.0 * self.config.dpr;
        stroke.dash = StrokeDash::new(
            vec![3.0 * self.config.dpr, 3.0 * self.config.dpr],
            0.0,
        );

        let mut pb = PathBuilder::new();
        pb.move_to(0.0, y);
        pb.line_to(self.config.width as f32, y);

        if let Some(path) = pb.finish() {
            self.pixmap
                .stroke_path(&path, &paint, &stroke, Transform::identity(), None);
        }
    }

    /// Render variant points to the buffer, sorted by consequence severity (back-to-front).
    ///
    /// Uses direct pixel buffer manipulation instead of path-based anti-aliased
    /// circle rasterization. "Other" (non-coding/unknown) variants are downsampled
    /// by pixel column when dense, while Synonymous, Missense, and pLoF variants
    /// are always drawn at full fidelity.
    pub fn draw_variants(&mut self, variants: &[RenderVariant]) {
        let scale = YScale::new(self.config.height);
        let w = self.config.width as i32;
        let h = self.config.height as i32;

        // Max "Other" category variants to draw per pixel column when downsampling
        let max_other_per_column: usize = 8;

        // Separate variants by category: important ones (syn/mis/pLoF) are always
        // drawn; "Other" variants are downsampled when there are too many.
        let mut important: Vec<(f32, f32, f32, ConsequenceCategory)> = Vec::new();
        let mut other_variants: Vec<(f32, f32, f32, ConsequenceCategory)> = Vec::new();

        for v in variants {
            let category = ConsequenceCategory::from_str(v.consequence.as_deref());
            let x = self.config.get_x(v.position);
            if x < -50.0 || x > (w as f32 + 50.0) {
                continue;
            }
            let y = scale.get_y(v.pvalue, v.neg_log10_p);
            let radius = compute_base_radius(v.af) * self.config.dpr;

            match category {
                ConsequenceCategory::Other => other_variants.push((x, y, radius, category)),
                _ => important.push((x, y, radius, category)),
            }
        }

        // Downsample "Other" variants by pixel column if there are many
        let downsampled_other: Vec<(f32, f32, f32, ConsequenceCategory)> =
            if false && other_variants.len() > (w as usize * 2) {
                let mut columns: Vec<Vec<(f32, f32, f32, ConsequenceCategory)>> =
                    (0..w).map(|_| Vec::new()).collect();

                for pt in &other_variants {
                    let col = pt.0.round() as i32;
                    if col >= 0 && col < w {
                        columns[col as usize].push(*pt);
                    }
                }

                let mut result = Vec::with_capacity(w as usize * max_other_per_column);
                for col_pts in &columns {
                    if col_pts.len() <= max_other_per_column {
                        result.extend_from_slice(col_pts);
                    } else {
                        // Evenly sample across the column's variants (sorted by y for
                        // good visual distribution across the p-value axis)
                        let mut sorted = col_pts.clone();
                        sorted.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
                        let step = sorted.len() / max_other_per_column;
                        for i in (0..sorted.len()).step_by(step.max(1)).take(max_other_per_column)
                        {
                            result.push(sorted[i]);
                        }
                    }
                }
                result
            } else {
                other_variants
            };

        // Build final draw list: downsampled Other first (back), then important on top
        // Z-order: Other < Synonymous < Missense < pLoF
        let mut draw_list = downsampled_other;
        important.sort_by_key(|v| v.3);
        draw_list.extend(important);

        // Get mutable access to the pixel buffer (RGBA, premultiplied alpha)
        let pixels = self.pixmap.data_mut();

        for (cx, cy, r, category) in &draw_list {
            let color = category.color();

            // Pre-multiply alpha for direct pixel compositing
            let alpha = color.alpha();
            let src_r = (color.red() * alpha * 255.0) as u8;
            let src_g = (color.green() * alpha * 255.0) as u8;
            let src_b = (color.blue() * alpha * 255.0) as u8;
            let src_a = (alpha * 255.0) as u8;

            // Bounding box in pixel coordinates
            let x0 = ((*cx - r - 1.0).floor() as i32).max(0);
            let x1 = ((*cx + r + 1.0).ceil() as i32).min(w - 1);
            let y0 = ((*cy - r - 1.0).floor() as i32).max(0);
            let y1 = ((*cy + r + 1.0).ceil() as i32).min(h - 1);

            for py in y0..=y1 {
                let dy = py as f32 - cy;
                let dy_sq = dy * dy;
                let row_offset = (py * w) as usize;

                for px in x0..=x1 {
                    let dx = px as f32 - cx;
                    let dist_sq = dx * dx + dy_sq;

                    if dist_sq > (r + 1.0) * (r + 1.0) {
                        continue;
                    }

                    // Compute coverage for anti-aliased edge (1px feather)
                    let coverage = if dist_sq <= (r - 0.5) * (r - 0.5) {
                        1.0_f32
                    } else {
                        let dist = dist_sq.sqrt();
                        (r + 0.5 - dist).clamp(0.0, 1.0)
                    };

                    if coverage <= 0.0 {
                        continue;
                    }

                    let idx = (row_offset + px as usize) * 4;

                    // Source-over compositing with coverage
                    let ca = (src_a as f32 * coverage) as u8;
                    let cr = ((src_r as f32 * coverage) as u8).min(ca);
                    let cg = ((src_g as f32 * coverage) as u8).min(ca);
                    let cb = ((src_b as f32 * coverage) as u8).min(ca);

                    let dst_a = pixels[idx + 3];
                    if dst_a == 0 {
                        // Fast path: destination is transparent
                        pixels[idx] = cr;
                        pixels[idx + 1] = cg;
                        pixels[idx + 2] = cb;
                        pixels[idx + 3] = ca;
                    } else {
                        // Source-over blend (premultiplied)
                        let inv_a = 255 - ca;
                        pixels[idx] = cr.saturating_add(((pixels[idx] as u16 * inv_a as u16) / 255) as u8);
                        pixels[idx + 1] = cg.saturating_add(((pixels[idx + 1] as u16 * inv_a as u16) / 255) as u8);
                        pixels[idx + 2] = cb.saturating_add(((pixels[idx + 2] as u16 * inv_a as u16) / 255) as u8);
                        pixels[idx + 3] = ca.saturating_add(((dst_a as u16 * inv_a as u16) / 255) as u8);
                    }
                }
            }
        }
    }

    /// Encode the rendered pixmap to PNG bytes.
    pub fn encode_png(&self) -> Result<Vec<u8>, AppError> {
        self.pixmap
            .encode_png()
            .map_err(|e| AppError::DataTransformError(format!("PNG encoding failed: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // ConsequenceCategory
    // =========================================================================

    #[test]
    fn consequence_plof_variants() {
        for term in &[
            "pLoF",
            "lof",
            "transcript_ablation",
            "splice_acceptor_variant",
            "splice_donor_variant",
            "stop_gained",
            "frameshift_variant",
        ] {
            assert_eq!(
                ConsequenceCategory::from_str(Some(term)),
                ConsequenceCategory::PLoF,
                "{term} should map to PLoF"
            );
        }
    }

    #[test]
    fn consequence_missense_variants() {
        for term in &[
            "missense",
            "missenseLC",
            "missense_variant",
            "stop_lost",
            "start_lost",
            "inframe_insertion",
            "inframe_deletion",
        ] {
            assert_eq!(
                ConsequenceCategory::from_str(Some(term)),
                ConsequenceCategory::Missense,
                "{term} should map to Missense"
            );
        }
    }

    #[test]
    fn consequence_synonymous_variants() {
        assert_eq!(
            ConsequenceCategory::from_str(Some("synonymous")),
            ConsequenceCategory::Synonymous
        );
        assert_eq!(
            ConsequenceCategory::from_str(Some("synonymous_variant")),
            ConsequenceCategory::Synonymous
        );
    }

    #[test]
    fn consequence_other_and_none() {
        assert_eq!(
            ConsequenceCategory::from_str(Some("intron_variant")),
            ConsequenceCategory::Other
        );
        assert_eq!(
            ConsequenceCategory::from_str(Some("unknown")),
            ConsequenceCategory::Other
        );
        assert_eq!(
            ConsequenceCategory::from_str(None),
            ConsequenceCategory::Other
        );
    }

    #[test]
    fn consequence_severity_ordering() {
        assert!(ConsequenceCategory::Other < ConsequenceCategory::Synonymous);
        assert!(ConsequenceCategory::Synonymous < ConsequenceCategory::Missense);
        assert!(ConsequenceCategory::Missense < ConsequenceCategory::PLoF);
    }

    #[test]
    fn consequence_colors_have_alpha_178() {
        for cat in &[
            ConsequenceCategory::PLoF,
            ConsequenceCategory::Missense,
            ConsequenceCategory::Synonymous,
            ConsequenceCategory::Other,
        ] {
            let c = cat.color();
            // tiny-skia stores alpha as f32 0..1; 178/255 ≈ 0.698
            assert!(
                (c.alpha() - 178.0 / 255.0).abs() < 0.01,
                "{:?} alpha should be ~0.698, got {}",
                cat,
                c.alpha()
            );
        }
    }

    // =========================================================================
    // YScale
    // =========================================================================

    #[test]
    fn yscale_zero_pvalue_maps_to_top() {
        let scale = YScale::new(400);
        let y = scale.get_y(0.0, None);
        // p=0 → neg_log_p=300 (max) → should be at or near top (y=0)
        assert!(y <= 1.0, "p=0 should map near top, got y={y}");
    }

    #[test]
    fn yscale_pvalue_1_maps_to_bottom() {
        let scale = YScale::new(400);
        let y = scale.get_y(1.0, None);
        // p=1 → -log10(1)=0 → bottom of plot
        assert!(
            (y - 400.0).abs() < 0.01,
            "p=1 should map to bottom (400), got y={y}"
        );
    }

    #[test]
    fn yscale_threshold_at_split_point() {
        let scale = YScale::new(400);
        // At the log threshold (neg_log10_p = 10), y should be at the
        // boundary between linear and log regions: height - linear_fraction * height
        let y = scale.get_y(1e-10, None);
        let expected = 400.0 - (0.6 * 400.0); // 160.0
        assert!(
            (y - expected).abs() < 0.01,
            "p=1e-10 should be at split point {expected}, got y={y}"
        );
    }

    #[test]
    fn yscale_linear_region_is_proportional() {
        let scale = YScale::new(400);
        // In the linear region [0, 10], y should be proportional
        let y5 = scale.get_y(1e-5, None); // neg_log_p = 5
        let y10 = scale.get_y(1e-10, None); // neg_log_p = 10 (boundary)
        let y0 = scale.get_y(1.0, None); // neg_log_p = 0 (bottom)

        // y5 should be halfway between y0 and y10
        let midpoint = (y0 + y10) / 2.0;
        assert!(
            (y5 - midpoint).abs() < 0.01,
            "neg_log_p=5 should be at midpoint {midpoint}, got y5={y5}"
        );
    }

    #[test]
    fn yscale_neg_log10_p_override() {
        let scale = YScale::new(400);
        // When neg_log10_p is provided, it should be used instead of computing from pvalue
        let y_from_pvalue = scale.get_y(1e-5, None);
        let y_from_override = scale.get_y(999.0, Some(5.0)); // pvalue is ignored
        assert!(
            (y_from_pvalue - y_from_override).abs() < 0.01,
            "neg_log10_p override should match: {y_from_pvalue} vs {y_from_override}"
        );
    }

    #[test]
    fn yscale_monotonic_in_log_region() {
        let scale = YScale::new(400);
        // More significant variants (higher neg_log_p) should have lower y (higher on screen)
        let y_20 = scale.get_y(0.0, Some(20.0));
        let y_50 = scale.get_y(0.0, Some(50.0));
        let y_100 = scale.get_y(0.0, Some(100.0));
        let y_200 = scale.get_y(0.0, Some(200.0));

        assert!(
            y_20 > y_50 && y_50 > y_100 && y_100 > y_200,
            "Y should decrease (move up) as significance increases: {y_20} > {y_50} > {y_100} > {y_200}"
        );
    }

    #[test]
    fn yscale_invalid_pvalue_at_bottom() {
        let scale = YScale::new(400);
        assert_eq!(scale.get_y(2.0, None), 400.0, "p>1 should be at bottom");
        assert_eq!(
            scale.get_y(f64::NAN, None),
            400.0,
            "NaN should be at bottom"
        );
        assert_eq!(
            scale.get_y(f64::INFINITY, None),
            400.0,
            "Inf should be at bottom"
        );
    }

    // =========================================================================
    // Radius scaling
    // =========================================================================

    #[test]
    fn radius_none_af_returns_minimum() {
        assert_eq!(compute_base_radius(None), 2.0);
    }

    #[test]
    fn radius_zero_af_returns_minimum() {
        assert_eq!(compute_base_radius(Some(0.0)), 2.0);
    }

    #[test]
    fn radius_very_low_af_returns_minimum() {
        assert_eq!(compute_base_radius(Some(1e-8)), 2.0);
    }

    #[test]
    fn radius_high_af_returns_maximum() {
        assert_eq!(compute_base_radius(Some(0.5)), 4.0);
    }

    #[test]
    fn radius_boundary_values() {
        assert_eq!(compute_base_radius(Some(1e-6)), 2.0);
        assert_eq!(compute_base_radius(Some(0.1)), 4.0);
    }

    #[test]
    fn radius_mid_range_is_between_bounds() {
        // AF=1e-3.5 ≈ 0.000316 → halfway in log space between 1e-6 and 0.1
        // AF ≈ 0.000316 — midpoint in log space between 1e-6 and 0.1
        let r = compute_base_radius(Some(3.16e-4));
        assert!(r > 2.0 && r < 4.0, "mid-range AF should give radius between 2 and 4, got {r}");
    }

    #[test]
    fn radius_monotonic_with_af() {
        let r1 = compute_base_radius(Some(1e-5));
        let r2 = compute_base_radius(Some(1e-3));
        let r3 = compute_base_radius(Some(0.05));
        assert!(
            r1 < r2 && r2 < r3,
            "Radius should increase with AF: {r1} < {r2} < {r3}"
        );
    }

    // =========================================================================
    // LocusPlotConfig
    // =========================================================================

    #[test]
    fn config_get_x_maps_start_to_zero() {
        let config = LocusPlotConfig {
            width: 1200,
            height: 400,
            dpr: 1.0,
            start_pos: 1_000_000,
            end_pos: 2_000_000,
        };
        assert!((config.get_x(1_000_000) - 0.0).abs() < 0.01);
    }

    #[test]
    fn config_get_x_maps_end_to_width() {
        let config = LocusPlotConfig {
            width: 1200,
            height: 400,
            dpr: 1.0,
            start_pos: 1_000_000,
            end_pos: 2_000_000,
        };
        assert!((config.get_x(2_000_000) - 1200.0).abs() < 0.01);
    }

    #[test]
    fn config_get_x_midpoint() {
        let config = LocusPlotConfig {
            width: 1200,
            height: 400,
            dpr: 1.0,
            start_pos: 1_000_000,
            end_pos: 2_000_000,
        };
        assert!((config.get_x(1_500_000) - 600.0).abs() < 0.01);
    }

    // =========================================================================
    // LocusRenderer integration
    // =========================================================================

    #[test]
    fn renderer_produces_valid_png() {
        let config = LocusPlotConfig {
            width: 600,
            height: 200,
            dpr: 2.0,
            start_pos: 1_000_000,
            end_pos: 2_000_000,
        };
        let mut renderer = LocusRenderer::new(config);

        let variants = vec![
            RenderVariant {
                position: 1_200_000,
                pvalue: 1e-12,
                neg_log10_p: Some(12.0),
                consequence: Some("pLoF".to_string()),
                af: Some(0.001),
            },
            RenderVariant {
                position: 1_500_000,
                pvalue: 1e-5,
                neg_log10_p: Some(5.0),
                consequence: Some("missense_variant".to_string()),
                af: Some(0.01),
            },
            RenderVariant {
                position: 1_800_000,
                pvalue: 0.01,
                neg_log10_p: Some(2.0),
                consequence: Some("synonymous_variant".to_string()),
                af: Some(0.05),
            },
            RenderVariant {
                position: 1_100_000,
                pvalue: 0.1,
                neg_log10_p: Some(1.0),
                consequence: None,
                af: None,
            },
        ];

        renderer.draw_threshold_line(5e-8);
        renderer.draw_variants(&variants);

        let png_bytes = renderer.encode_png().expect("PNG encoding should succeed");

        // Valid PNG starts with the 8-byte PNG signature
        assert!(
            png_bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]),
            "Output should be a valid PNG (header check)"
        );
        assert!(
            png_bytes.len() > 100,
            "PNG should have meaningful content, got {} bytes",
            png_bytes.len()
        );
    }

    #[test]
    fn renderer_empty_variants_produces_png() {
        let config = LocusPlotConfig {
            width: 100,
            height: 100,
            dpr: 1.0,
            start_pos: 0,
            end_pos: 1000,
        };
        let mut renderer = LocusRenderer::new(config);
        renderer.draw_threshold_line(5e-8);
        renderer.draw_variants(&[]);

        let png_bytes = renderer.encode_png().expect("Should encode empty plot");
        assert!(png_bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]));
    }

    #[test]
    fn renderer_dpr_scales_output() {
        // At dpr=2, the pixmap should be at the specified width/height
        // (caller is expected to pass width*dpr, height*dpr as config dimensions)
        let config = LocusPlotConfig {
            width: 2400, // 1200 * 2
            height: 800, // 400 * 2
            dpr: 2.0,
            start_pos: 0,
            end_pos: 1_000_000,
        };
        let renderer = LocusRenderer::new(config);
        let png_bytes = renderer.encode_png().expect("Should encode");
        assert!(png_bytes.len() > 0);
    }

    #[test]
    fn renderer_threshold_line_visible() {
        // Render only a threshold line on a small canvas and verify pixels changed
        let config = LocusPlotConfig {
            width: 100,
            height: 100,
            dpr: 1.0,
            start_pos: 0,
            end_pos: 1000,
        };

        // Blank reference
        let blank = LocusRenderer::new(config.clone());
        let blank_png = blank.encode_png().unwrap();

        // With threshold line
        let mut with_line = LocusRenderer::new(config);
        with_line.draw_threshold_line(5e-8);
        let line_png = with_line.encode_png().unwrap();

        assert_ne!(
            blank_png, line_png,
            "Threshold line should change the rendered output"
        );
    }

    #[test]
    fn renderer_variants_change_output() {
        let config = LocusPlotConfig {
            width: 200,
            height: 200,
            dpr: 1.0,
            start_pos: 0,
            end_pos: 1_000_000,
        };

        let blank = LocusRenderer::new(config.clone());
        let blank_png = blank.encode_png().unwrap();

        let mut with_variants = LocusRenderer::new(config);
        with_variants.draw_variants(&[RenderVariant {
            position: 500_000,
            pvalue: 1e-8,
            neg_log10_p: Some(8.0),
            consequence: Some("missense".to_string()),
            af: Some(0.01),
        }]);
        let variant_png = with_variants.encode_png().unwrap();

        assert_ne!(
            blank_png, variant_png,
            "Drawing variants should change the rendered output"
        );
    }
}
