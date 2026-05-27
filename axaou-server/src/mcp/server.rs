use std::sync::Arc;

use rmcp::{
    ServerHandler,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{ServerCapabilities, ServerInfo},
    tool, tool_handler, tool_router,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[allow(unused_imports)]
use genohype_mcp::GenomicDataProvider;
use genohype_mcp::tools::{gene::*, region::*, variant::*};

use crate::mcp::provider::AxaouMcpProvider;

// ---------------------------------------------------------------------------
// AoU API Client
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL: &str = "https://allbyall.researchallofus.org/api";

/// HTTP client for the AoU REST API.
#[derive(Clone)]
pub struct AouApiClient {
    base_url: String,
    http: reqwest::Client,
}

impl AouApiClient {
    pub fn new() -> Self {
        let base_url = std::env::var("AOU_API_URL")
            .unwrap_or_else(|_| DEFAULT_BASE_URL.to_string())
            .trim_end_matches('/')
            .to_string();
        Self {
            base_url,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .expect("failed to build HTTP client"),
        }
    }

    async fn get_json<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T, String> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.http.get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("AoU API returned {status}: {body}"));
        }

        resp.json::<T>().await.map_err(|e| format!("Failed to decode response: {e}"))
    }

    /// GET /analyses — returns all analysis metadata
    async fn get_analyses(&self) -> Result<Vec<AnalysisMetadata>, String> {
        self.get_json("/analyses").await
    }

    /// GET /variants/annotations/{variant_id}?extended=true
    async fn get_variant_annotation(&self, variant_id: &str) -> Result<Option<ApiVariantAnnotation>, String> {
        let path = format!("/variants/annotations/{}?extended=true", variant_id);
        self.get_json(&path).await
    }

    /// GET /variants/associations/phewas/{variant_id}
    async fn get_variant_phewas(&self, variant_id: &str) -> Result<LookupResult<ApiVariantAssociation>, String> {
        let path = format!("/variants/associations/phewas/{}", variant_id);
        self.get_json(&path).await
    }

    /// GET /genes/phewas/{gene_id}?ancestry=meta&annotation={annotation}
    async fn get_gene_burden_phewas(&self, gene_id: &str, annotation: &str) -> Result<LookupResult<ApiGeneAssociation>, String> {
        let path = format!("/genes/phewas/{}?ancestry=meta&annotation={}", gene_id, annotation);
        self.get_json(&path).await
    }

    /// GET /phenotype/{analysis_id}/genes?ancestry=meta&max_maf=0.001&annotation={annotation}
    async fn get_phenotype_genes(&self, analysis_id: &str, annotation: &str) -> Result<Vec<ApiGeneAssociation>, String> {
        let path = format!("/phenotype/{}/genes?ancestry=meta&max_maf=0.001&annotation={}", analysis_id, annotation);
        self.get_json(&path).await
    }

    /// GET /phenotype/{analysis_id}/significant?ancestry=meta&limit=100
    async fn get_phenotype_significant(&self, analysis_id: &str) -> Result<Vec<ApiSignificantVariant>, String> {
        let path = format!("/phenotype/{}/significant?ancestry=meta&limit=100", analysis_id);
        self.get_json(&path).await
    }
}

// ---------------------------------------------------------------------------
// API response types (deserialized from HTTP responses)
// ---------------------------------------------------------------------------

/// Generic LookupResult envelope from the API
#[derive(Debug, Deserialize, Serialize)]
struct LookupResult<T> {
    data: Vec<T>,
    count: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct AnalysisMetadata {
    analysis_id: String,
    #[serde(default)]
    ancestry_group: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    category: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct ApiVariantAnnotation {
    variant_id: String,
    #[serde(default)]
    gene_symbol: Option<String>,
    #[serde(default)]
    gene_id: Option<String>,
    #[serde(default)]
    consequence: Option<String>,
    #[serde(default, rename = "allele_frequency")]
    allele_frequency: Option<f64>,
    #[serde(default)]
    hgvsc: Option<String>,
    #[serde(default)]
    hgvsp: Option<String>,
    #[serde(default)]
    lof: Option<String>,
    #[serde(default)]
    allele_count: Option<u32>,
    #[serde(default)]
    allele_number: Option<u32>,
    #[serde(default)]
    homozygote_count: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct ApiVariantAssociation {
    variant_id: String,
    #[serde(default)]
    phenotype: String,
    #[serde(default)]
    pvalue: f64,
    #[serde(default)]
    beta: f64,
    #[serde(default)]
    se: f64,
    #[serde(default)]
    af: f64,
    #[serde(default)]
    ancestry: String,
    #[serde(default)]
    sequencing_type: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct ApiGeneAssociation {
    gene_id: String,
    gene_symbol: String,
    #[serde(default)]
    annotation: String,
    #[serde(default)]
    max_maf: f64,
    #[serde(default)]
    analysis_id: String,
    #[serde(default)]
    ancestry_group: String,
    #[serde(default)]
    pvalue: Option<f64>,
    #[serde(default)]
    neg_log10_p: Option<f64>,
    #[serde(default)]
    pvalue_burden: Option<f64>,
    #[serde(default)]
    neg_log10_p_burden: Option<f64>,
    #[serde(default)]
    pvalue_skat: Option<f64>,
    #[serde(default)]
    beta_burden: Option<f64>,
    #[serde(default)]
    mac: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct ApiSignificantVariant {
    #[serde(default)]
    locus_id: String,
    #[serde(default)]
    xpos: i64,
    #[serde(default)]
    position: i32,
    #[serde(default)]
    pvalue: f64,
    #[serde(default)]
    neg_log10_p: f32,
    #[serde(default)]
    is_significant: bool,
}

// ---------------------------------------------------------------------------
// MCP parameter types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, JsonSchema)]
pub struct AouSearchPhenotypesParams {
    /// Search query to filter phenotypes by description or analysis_id.
    /// Case-insensitive substring match.
    pub query: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct AouVariantPhewasParams {
    /// Variant ID in the format 'chrom-pos-ref-alt' (e.g., 'chr1-55039447-G-A').
    pub variant_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct AouGeneBurdenPhewasParams {
    /// Ensembl gene ID (e.g., 'ENSG00000008710') or gene symbol (e.g., 'PKD1').
    pub gene_id: String,
    /// Burden annotation filter. Options: 'pLoF', 'missense_LC', 'synonymous'.
    /// Defaults to 'pLoF'.
    pub annotation: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct AouPhenotypeTopGenesParams {
    /// The exact AoU phenotype/analysis ID (e.g., 'height', 'CM_761.13').
    /// Use aou_search_phenotypes first to find the analysis_id.
    pub analysis_id: String,
    /// Burden annotation filter. Options: 'pLoF', 'missense_LC', 'synonymous'.
    /// Defaults to 'pLoF'.
    pub annotation: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct AouPhenotypeTopVariantsParams {
    /// The exact AoU phenotype/analysis ID (e.g., 'height', 'CM_761.13').
    pub analysis_id: String,
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

/// Combined MCP server for AxAoU.
///
/// Contains 10 generic genomic tools (variant, gene, region) via the
/// [`GenomicDataProvider`] trait, plus 5 AoU-specific tools that call
/// the AoU REST API.
#[derive(Clone)]
pub struct AxaouMcpServer {
    provider: Arc<AxaouMcpProvider>,
    api_client: AouApiClient,
    #[allow(dead_code)]
    tool_router: ToolRouter<Self>,
}

impl AxaouMcpServer {
    pub fn new(provider: Arc<AxaouMcpProvider>, api_client: AouApiClient) -> Self {
        Self {
            provider,
            api_client,
            tool_router: Self::tool_router(),
        }
    }
}

impl std::fmt::Debug for AxaouMcpServer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AxaouMcpServer").finish()
    }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

#[tool_router]
impl AxaouMcpServer {
    // ========================================================================
    // Generic variant tools (thin wrappers over GenomicDataProvider)
    // ========================================================================

    #[tool(description = "Get detailed information about a specific genetic variant including allele frequencies, transcript consequences, and quality flags. Use variant IDs in the format 'chrom-pos-ref-alt' (e.g., 'chr1-55039447-G-A').")]
    async fn get_variant_details(
        &self,
        Parameters(params): Parameters<GetVariantDetailsParams>,
    ) -> String {
        let dataset = params.dataset.as_deref().unwrap_or("aou");
        match self.provider.get_variant_details(&params.variant_id, dataset).await {
            Ok(Some(details)) => serde_json::to_string_pretty(&details).unwrap_or_default(),
            Ok(None) => format!("Variant {} not found", params.variant_id),
            Err(e) => format!("Error: {e}"),
        }
    }

    #[tool(description = "Get a concise summary of a variant including its consequence, gene, and allele frequency. Lighter than get_variant_details.")]
    async fn get_variant_summary(
        &self,
        Parameters(params): Parameters<GetVariantSummaryParams>,
    ) -> String {
        let dataset = params.dataset.as_deref().unwrap_or("aou");
        match self.provider.get_variant_summary(&params.variant_id, dataset).await {
            Ok(Some(summary)) => serde_json::to_string_pretty(&summary).unwrap_or_default(),
            Ok(None) => format!("Variant {} not found", params.variant_id),
            Err(e) => format!("Error: {e}"),
        }
    }

    #[tool(description = "Get allele frequencies for a variant. Returns aggregate allele count, allele number, frequency, and homozygote counts from the All of Us cohort.")]
    async fn get_variant_frequencies(
        &self,
        Parameters(params): Parameters<GetVariantFrequenciesParams>,
    ) -> String {
        let dataset = params.dataset.as_deref().unwrap_or("aou");
        match self.provider.get_variant_frequencies(&params.variant_id, dataset).await {
            Ok(Some(freqs)) => serde_json::to_string_pretty(&freqs).unwrap_or_default(),
            Ok(None) => format!("Variant {} not found", params.variant_id),
            Err(e) => format!("Error: {e}"),
        }
    }

    #[tool(description = "Get detailed information for multiple variants in a single request. More efficient than calling get_variant_details repeatedly.")]
    async fn get_multiple_variant_details(
        &self,
        Parameters(params): Parameters<GetMultipleVariantDetailsParams>,
    ) -> String {
        let dataset = params.dataset.as_deref().unwrap_or("aou");
        match self.provider.get_multiple_variant_details(&params.variant_ids, dataset).await {
            Ok(details) => serde_json::to_string_pretty(&details).unwrap_or_default(),
            Err(e) => format!("Error: {e}"),
        }
    }

    // ========================================================================
    // Generic gene tools
    // ========================================================================

    #[tool(description = "Get summary information for a gene including its genomic coordinates, canonical transcript, and constraint metrics (pLI, LOEUF, missense Z). Accepts Ensembl gene IDs (ENSG...) or gene symbols (e.g., BRCA1).")]
    async fn get_gene_summary(
        &self,
        Parameters(params): Parameters<GetGeneSummaryParams>,
    ) -> String {
        match self.provider.get_gene_summary(&params.gene).await {
            Ok(Some(summary)) => serde_json::to_string_pretty(&summary).unwrap_or_default(),
            Ok(None) => format!("Gene {} not found", params.gene),
            Err(e) => format!("Error: {e}"),
        }
    }

    #[tool(description = "Get variants found within a gene from the All of Us annotation tables. Returns variant summaries with consequence, frequency, and gene annotation.")]
    async fn get_gene_variants(
        &self,
        Parameters(params): Parameters<GetGeneVariantsParams>,
    ) -> String {
        let dataset = params.dataset.as_deref().unwrap_or("aou");
        match self.provider.get_gene_variants(&params.gene_id, dataset, params.consequence.as_deref()).await {
            Ok(variants) => serde_json::to_string_pretty(&variants).unwrap_or_default(),
            Err(e) => format!("Error: {e}"),
        }
    }

    #[tool(description = "Get tissue-level gene expression data. Note: expression data is not currently available in the AoU dataset.")]
    async fn get_gene_expression_summary(
        &self,
        Parameters(params): Parameters<GetGeneExpressionParams>,
    ) -> String {
        match self.provider.get_gene_expression(&params.gene_id).await {
            Ok(Some(expr)) => serde_json::to_string_pretty(&expr).unwrap_or_default(),
            Ok(None) => format!("Expression data not available for {} in AoU dataset", params.gene_id),
            Err(e) => format!("Error: {e}"),
        }
    }

    #[tool(description = "List all transcripts for a gene with their biotype, canonical status, and RefSeq ID.")]
    async fn list_gene_transcripts(
        &self,
        Parameters(params): Parameters<ListGeneTranscriptsParams>,
    ) -> String {
        match self.provider.list_gene_transcripts(&params.gene_id).await {
            Ok(transcripts) => serde_json::to_string_pretty(&transcripts).unwrap_or_default(),
            Err(e) => format!("Error: {e}"),
        }
    }

    #[tool(description = "Get full details for a specific transcript including exon coordinates, biotype, and identifiers.")]
    async fn get_transcript_details(
        &self,
        Parameters(params): Parameters<GetTranscriptDetailsParams>,
    ) -> String {
        match self.provider.get_transcript_details(&params.transcript_id).await {
            Ok(Some(details)) => serde_json::to_string_pretty(&details).unwrap_or_default(),
            Ok(None) => format!("Transcript {} not found", params.transcript_id),
            Err(e) => format!("Error: {e}"),
        }
    }

    // ========================================================================
    // Generic region tools
    // ========================================================================

    #[tool(description = "Get variants in a genomic region defined by chromosome and start/end coordinates. Returns variant summaries from the All of Us annotation tables. Coordinates are 1-based, inclusive.")]
    async fn get_region_variants(
        &self,
        Parameters(params): Parameters<GetRegionVariantsParams>,
    ) -> String {
        let dataset = params.dataset.as_deref().unwrap_or("aou");
        match self.provider.get_region_variants(&params.chrom, params.start, params.end, dataset).await {
            Ok(variants) => serde_json::to_string_pretty(&variants).unwrap_or_default(),
            Err(e) => format!("Error: {e}"),
        }
    }

    // ========================================================================
    // AoU-specific tools (call REST API)
    // ========================================================================

    #[tool(description = "Search All of Us phenotypes/analyses by keyword. Returns matching analysis IDs with descriptions and categories. Use this to find the exact analysis_id needed by other AoU tools.")]
    async fn aou_search_phenotypes(
        &self,
        Parameters(params): Parameters<AouSearchPhenotypesParams>,
    ) -> String {
        let analyses = match self.api_client.get_analyses().await {
            Ok(a) => a,
            Err(e) => return format!("Error fetching analyses: {e}"),
        };

        // Client-side filtering (client-side)
        let query_lower = params.query.to_lowercase();
        let matches: Vec<&AnalysisMetadata> = analyses.iter()
            .filter(|a| {
                a.analysis_id.to_lowercase().contains(&query_lower)
                    || a.description.to_lowercase().contains(&query_lower)
                    || a.category.to_lowercase().contains(&query_lower)
            })
            .take(25)
            .collect();

        serde_json::to_string_pretty(&matches).unwrap_or_default()
    }

    #[tool(description = "Retrieves phenotype associations for a specific variant across all phenotypes in the All of Us cohort (variant PheWAS). Returns the variant's annotation plus its top 20 phenotype associations sorted by p-value.")]
    async fn aou_variant_phewas(
        &self,
        Parameters(params): Parameters<AouVariantPhewasParams>,
    ) -> String {
        // Fetch annotation and PheWAS concurrently (client-side)
        let annot_fut = self.api_client.get_variant_annotation(&params.variant_id);
        let phewas_fut = self.api_client.get_variant_phewas(&params.variant_id);
        let (annot_result, phewas_result) = tokio::join!(annot_fut, phewas_fut);

        let annotation = match annot_result {
            Ok(a) => a,
            Err(e) => return format!("Error fetching variant annotation: {e}"),
        };
        let phewas = match phewas_result {
            Ok(p) => p,
            Err(e) => return format!("Error fetching variant PheWAS: {e}"),
        };

        // Return top 20 associations
        let top_associations: Vec<&ApiVariantAssociation> = phewas.data.iter().take(20).collect();

        #[derive(Serialize)]
        struct Result<'a> {
            #[serde(skip_serializing_if = "Option::is_none")]
            annotation: &'a Option<ApiVariantAnnotation>,
            associations: Vec<&'a ApiVariantAssociation>,
            total_associations: usize,
        }

        serde_json::to_string_pretty(&Result {
            annotation: &annotation,
            associations: top_associations,
            total_associations: phewas.count,
        }).unwrap_or_default()
    }

    #[tool(description = "Retrieves phenotype associations driven by the aggregate variant burden of a specific gene in the All of Us cohort. Answers: 'What phenotypes are associated when this gene loses function?' Returns top 20 associations sorted by p-value.")]
    async fn aou_gene_burden_phewas(
        &self,
        Parameters(params): Parameters<AouGeneBurdenPhewasParams>,
    ) -> String {
        let annotation = params.annotation.as_deref().unwrap_or("pLoF");

        let result = match self.api_client.get_gene_burden_phewas(&params.gene_id, annotation).await {
            Ok(r) => r,
            Err(e) => return format!("Error fetching gene burden PheWAS: {e}"),
        };

        let top: Vec<&ApiGeneAssociation> = result.data.iter().take(20).collect();

        #[derive(Serialize)]
        struct Response<'a> {
            results: Vec<&'a ApiGeneAssociation>,
            total: usize,
        }

        serde_json::to_string_pretty(&Response {
            results: top,
            total: result.count,
        }).unwrap_or_default()
    }

    #[tool(description = "Retrieves the genes most significantly associated with a given phenotype based on burden testing in the All of Us cohort. Use aou_search_phenotypes first to find the analysis_id. Returns top 20 genes sorted by p-value.")]
    async fn aou_phenotype_top_genes(
        &self,
        Parameters(params): Parameters<AouPhenotypeTopGenesParams>,
    ) -> String {
        let annotation = params.annotation.as_deref().unwrap_or("pLoF");

        let mut genes = match self.api_client.get_phenotype_genes(&params.analysis_id, annotation).await {
            Ok(g) => g,
            Err(e) => return format!("Error fetching phenotype top genes: {e}"),
        };

        // Sort by p-value ascending (client-side)
        genes.sort_by(|a, b| {
            a.pvalue.unwrap_or(f64::MAX).partial_cmp(&b.pvalue.unwrap_or(f64::MAX))
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let total = genes.len();
        genes.truncate(20);

        #[derive(Serialize)]
        struct Response {
            results: Vec<ApiGeneAssociation>,
            total: usize,
        }

        serde_json::to_string_pretty(&Response {
            results: genes,
            total,
        }).unwrap_or_default()
    }

    #[tool(description = "Retrieves the most significant genome-wide single variants (Manhattan plot peaks) for a specific phenotype in the All of Us cohort. Returns top 20 variants sorted by p-value.")]
    async fn aou_phenotype_top_variants(
        &self,
        Parameters(params): Parameters<AouPhenotypeTopVariantsParams>,
    ) -> String {
        let mut variants = match self.api_client.get_phenotype_significant(&params.analysis_id).await {
            Ok(v) => v,
            Err(e) => return format!("Error fetching phenotype top variants: {e}"),
        };

        // Sort by p-value ascending (client-side)
        variants.sort_by(|a, b| {
            a.pvalue.partial_cmp(&b.pvalue).unwrap_or(std::cmp::Ordering::Equal)
        });

        let total = variants.len();
        variants.truncate(20);

        #[derive(Serialize)]
        struct Response {
            results: Vec<ApiSignificantVariant>,
            total: usize,
        }

        serde_json::to_string_pretty(&Response {
            results: variants,
            total,
        }).unwrap_or_default()
    }
}

// ---------------------------------------------------------------------------
// ServerHandler implementation
// ---------------------------------------------------------------------------

#[tool_handler]
impl ServerHandler for AxaouMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions(
                "All of Us (AoU) MCP server providing tools for querying variants, \
                 genes, and genomic regions from the All of Us research program. \
                 Includes AoU-specific tools for phenotype-wide association studies \
                 (PheWAS), gene burden analysis, and phenotype exploration."
            )
    }
}
