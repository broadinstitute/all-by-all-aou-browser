# **All by All Walkthrough**

## **Summary**

The All by All browser maps associations between genotypes and phenotypes using data contributed by *All of Us* Research Program participants as of July 1, 2022\. 

Using data from the Curated Data Repository (CDR) v7 data release, All by All encompasses 3,417 phenotypes with gene-based and single-variant testing across 214,216 participants with exome and genome sequence data from the *All of Us* Research Program.

With All by All, researchers can more easily uncover novel associations, dig deeper into understudied conditions, or validate other studies. We created the All by All browser to help researchers quickly visualize many phenotypes and genes simultaneously. 

Researchers can quickly navigate between genes, single variants, and phenotypes as well as actively explore data by mutation class (predicted loss-of-function, missense, synonymous).

## **Navigation and layout**

### **Overview**

The All by All browser has a split-screen design intended for rapidly inspecting and comparing many association results. The left-hand side displays a resizable Results Pane, which shows all hits for a given phenotype, gene, or variant. The right-hand side displays detailed association data for genes and variants with selected phenotype(s).

The Results Pane can shrink, expand, or be hidden entirely by clicking buttons. The central dotted line is also draggable left or right. This design is intended to help users to quickly inspect many associations without losing a sense of context. Either half can be easily hidden to create more screen room for an intended focus. Depending on the width of the Results Pane, certain controls and/or table columns may be automatically hidden.

The Status Bar displays the currently selected gene, phenotype, region, variant, and burden annotation set. Keep this in mind when cycling through the different Results Pane options as the data displayed will depend on the current state shown in the Status Bar.  

<img src="/SVG/walkthrough-layout.svg" />

To display top gene/phenotype searchers across All by All, click "Results" in the top navigation bar. This is a good place to start exploring the data.  

<img src="/SVG/walkthrough-overview.svg" />

### Caching and performance

In general, stronger associations load more quickly while non-significant associations load more slowly. Pay attention to rows that have green or yellow indicators as these associations will load faster.  

<img src="/SVG/walkthrough-caching.svg" />

## Exploring associations by phenotype

To display associations related to a specific phenotype, click a phenotype of interest. Additional information and several plot and tabular elements appear for examining the data from different angles.  

<img src="/SVG/walkthrough-phenotype-gene-manhattan.svg" />

The first section is an overview of the phenotype, including any descriptive statistics or metadata relevant to the phenotype such as phenotype category, sample size, and other general statistics.

Toggling between results for genes and single variants can be performed near the top of the browser.

Manhattan plots are provided showing the association p-values (-log10 scaled) across chromosomes. Each point represents a gene or variant with significant associations marked as higher points in the plot.

For genes, a quantile-quantile (QQ) plot is also provided to help visualize the distribution of p-values. This plot is used to identify any deviations from the expected null distribution, which can signal potential true associations or inflation in the test statistics.

Below the plots, there is a detailed tabular display of associations. Each row corresponds to a gene or variant and includes columns for various statistics such as p-values, effect sizes (betas), and other relevant metrics.

### Genome-wide burden results

For gene-level associations, three burden test types are provided and displayed as separate columns in the table. The burden test types available include:

* **Burden**: A traditional test that aggregates the effects of variants within a gene.  
* **SKAT**: A sequence kernel association test, which is often used for rare variant analysis.  
* **SKAT-O**: An optimized version of SKAT that combines burden and SKAT tests for greater power.

The Burden Set control allows researchers to specify a mutation class of interest:

* **Predicted Loss of Function (pLoF)**: Variants likely to disrupt gene function.  
* **Missense|LC**: Variants that cause an amino acid substitution, and those that have low-confidence pLoF annotations.  
* **Synonymous**: Variants that do not alter amino acid sequences and are generally presumed neutral.

Researchers can interact with the plot points or click the arrow under "Details," to update the right-hand panel with more detailed information about the selected gene or variant for further exploration.

### Genome-wide single variant results

In the single variant results view, researchers can explore genome-wide associations for individual variants in both visual and tabular formats.  

<img src="/SVG/walkthrough-phenotype-variant-manhattan.svg" />

Results can be filtered by consequence category, including:

* **Predicted Loss of Function (pLoF)**: Variants likely to disrupt gene function.  
* **Missense**: Variants that cause an amino acid substitution.  
* **Synonymous**: Variants that do not alter amino acid sequences.  
* **Other**: All other categories.

A detailed table lists all variants associated with the selected phenotype. Each row represents a variant with columns displaying key statistics such as p-value, effect size, allele frequency, and other metrics.

Clicking on a variant ID in the table or a point in the Manhattan plot will navigate to a **phenome-wide association studies (PheWAS)** view for that specific variant. Clicking the arrow under “Locus” displays a regional view surrounding the selected variant for examination of nearby genetic context.

## Exploring associations by gene

Clicking on a gene name will display all phenotypes associated with a particular gene in phenome-wide association studies (PheWAS) plot and tabular formats with a set of controls.

<img src="/SVG/walkthrough-overview.svg" />

### PheWAS controls

Use the phenotype control panel to finetune which set of phenotypes and test statistics to display. Researchers can specify one of three burden tests (Burden, SKAT, SKAT-O) or burden sets (pLoF, missense, synonymous) shown in the table and plot. 

<img src="/SVG/walkthrough-pheno-controls.svg" />

Phenotypes can be filtered by keywords such as phenotype description or trait type (continuous or categorical). The results can also be filtered by p-value using minimum and/or maximum threshold controls. The PheWAS plot is colored and grouped by category; the Categories section can be used to filter the phenotype list to those belonging to specific categories. P-values can be plotted on either log or double log scales.  


### Gene burden table

On the right-hand side, the gene burden table summarizes burden statistics and quality control metrics across all mutational classes and tests. The gene burden table is useful for comparing p-values across the tests and for determining whether the results should be treated with caution based on lambda GC or other gene quality control metrics.

<img src="/SVG/walkthrough-burden-table.svg" />

### Gene plot and table

The gene plot table displays single variants mapped to genomic coordinates along the gene exons. Variant \-log10p values are shown on the Y axis. The plot transitions to a double log scale ⅔ along the plot height to prevent variants with extremely low P-values from dominating the plot, which allows researchers to focus on novel, rare variant associations near the significance threshold. Variants are depicted as circles with the circle radii log-scaled by allele frequency. By default, variants are colored by their most severe Ensembl Variant Effect Predictor (VEP) consequence across transcripts.

Each variant is represented as a row in the table containing detailed summary statistics. Column headers have tooltips for learning what each column means, and the headers can be clicked to sort the table by a specific column.  

<img src="/SVG/walkthrough-gene-plot.svg" />

### Gene controls

The single variant analysis control panel is used to configure data displayed related to single variants. Variants can be filtered by identifier or by annotation using the search box. Researchers can focus on particular parts of the allele frequency spectrum by dragging the allele frequency filter slider. 

Researchers can also specify which columns to display using the column selection checkboxes or by choosing one of the column group presets. Each preset will select a particular set of columns that can be compared side-by-side (e.g. allele counts, frequencies, population counts, and columns best suited for categorical or continuous trait types). This section also enables features related to viewing multi-phenotypes and genome-wide association study (GWAS) catalog data.

<img width="50%" src="/SVG/walkthrough-gene-controls.svg" />

### Region view

The Region View is optimized for detailed exploration of association signals within a locus, which allows researchers to examine both single-variant and gene-level results in a single, cohesive interface.

Single-variant signals can sometimes highlight associations close to, but not within, known genes. Gene-burden results help contextualize these signals by showing whether nearby genes also have a cumulative burden of associated variants. This allows researchers to better prioritize candidate genes for further study, especially in loci where association peaks are near multiple genes.

Each point represents a variant plotted along genomic coordinates with p-values (double \-log10 scaled) on the y-axis to highlight the level of association with the phenotype. The view is designed to focus on both significant and near-significant associations with the x-axis spanning the specified region.

Under the plot, a table provides gene burden statistics for all genes within the selected locus. Each row represents a gene with columns detailing quality control metrics, p-values, and other burden test results.

Researchers can refine the region displayed with the zoom in/out buttons.

<img src="/SVG/walkthrough-region.svg" />

