# Ancestry Context in PheWAS Analysis

## Ancestry Groups in All of Us

The All of Us PheWAS results include ancestry-specific analyses:

| Code | Ancestry Group |
|------|---------------|
| `meta` | Meta-analysis across all populations |
| `afr` | African / African American |
| `amr` | Admixed American / Latino |
| `eas` | East Asian |
| `eur` | European |
| `mid` | Middle Eastern |
| `sas` | South Asian |

## Interpreting Ancestry-Specific Signals

### Meta-analysis rows (`ancestry="meta"`)

- Cross-ancestry meta-analysis row; confirm the upstream method before assuming fixed- or random-effects behavior
- Often has greater effective sample size and precision
- Is not automatically more robust: heterogeneity, model differences, and residual confounding still matter

### Population-specific rows (e.g., `ancestry="afr"`)

When an association meets a stated correction in only one ancestry group—or is prominent in only one group in an exploratory response:

1. **Check ancestry-specific allele frequency only from a suitable source**
   - The current MCP association row includes an `af` field, but verify its population scope before interpreting it as ancestry-specific
   - Frequency differences can change power and may explain why a signal is detectable in one analysis but not another

2. **Consider population stratification**
   - If the variant frequency correlates with a confounding environmental or social factor, the association may be spurious
   - Look for replication in at least one other ancestry group

3. **Founder effects**
   - Some variants are enriched in specific populations due to genetic drift or founder events
   - Associations in founder populations may be real but not generalizable

### Cross-population replication

More credible cross-ancestry patterns often show:
- evidence in a pre-specified meta-analysis and/or more than one ancestry analysis
- compatible effect direction only after confirming the modeled allele, model, outcome coding, and transformation
- effect estimates that are statistically compatible given their standard errors and model semantics; do not use an arbitrary fold-difference rule

The current MCP association contract does not expose the modeled allele, model family, outcome coding, or transformation. Without suitable external documentation, do not infer cross-ancestry direction, risk/protection, or odds ratios from beta signs.

### Red flags

- A large estimate with a large standard error or sparse allele/case counts
- Incompatible estimates after accounting for standard errors (possible heterogeneity or model differences)
- A population-specific row without meta-analysis support; investigate power and heterogeneity rather than treating this as proof of error

## Reporting Guidelines

When presenting PheWAS results:
1. Always note the ancestry for each reported association; call it significant only against an explicitly defined correction family and threshold
2. If a prominent result is meta-analysis only, describe it as such and report available heterogeneity/model context
3. If a prominent result is ancestry-specific, note this as a caveat requiring replication
4. Report allele frequency as ancestry-specific only when its scope is documented
5. Include direction or risk/protection labels only when modeled-allele and outcome/model semantics support them; otherwise omit those labels

## Sources

- All of Us Research Program: diversity and genomics documentation
- Current implementation: `axaou-server/src/mcp/server.rs` (`ApiVariantAssociation.ancestry`, `af`, `beta`, and `se`)
