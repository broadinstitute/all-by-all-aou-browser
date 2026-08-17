---
name: phewas-analyzer
description: Query and cautiously interpret the top variant PheWAS associations exposed by the AxAoU MCP server.
metadata:
  ecosystem: genohype
  mcp-server: axaou
  mcp-tools:
    - aou_search_phenotypes
    - aou_variant_phewas
    - aou_phenotype_top_variants
---

# PheWAS Analyzer

You are running a Phenome-Wide Association Study (PheWAS) to discover which phenotypes are statistically associated with a specific genetic variant in the All of Us Research Program cohort.

PheWAS is the inverse of GWAS: instead of testing many variants for one phenotype, you test one variant against thousands of phenotypes to find unexpected clinical associations.

## Step 1: Variant Identification

1. Identify the target variant. Use the API's documented `chrom-pos-ref-alt` format (for example, `chr1-55039447-G-A`). Do not assume rsID or colon-delimited input is accepted.
2. If the user asked about a specific disease or phenotype rather than a variant, go to Step 1b first.

### Step 1b: Phenotype Resolution (Optional)

If the user wants to explore a phenotype rather than a variant:
1. Call `aou_search_phenotypes(query)` with the user's disease/phenotype term.
2. Present the matching `analysis_id` values with their descriptions and categories.
3. Let the user select the relevant phenotype.
4. Then use `aou_phenotype_top_variants(analysis_id)` to find the top associated variants, and proceed to Step 2 with a selected variant.

## Step 2: PheWAS Query

**If MCP is available** (check for `axaou` server):
- Call `aou_variant_phewas(variant_id)`.
- This returns:
  - **Variant annotation**: consequence, gene, allele frequency, allele count/number, homozygotes
  - **PheWAS associations**: up to 20 API-ordered phenotype rows with `variant_id`, `phenotype`, `pvalue`, `beta`, `se`, `af`, `ancestry`, and `sequencing_type`
  - **Total count**: the API's count before the MCP response is truncated to 20 rows
- The current response does **not** identify the modeled/effect allele, model family, outcome coding, or outcome transformation. A `beta` value alone therefore does not establish effect orientation or clinical direction.
- The MCP response model serializes numeric association fields as numbers and defaults missing upstream numeric values to `0`; do not treat a zero as proof of a true null estimate without checking upstream documentation.

**If MCP is unavailable**:
- This skill currently requires the `axaou` MCP server or REST API backend. Inform the user that PheWAS data cannot be queried via CLI alone.

## Step 3: Variant Context

Before analyzing the PheWAS results, summarize the variant:
1. **Gene and consequence**: What gene is this in? What is the predicted functional impact?
2. **Allele frequency**: How common is this variant? (AC/AN, AF, homozygote count)
3. **Population context**: Is this variant common enough to detect associations?
   - Very rare variants (AF < 0.001) may lack statistical power for PheWAS
   - Common variants (AF > 0.01) will have more robust associations

## Step 4: Statistical Filtering

Read `references/phewas-significance.md`.

1. For each returned association, report the `pvalue` without relabeling it as significant by default.
2. If the exact number of hypotheses in the relevant analysis family is known, calculate a Bonferroni reference as `0.05 / N`; otherwise state that a corrected threshold cannot be established from the top-20 response alone.
3. Treat `5 x 10^-8` only as a conventional single-phenotype GWAS reference, not as a universal PheWAS correction.
4. Keep nonsignificant rows when they help answer the question, but label them descriptive or exploratory.

### Interpreting Effect Estimates

- Report raw `beta` with `se` only as an uninterpreted upstream estimate unless its provenance and semantics are documented. Because the current MCP contract defaults missing numeric fields to `0`, say that this output cannot distinguish a true zero from a missing upstream value.
- Do not add an effect-direction, risk/protection, odds-ratio, or effect-unit column unless the modeled allele, model family, outcome coding, and any transformation needed for that interpretation are documented.
- Only with those definitions may the sign be translated into an allele-oriented increase/decrease. Use “risk increasing” or “protective” only when the outcome itself and its case/control coding make those clinical labels valid.
- For a documented logistic model, beta is on the log-odds scale and `exp(beta)` is the odds ratio for the documented modeled allele and outcome event. For a documented linear model, units depend on the documented outcome transformation.
- Compare magnitudes only across rows with compatible models, coding, and trait scales.

## Step 5: Ancestry Context

Read `references/ancestry-guidelines.md`.

1. Note the `ancestry` field for each reported association (or each association meeting a stated correction, when one is available):
   - `meta`: A cross-ancestry meta-analysis row; it may have greater precision but is not automatically the most robust result.
   - `afr`, `amr`, `eas`, `eur`, `mid`, `sas`: Population-specific signal.
2. If a signal is only seen in one ancestry group:
   - Check ancestry-specific allele frequency only if an appropriate external source or result field is available; the MCP annotation is not ancestry-stratified
   - Consider residual confounding, power, heterogeneity, and founder effects as possibilities rather than conclusions
   - Note this as a caveat in the report
3. Concordant estimates across ancestry analyses can strengthen confidence, but first verify that rows use comparable phenotype definitions, alleles, and models.

## Step 6: Synthesis

Generate a report with:

1. **Variant Summary**: ID, gene, consequence, allele frequency
2. **Associations/Results Table**:
   - Title it **Associations Meeting [Named Correction]** only when a correction family and threshold have been established; otherwise title it **Returned Associations (Exploratory)**.
   - Always use the contract-supported descriptive columns:

| Phenotype | P-value | Ancestry | Seq Type |
|-----------|---------|----------|----------|
| ... | ... | ... | ... |

   - Add `Raw beta` and `SE` columns only when useful, label them uninterpreted when model semantics are unknown, and note that zero-valued MCP fields may reflect defaults for missing upstream values.
   - Add an effect allele, effect direction, odds ratio, units, or risk/protection column **only** when the modeled allele, model, outcome coding, and relevant transformation are documented. Otherwise omit those columns rather than guessing.
3. **Scientific Interpretation**:
   - Group the returned phenotypes—or only those meeting the explicitly named correction—by organ system or disease category
   - Discuss effect direction only under the documentation conditions above; when they are unmet, explicitly state that direction and risk/protection cannot be determined from this MCP response
   - Describe unexpected patterns as hypothesis-generating, not “novel” without external literature review and replication
   - Identify whether known gene biology is plausibly consistent with the phenotype pattern, while separating external knowledge from the association output
4. **Caveats**:
   - PheWAS is hypothesis-generating, not hypothesis-confirming
   - Ancestry-specific signals require replication
   - Sparse counts can produce imprecise or unstable estimates; use standard errors or confidence intervals when available
   - The MCP response is truncated to 20 rows and does not by itself establish the complete multiple-testing universe

## When to Use This Skill

- Exploring the phenotypic impact of a variant of interest
- Discovering unexpected disease associations for a coding variant
- Checking whether a variant has pleiotropic effects across multiple organ systems
- Finding the strongest genetic associations for a specific phenotype
