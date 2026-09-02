# **All by All Walkthrough**

## **Summary**

The All by All browser maps associations between genotypes and phenotypes using data contributed by *All of Us* Research Program participants.

Using data from the Curated Data Repository (CDR) version 8 data release, All by All encompasses over 3,500 phenotypes with gene-based and single-variant testing across nearly 400,000 participants with exome and genome sequence data from the *All of Us* Research Program.

With All by All, researchers and others can more easily uncover novel associations, dig deeper into understudied conditions, or validate other studies. We created the All by All browser to help researchers quickly visualize many phenotypes and genes simultaneously.

Researchers can quickly navigate between genes, single variants, and phenotypes as well as actively explore data by mutation class (predicted loss-of-function, missense, synonymous).

## **Navigation and layout**

### **Overview**

The All by All browser offers two ways to work through the **Focused / Side by side** control in the Status Bar:

* **Focused mode:** Choose **Focused** for one task-oriented, vertically scrolling workspace and the best default for reading or exploring without narrow panes. Results and Details generally appear one page at a time, with related content kept together and a context-aware return action. Browser Back and Forward restore the originating results or workspace.
* **Side by side:** On sufficiently wide screens, use coordinated, resizable **Results** on the left and **Details** on the right for direct comparison. The layout controls select Results only, Split, or Details only, and the central dotted divider resizes the panes in Split view. Pane width can affect which controls or table columns are visible.

Switching modes preserves the selected phenotype, gene, locus, variant, and analyses, as well as the remembered Side-by-side layout where it remains valid. When both pages fit, Focused also offers **Compare side by side**. The Status Bar displays the current scientific context and includes a **Theme Toggle** for Light, Dark, and System (OS preference) display modes.

On phones, tablets, narrow desktop windows, or at high zoom, a Side-by-side preference temporarily shows one active page at a time. The preference and pane layout are retained, and widening the browser restores the prior layout. Focused remains one document. Wide tables scroll within their content area, and Details includes the same keyboard-accessible return action.

<img src="/SVG/1-walkthrough-layout@4x.png" />

To explore top results across the entire dataset, click "Results" in the top navigation bar. This section acts as a starting point, featuring an **Index of all genes and phenotypes**, as well as **Global top variant hits** and top gene burden associations across the entire All by All dataset.

<img src="/SVG/2-walkthrough-1-overview@4x.png" />

## Exploring associations by phenotype

To display associations related to a specific phenotype, click a phenotype of interest. The phenotype page utilizes a compact tabbed layout to seamlessly organize different views.

<img src="/SVG/3-walkthrough-overview-manhattan-full@4x.png" />

The first section is an overview of the phenotype, including any descriptive statistics or metadata relevant to the phenotype such as phenotype category, sample size, and other general statistics.

Below this, the **Phenotype Overview tab** integrates single variant results (exome and genome) with burden results, highlighting genes with coding variants. You can easily toggle between this overview, isolated Gene Burden results, Exome Variants, and Genome Variants using the tabs.

#### Locus definition

Loci are precomputed by the data pipeline using a greedy clumping algorithm applied to genome-wide significant variants (p < 5×10⁻⁸) and significant gene burden test results (p < 2.5×10⁻⁶). Variants are sorted by p-value and the most significant variant seeds a ±1 Mb window that absorbs all other significant variants within its range; this process repeats for the next most significant unabsorbed variant until all are assigned. Significant burden genes contribute their physical gene bounds expanded by the same ±1 Mb window. All resulting intervals on the same chromosome are then merged if they overlap, producing contiguous locus regions with exact start/stop boundaries. The browser uses these precomputed boundaries directly for peak annotation, overview merging, and navigation — ensuring a single, consistent definition of "locus" across the pipeline and frontend.

#### Peak labels and navigation

Each locus on the Overview Manhattan plot is labeled with a representative gene name. The label is chosen by prioritizing genes with the strongest evidence: first, genes with a significant burden test result (p < 2.5×10⁻⁶); then genes with coding variants (loss-of-function or missense); and finally, the nearest gene by physical distance (shown with a "nearest:" prefix). When a locus contains multiple implicated genes, a "+N" suffix indicates additional genes with evidence.

The number of labeled peaks can be adjusted using a slider or numeric input. By default, labels prioritize loci with gene-level evidence (burden or coding hits) over those without, then rank by p-value. The "Gene implicated" checkbox filters both the table and labels to only loci where at least one gene has burden or coding evidence. A "Min non-coding" filter (default: 3) hides loci that have only non-coding signal with fewer than the specified number of genome-wide significant variants, while always retaining loci with coding variants or burden associations. Individual peak labels can be toggled on or off via checkboxes in the locus table.

All significant peaks are visible on the plot as interactive dots, even those without a text label. Hovering over any peak dot displays a tooltip with gene and p-value information. Clicking a peak dot toggles its label on or off, providing a quick way to curate which loci are annotated without using the table checkboxes. Clicking the label text or leader line navigates to the most relevant view for that locus: if a gene in the locus has a significant burden result, it navigates to that gene's page; otherwise, if a gene has coding variants, it navigates to that gene; and as a fallback, it opens the Region View using the exact precomputed locus boundaries. Right-clicking a peak label or table row opens a context menu with additional options including opening in a new tab or copying coordinates.

Label curations — including which peaks are selected, custom label mode, top-N settings, and dragged label positions — are automatically persisted to the browser's local storage. This means your label selections and layout adjustments survive page refreshes and are restored when you return to the same phenotype and chromosome context.

Manhattan plots are provided showing the association p-values (-log10 scaled up to a maximum of 350) across chromosomes. These interactive plots feature pre-rendered PNG backgrounds with SVG overlays, allowing you to drag gene labels to prevent overlap, click peaks for more info, and export the plot as an image. When a peak lacks significant burden or coding evidence, the label will automatically display a "nearest:" prefix. You can also view **Overlay Manhattan plots**, which combine exome and genome signals to easily compare associations visually.

When zooming into a specific signal, a per-chromosome view with a dedicated chromosome selector becomes available. Additionally, precise pre-computed `neg_log10_p` fields are used throughout the API and frontend to ensure that extremely small, highly significant p-values are plotted and displayed accurately without underflowing to zero.

For genes, a quantile-quantile (QQ) plot is also provided to help visualize the distribution of p-values. This plot is used to identify any deviations from the expected null distribution, which can signal potential true associations or inflation in the test statistics.

Below the plots, there is a detailed tabular display of associations. Each row corresponds to a gene or variant and includes p-values and other relevant metrics. Effect estimates (betas) are shown only where they are available and scientifically interpretable.

Gene burden tables also report minor allele count (MAC) in a trait-aware form. Binary traits show **MAC cases** and **MAC controls**. Continuous traits have no case/control split, so pages scoped to one continuous phenotype show the existing aggregate count as **MAC total**. Mixed-phenotype PheWAS tables retain the split columns so binary rows remain comparable and display **N/A** for continuous rows. A dash means a count that applies to that trait is unavailable; zero is displayed as `0`.

### Genome-wide burden results

For gene-level associations, three burden test types are provided and displayed as separate columns in the table. The burden test types available include:

* **Burden**: A traditional test that aggregates the effects of variants within a gene.
* **SKAT**: A sequence kernel association test, which is often used for rare variant analysis.
* **SKAT-O**: An optimized version of SKAT that combines burden and SKAT tests for greater power.

The Burden Set control allows you to specify a mutation class of interest:

* **Predicted Loss of Function (pLoF)**: Variants likely to disrupt gene function.
* **Missense|LC**: Variants that cause an amino acid substitution, and those that have low-confidence pLoF annotations.
* **Synonymous**: Variants that do not alter amino acid sequences and are generally presumed neutral.

<img src="/SVG/4-walkthrough-gene-burden-manhattan@4x.png" />

In addition to the standard plots, gene burden results can be explored using a **Heatmap view**. The heatmap displays direction symbols and corner triangles for significance. Ancestry-specific results show their genuine burden beta on hover.

#### Interpreting META burden direction

META gene results combine ancestry-specific burden tests using a weighted Stouffer statistic. This statistic preserves the direction of the combined evidence, but its magnitude is **not** a beta, effect size, or odds ratio. The browser therefore shows only its sign:

* <span style="color:#0072b2">▲</span> **positive direction**
* <span style="color:#d55e00">▼</span> **negative direction**
* <span style="color:#6b7280">■</span> **zero direction**
* **—** direction unavailable

The symbols use both shape and color and include explanatory hover text. Positive and negative describe the sign of `META_Stats_Burden`; they do **not** by themselves mean increased risk, protection, or a particular effect magnitude. Use the corresponding burden p-value to assess statistical evidence.

<img src="/SVG/6-walkthrough-heatmap@4x.png" />

You can interact with plot points or click the arrow under "Details" to open more information about the selected gene or variant. In Focused mode, the information opens within one scrolling workspace with a context-aware return action. In Side by side mode, the same action updates the right-hand Details pane.

### Genome-wide single variant results

In the single variant results view, you can explore genome-wide associations for individual variants in both visual and tabular formats.

<img src="/SVG/5-walkthrough-manhattan-split-with-locus@4x.png" />

Results can be filtered by consequence category, including:

* **Predicted Loss of Function (pLoF)**: Variants likely to disrupt gene function.
* **Missense**: Variants that cause an amino acid substitution.
* **Synonymous**: Variants that do not alter amino acid sequences.
* **Other**: All other categories.

A detailed table lists all variants associated with the selected phenotype. Each row represents a variant with columns displaying key statistics such as p-value, effect size, allele frequency, and case/control association stats (`ac_cases`, `ac_controls`, `af_cases`, `af_controls`).

Clicking on a variant ID in the table or a point in the Manhattan plot will navigate to a **variant-specific phenome-wide association studies (Variant PheWAS)** view. Clicking the arrow under "Locus" displays a regional view surrounding the selected variant for examination of nearby genetic context.

## Exploring associations by gene

Clicking on a gene name will display all phenotypes associated with a particular gene in phenome-wide association studies (PheWAS) plot and tabular formats with display options.

<img src="/SVG/2-walkthrough-1-overview@4x.png" />

### PheWAS options

Use the PheWAS options panel to fine-tune which set of phenotypes and test statistics to display. You can specify one of three burden tests (Burden, SKAT, SKAT-O) or burden sets (pLoF, missense, synonymous) shown in the table and plot.

<img src="/SVG/9-walkthrough-pheno-controls@4x.png" />

Phenotypes can be filtered by keywords such as phenotype description or trait type (continuous or categorical). The results can also be filtered by p-value using minimum and/or maximum threshold controls. The PheWAS plot is colored and grouped by category; the Categories section can be used to filter the phenotype list to those belonging to specific categories.

The PheWAS plot includes a **"Directional" checkbox**, which plots upward triangles (▲) for risk (positive beta) and downward triangles (▼) for protective (negative beta) associations. The plot also features significance indicators and draggable labels to allow for clear, customized visualizations.

### Gene burden table

The association Details page summarizes gene burden statistics and quality control metrics across all mutational classes and tests. It appears as a full page in Focused mode and on the right in Side by side mode. The table is useful for comparing p-values across tests and deciding whether results should be treated with caution based on lambda GC or other gene quality control metrics.


### Gene plot and table

The gene plot table displays single variants mapped to genomic coordinates along the gene exons. Variant \-log10p values are shown on the Y axis. The plot transitions to a double log scale ⅔ along the plot height to prevent variants with extremely low P-values from dominating the plot, which allows you to focus on novel, rare variant associations near the significance threshold. Variants are depicted as circles or protein-paint style lollipop labels with the circle radii log-scaled by allele frequency. By default, variants are colored by their most severe Ensembl Variant Effect Predictor (VEP) consequence across transcripts.

Each variant is represented as a row in the table containing detailed summary statistics. Column headers have tooltips for learning what each column means, and the headers can be clicked to sort the table by a specific column.

<img src="/SVG/7-walkthrough-gene-plot-with-variants@4x.png" />

### Gene options

The gene options panel is used to configure data displayed related to single variants. Variants can be filtered by identifier or by annotation using the search box. You can focus on particular parts of the allele frequency spectrum by dragging the allele frequency filter slider.

You can also specify which columns to display using the column selection checkboxes or by choosing one of the column group presets. Each preset will select a particular set of columns that can be compared side-by-side (e.g. allele counts, frequencies, population counts, and columns best suited for categorical or continuous trait types). This section also enables features related to viewing multi-phenotypes and genome-wide association study (GWAS) catalog data.

<img width="50%" src="/SVG/8-walkthrough-gene-controls@4x.png" />

### Region view

The Region View is optimized for detailed exploration of association signals within a locus, which allows you to examine both single-variant and gene-level results in a single, cohesive interface. Throughout the browser, you can right-click on genes and loci to access **unified context menus**, providing quick options to open PheWAS views, open links in new tabs, or copy coordinates/symbols.

Single-variant signals can sometimes highlight associations close to, but not within, known genes. Gene-burden results help contextualize these signals by showing whether nearby genes also have a cumulative burden of associated variants. This allows researchers to better prioritize candidate genes for further study, especially in loci where association peaks are near multiple genes.

Each point represents a variant plotted along genomic coordinates with p-values (double \-log10 scaled) on the y-axis to highlight the level of association with the phenotype. The view is designed to focus on both significant and near-significant associations with the x-axis spanning the specified region.

Under the plot, a table provides gene burden statistics for all genes within the selected locus. Each row represents a gene with columns detailing quality control metrics, p-values, and other burden test results.

You can refine the region displayed with the zoom in/out buttons.

<img src="/SVG/10-walkthrough-region@4x.png" />

## Exploring associations by variant

In addition to exploring by phenotype or gene, you can investigate the pleiotropic effects of specific genetic variants across the entire phenome.

### Global top variant results

To discover the most significant single-variant associations across the All by All dataset, navigate to the **Top Single Variants** tab in the global Results section. This table aggregates the strongest variant-phenotype associations globally, allowing you to filter by consequence (e.g., pLoF, Missense) or search for specific variant ID, gene, or phenotype keyword.

<img src="/SVG/11-walkthrough-variant-top-results@4x.png" />

### Variant PheWAS

Clicking on a specific variant ID from any table will open the **Variant PheWAS** (Phenome-Wide Association Study) view. This plot displays all phenotypes significantly associated with that particular variant across the dataset. Just like the Gene PheWAS view, you can use the control panel to filter the displayed phenotypes by category, keyword, or specific P-value thresholds, and toggle directional shapes to see risk versus protective effects.

<img src="/SVG/12-walkthrough-variant-phewas-results@4x.png" />

### Variant details and gene context

When exploring a variant's PheWAS, selecting an association updates the variant's scientific context. In Focused mode, the relevant information stays together in one scrolling workspace. In Side by side mode, Results can remain on the left while Details open in the right-hand pane. The annotations include its Ensembl Variant Effect Predictor (VEP) consequence, HGVS notations, allele frequencies, and case/control breakdowns.

<img src="/SVG/13-walkthrough-variant-phewas-gene@4x.png" />

## Results

Brief descriptions about each of the results included in the All by All browser are listed below.

### Gene level associations

| Field | Description |
|-------|-------------|
| Description | Description of the phenotype |
| Phenotype ID | The phenotype ID is unique to the phenotype of interest |
| Category | Assigned phenotype category |
| N cases | Cases were defined as participants who have the phenotype of interest. For continuous traits, this number reflects the total sample size |
| N controls | Controls were defined as participants who did not have the phenotype of interest. For continuous traits, this number should be 0 |
| Trait type | Binary or continuous variable |
| Phenocode | The phenocode is unique to the phenotype of interest |
| Sex | Sex specific or both sexes included |
| Gene | Gene of interest used for association testing with the selected phenotype |
| P-value (Burden) | Output p-value from a traditional test that aggregates the effects of variants within a gene |
| P-value (SKAT) | Output p-value from a sequence kernel association test, often used for rare variant analysis |
| P-value (SKAT-O) | Output p-value from an optimized version of SKAT that combines burden and SKAT tests for greater power |
| Beta | Only available for burden tests; represents the direction of association between the gene and phenotype of interest. The magnitude is not readily interpretable given the weights applied in association testing |
| MAC cases | Minor allele count among cases for a binary trait |
| MAC controls | Minor allele count among controls for a binary trait |
| MAC total | Total minor allele count across the analyzed sample for a continuous trait |

### Single variant associations

| Field | Description |
|-------|-------------|
| Variant ID | Unique string for identifying a variant |
| CSQ | Variant Effect Predictor most severe consequence, based on a subjective pre-defined ranking of possible impacts on a gene |
| HGVS | Human Genome Variation Society nomenclature for standardized annotation of genetic variants (coding or protein level) |
| P-value | Output p-value from statistical test |
| Beta | Represents the direction of association between the variant and phenotype of interest. The magnitude is not readily interpretable given the weights applied in association testing |
| AC META | Allele count in the meta-analysis population (regardless of trait measured) |
| Hom META | Homozygote count in the meta-analysis population (regardless of trait measured) |
| AN META | Allele number in the meta-analysis population (regardless of trait measured) |
| AF META | Allele frequency in the meta-analysis population (regardless of trait measured) |
| AC Case | Allele count in cases |
| AC Cont | Allele count in controls |
| AF Case | Allele frequency in cases |
| AF Cont | Allele frequency in controls |
