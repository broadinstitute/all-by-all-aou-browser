# Frequently Asked Questions

**What is the All by All browser?**

The All by All browser is an interactive tool, powered by data contributed by *All of Us* participants across the United States and its territories, that maps associations between genotypes and phenotypes in the *All of Us* Research Program dataset.

**Who created the All by All browser?**

The All by All browser was created by a team of researchers and staff members at the Broad Institute, the *All of Us* Data and Research Center, and the National Institutes of Health.

**Why was the All by All browser created?**

The All by All browser was created as a hypothesis generating resource to help researchers visualize, explore, and identify possible associations between a specified trait, gene, variant, and region. The All by All browser serves as a starting point for researchers to identify possible gene and phenotype candidates for further research and validation studies.

**What results are included in the All by All browser?**

The All by All browser includes results of gene and rare variant association analysis with specific phenotypes from the *All of Us* [Curated Data Repository (CDR)](https://support.researchallofus.org/hc/en-us/articles/30294451486356-Curated-Data-Repository-CDR-version-8-Release-Notes), which includes phenotype and genotype data from nearly 400,000 participants with whole genome sequencing data in the *All of Us* Research Program.

The All by All encompasses over 3,500 phenotypes with gene-based and single-variant associations from nearly 400,000 whole genome sequences. In total, billions of associations are presented in the browser, including results for individual common variants (e.g., population-specific allele frequency (AF) > 1% or population-specific allele count (AC) > 100, within any computed genetic ancestry populations) as well as tests of groups of rare variants, such as burden tests of predicted loss-of-function.

The data for the phenotypes were drawn from the [Personal and Family Health History survey, Mental Health and Well-Being surveys,](https://www.researchallofus.org/data-tools/survey-explorer/) [physical measurements, medication exposures, phecodes, phecode X, and lab measurements](https://www.researchallofus.org/data-tools/data-sources/).

Analyses were run separately by computed genetic ancestry groups and then combined into a meta-analysis to ensure that the analysis captured robust findings across the whole cohort, while controlling for biased results arising from population stratification. This approach has been previously deployed in [large biobanks](https://www.nature.com/articles/s41588-025-02335-7), and shows similarly well-calibrated summary statistics in the *All of Us* cohort. [Read more about how *All of Us* computes genetic ancestry](https://aousupporthelp.zendesk.com/hc/en-us/articles/4614687617556#h_01GY7QYC017WWMXFB0YTT233G1). For more information about the methods and limitations of this analysis, please refer to ["What are the limitations of the All by All browser?"](#limitations) below.

Details about included results can be found in the [All by All browser walkthrough](/walkthrough) under "Results".

**What is a genotype?**

A [genotype](https://www.genome.gov/genetics-glossary/genotype) is a specific sequence of DNA within a gene. To identify a person's genotype, their DNA must be analyzed (e.g., through genome sequencing). Some genotypes contribute to an individual's phenotype, or observable trait.

**What is a phenotype?**

A [phenotype](https://www.genome.gov/genetics-glossary/Phenotype) is an observable trait, something you can see or measure, such as eye color or blood type. A person's phenotype may be influenced by both their genomic makeup (genotype) and environmental factors.

<a id="limitations"></a>

**What are the limitations of the All by All browser?**

The All by All browser displays results from statistical tests of association between thousands of genotypes (i.e., genetic variants) and phenotypes (i.e., traits or health conditions), which provide clues about genes and genetic variants that may contribute to health-related phenotypes.

Importantly, though, the All by All browser is intended as a tool to help researchers generate hypotheses for further study. Due to certain limitations of the analysis, discussed below, definitive conclusions should not be drawn from these associations without additional research. Researchers must be aware of these limitations so that they can accurately interpret the information in the browser and use it appropriately.

### General methodological limitations

The All by All results are based on statistical correlations between genes and/or genetic variants and a given trait. These correlations do not necessarily signify causal relationships. Genes and genetic variants can also correlate with traits for many other reasons, including [linkage disequilibrium](https://www.cancer.gov/publications/dictionaries/genetics-dictionary/def/linkage-disequilibrium), variations in genetic structure of populations, and complex interactions between genes. It's also important to note that while All by All performed analyses that partially account for population structure, there are non-genetic factors that can distort the results and lead to false positives. These factors include environmental differences between populations.

### Limitations due to group assignment methodology

Groups that have a shared geographic history have patterns in their DNA--referred to as [genetic ancestry](https://www.genome.gov/about-genomics/policy-issues/population-descriptors-in-genomics#raceandethnicity)--that reflect this shared history. Researchers have to account for these non-random patterns in genetic variant frequencies (called population structure) to increase the accuracy of their analyses. All by All estimated participants' genetic ancestry and assigned each person to a single genetic ancestry group. They excluded people who fit into more than one group. Genetic ancestry group assignments like this are imperfect because, in reality, genetic ancestry is continuous, meaning individuals cannot be easily divided into distinct groups. Furthermore, people aren't usually descended from single ancestral populations, meaning assigning people to a single genetic ancestry group masks more complex genetic ancestry.

### Limitations due to excluded data

Most traits are [complex](https://medlineplus.gov/genetics/understanding/mutationsanddisorders/complexdisorders/), in that they are a product of multiple factors. Often this collection of factors includes a combination of biological and non-biological contributors. However, the All by All analysis is restricted to single gene or gene variant-trait associations, excluding both additional genes and environmental, behavioral, social, and other non-biological factors that might contribute. This means any results derived from the All by All data may provide an incomplete picture of many of the traits for which the browser provides data. It is important as researchers to consider all possible contributing factors before drawing any conclusions. Additional research is required to understand associations that may be indicated in the All by All results.

**Can anyone use the All by All browser?**

Yes, anyone can use the public All by All browser.

For access to the full dataset and the ability to explore these associations in more detail, researchers must [register with the *All of Us* Researcher Workbench](https://www.researchallofus.org/register/).

**How should I use the All by All browser?**

To use the public browser, you can start by [searching for a genotype or phenotype of interest](https://allbyall.researchallofus.org/), and the browser will display a table of related associations. The All by All browser provides information about associations between genotypes and phenotypes but cannot tell us whether a genotype causes a specific phenotype. For more information, refer to ["What are the limitations of the All by All browser?"](#limitations). You can also visit our [walkthrough](/walkthrough) page for more information.

**Do I need experience conducting genome-wide association studies (GWAS) to use the All by All browser?**

No, you do not need experience with genome-wide association studies (GWAS) to use the All by All browser. However, familiarity with genomics research may help you better understand the results.

**What kind of research is possible with the All by All browser?**

The All by All browser may help researchers generate hypotheses for research studies by searching for possible genetic variants and associated phenotypes of interest. Researchers interested in accessing *All of Us* data may also explore the All by All browser to understand the potential utility of this data before registering for or beginning their research study on the Researcher Workbench.

For access to the full dataset and the ability to explore these associations in more detail, researchers must [register with the *All of Us* Researcher Workbench](https://www.researchallofus.org/register/).

**Can I combine the All by All results with other *All of Us* data?**

Registered researchers can use the *All of Us* Researcher Workbench to explore these genotype-phenotype associations more deeply and download summary statistics. To work with the All by All results further, you must [register for the *All of Us* Researcher Workbench](https://www.researchallofus.org/register/).

**How often is the All by All browser updated?**

Data are updated periodically, with the date last updated available on the All by All browser [homepage](https://allbyall.researchallofus.org/).

**If I find an association within the browser, what does that mean?**

If you see an association in the All by All results, that only means there is a possible association between a genotype and phenotype. This does not necessarily mean that the genotype caused the phenotype, and further research is needed to determine the nature of that connection.

For more information, please refer to ["What are the limitations of the All by All browser?"](#limitations).

**How does the All by All browser protect participant privacy?**

All by All presents an analysis of the associations between genotypes and phenotypes, based on data from nearly 400,000 *All of Us* participants with whole genome sequence data. While powerful, these summary statistical analyses only provide information that can help guide further research. Within the *All of Us* [Researcher Workbench](https://workbench.researchallofus.org/), researchers can access a far more expansive and deeply integrated dataset to support research.

In accordance with program policy, the All by All browser applied for an exception to the [Data and Statistics Dissemination Policy](https://www.researchallofus.org/faq/data-and-statistics-dissemination-policy/) to display genotype-phenotype associations with participant counts fewer than 20. The program's Resource Access Board granted this exception on May 17, 2024, in light of the browser's scientific utility and minimal risk to participant privacy. For more information about program policies and policy compliance, please review the Program [Data Access Tiers](https://www.researchallofus.org/data-tools/data-access/).

**Have participants consented to share these data?**

Yes, all participants consent to participate in the *All of Us* Research Program and share their data for biomedical and health research. To learn more, visit [JoinAllofUs.org](http://JoinAllofUs.org).

**Why do the counts in the All by All browser differ from the number of participants as shown in the Data Snapshots or Data Browser?**

The All by All browser was constructed with data contributed by *All of Us* participants as part of [Curated Data Repository version 8](https://support.researchallofus.org/hc/en-us/articles/30294451486356-Curated-Data-Repository-CDR-version-8-Release-Notes). For this reason, the number of participants may differ from the number of currently enrolled participants shown in the [Data Snapshots](https://www.researchallofus.org/data-tools/data-snapshots/). The number may also differ from the current number of participants with data available in the *All of Us* Researcher Workbench as shown in the [Data Browser](https://databrowser.researchallofus.org/). The All by All browser will be updated periodically, with the date last updated available on the All by All browser [homepage](https://allbyall.researchallofus.org/).

**How did *All of Us* decide which phenotypes to include in the All by All browser?**

The data for the phenotypes were drawn from participants' responses to the [Personal and Family Health History survey](https://www.researchallofus.org/data-tools/survey-explorer/), [Mental Health and Well-Being surveys](https://www.researchallofus.org/data-tools/survey-explorer/), [physical measurements, and electronic health record data](https://www.researchallofus.org/data-tools/data-sources/) on medication exposures, conditions, and lab measurements. All potential phenotypes from these data were included, as long as more than 200 cases per computed genetic ancestry category were available to provide power for gene discovery.

For more information, please refer to ["What are the limitations of the All by All browser?"](#limitations).

**How can I download results from the All by All browser?**

To protect participant privacy, *All of Us* does not permit downloads of publicly available data, such as the All by All browser results. Researchers can learn more about the data available from *All of Us* and register for access to the *All of Us* Researcher Workbench at [ResearchAllofUs.org](https://researchallofus.org/).

Registered researchers can use the *All of Us* Researcher Workbench to explore these genotype-phenotype associations more deeply and combine data from association tables with other data types. Within the Researcher Workbench, registered researchers can also download summary tables for publication, including All by All data.

**How can I cite All by All in my research project?**

We request that any use of All by All data includes a statement acknowledging the contribution of *All of Us* participants and the program, such as:

> "We gratefully acknowledge *All of Us* participants for their contributions, without whom this research would not have been possible. We also thank the National Institutes of Health's [*All of Us* Research Program](https://allofus.nih.gov/) for making available the participant data examined in this study."

A manuscript describing the All by All analysis is under active development. Once complete, this section will be updated to include the appropriate citation and we request that the use of any All by All data cite the specified manuscript.
