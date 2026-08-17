# PheWAS Significance Thresholds

## Standard Thresholds

| Threshold | P-value | Context | Use |
|-----------|---------|---------|-----|
| **Conventional GWAS reference** | p < 5 x 10^-8 | Common single-phenotype GWAS convention | Context only; not a universal PheWAS correction |
| **Bonferroni reference** | p < 0.05 / N | Requires the exact analysis-family test count `N` | Use only when `N` is defined and defensible |
| **Exploratory result** | Analysis-specific | No universal cutoff | Report transparently and require validation |

## Bonferroni Correction

PheWAS tests a single variant against many phenotypes simultaneously. The Bonferroni correction adjusts for multiple testing:

```
corrected_threshold = alpha / number_of_tests
                    = 0.05 / N
```

Define `N` from the actual hypothesis family (including the treatment of ancestry and sequencing strata). The MCP tool returns only the first 20 rows plus an API count, so its response alone may not define the appropriate correction family.

### When Bonferroni Is Too Conservative

Bonferroni assumes all tests are independent. Many phenotypes are correlated (e.g., "Type 2 Diabetes" and "Elevated HbA1c"), so the effective number of independent tests is lower. Some studies use:
- **FDR (False Discovery Rate)**: q < 0.05 via Benjamini-Hochberg. Less conservative, allows more discoveries at the cost of more false positives.
- **Permutation-based thresholds**: Empirically calibrated. Most accurate but computationally expensive.

For initial interpretation, state the chosen correction family and method. If those are unknown, avoid categorical significance claims and describe the rows as exploratory.

## Interpreting P-values in Context

### Power Considerations

PheWAS power depends on:
1. **Variant allele frequency**: Common variants (AF > 1%) have much more power than rare variants
2. **Effect size**: Larger effects are easier to detect
3. **Phenotype prevalence**: Rare diseases have fewer cases, reducing power
4. **Sample size and model**: Use the analysis-specific case/control or quantitative-trait sample size and model documentation; do not substitute a program-wide enrollment count

### The AoU PheWAS Pipeline

The All of Us PheWAS results are pre-computed. The current `aou_variant_phewas` MCP implementation:
- preserves the upstream API row order rather than sorting client-side
- returns at most the first 20 associations plus the upstream total count
- exposes ancestry and sequencing-type fields when supplied by the API
- exposes beta, standard error, and allele frequency fields, whose interpretation still depends on upstream model documentation

## Sources

- Denny JC, et al. 2010, *Bioinformatics* 26:1205-1210 (PheWAS methodology)
- All of Us Research Program genomics data (variant-level association testing)
- Current implementation: `axaou-server/src/mcp/server.rs` (`aou_variant_phewas` and `ApiVariantAssociation`)
