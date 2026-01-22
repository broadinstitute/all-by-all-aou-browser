/* eslint-disable no-underscore-dangle */
import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql'

import {
  isVariantId,
  normalizeVariantId,
  // isRsId,
} from '@gnomad/identifiers'

import { minBy } from 'lodash'

import axios from 'axios'

const fetchGenebassResultsByVariantId = async (variantId: string) => {
  try {
    let data

    try {
      const response = await axios(`https://main.genebass.org/api/variant/${variantId}`)
      data = await response.data
    } catch (error) {
      return null
    }

    if (Array.isArray(data)) {
      return {
        gene_id: data[0].gene_id,
        phenotypes: data[0].phewas_hits,
      }
    }
  } catch (err) {
    return null
  }

  return null
}

export const SearchResultType = new GraphQLObjectType({
  name: 'SearchResult',
  fields: {
    label: { type: new GraphQLNonNull(GraphQLString) },
    url: { type: new GraphQLNonNull(GraphQLString) },
  },
})

const REGION_ID_REGEX = /^(chr)?(\d+|x|y|m|mt)[-:]([0-9]+)([-:]([0-9]+)?)?$/i

// @ts-expect-error ts-migrate(7006) FIXME: Parameter 'str' implicitly has an 'any' type.
export const isRegionId = str => {
  const match = REGION_ID_REGEX.exec(str)
  if (!match) {
    return false
  }

  const chrom = match[2].toLowerCase()
  const chromNumber = Number(chrom)
  if (!Number.isNaN(chromNumber) && (chromNumber < 1 || chromNumber > 22)) {
    return false
  }

  const start = Number(match[3])
  const end = Number(match[5])

  if (end && end < start) {
    return false
  }

  return true
}

// @ts-expect-error ts-migrate(7006) FIXME: Parameter 'regionId' implicitly has an 'any' type.
export const normalizeRegionId = regionId => {
  const parts = regionId.split(/[-:]/)
  const chrom = parts[0].toUpperCase().replace(/^CHR/, '')
  let start = Number(parts[1])
  let end

  if (parts[2]) {
    end = Number(parts[2])
  } else {
    end = start + 20
    start = Math.max(start - 20, 0)
  }

  return `${chrom}-${start}-${end}`
}

// @ts-expect-error ts-migrate(7006) FIXME: Parameter 'ctx' implicitly has an 'any' type.
export const resolveSearchResults = async (ctx, query) => {
  if (isVariantId(query)) {
    const variantId = normalizeVariantId(query)
    console.log(variantId)

    const result = await fetchGenebassResultsByVariantId(variantId)

    if (result) {
      const geneId = result.gene_id
      const phenotypes = result.phenotypes
      const topAnalysis: any = minBy(phenotypes, a => a.pvalue)

      const url = `/gene/${geneId}/phenotype/${
        topAnalysis.analysis_id
      }/variant/${variantId}?resultIndex=variant-phewas`

      return [
        {
          label: variantId,
          url,
        },
      ]
    }
  }

  if (isRegionId(query)) {
    const regionId = normalizeRegionId(query)
    return [
      {
        label: regionId,
        url: `/region/${regionId}`,
      },
    ]
  }

  const upperCaseQuery = query.toUpperCase()

  if (/^ENSG[0-9]/.test(upperCaseQuery)) {
    const geneIdSearchResponse = await ctx.database.elastic.search({
      index: 'ukbb-t3-genes-search-with-results',
      body: {
        query: {
          bool: {
            must: { prefix: { gene_id: upperCaseQuery } },
            // Gene must exist in the version of Gencode for the selected dataset
          },
        },
      },
      size: 5,
    })

    if (geneIdSearchResponse.hits.total === 0) {
      return []
    }

    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'hit' implicitly has an 'any' type.
    return geneIdSearchResponse.hits.hits.map(hit => {
      const gene = hit._source

      let gene_url

      if (!gene.burden_sets) {
        gene_url = `/gene/not-in-analysis`
      } else if (gene.burden_sets.includes('pLoF')) {
        gene_url = `/gene/${gene.gene_id}?burdenSet=pLoF`
      } else if (gene.burden_sets.includes('missense|LC')) {
        gene_url = `/gene/${gene.gene_id}?burdenSet=missense|LC`
      } else if (gene.burden_sets.includes('synonymous')) {
        gene_url = `/gene/${gene.gene_id}?burdenSet=synonymous`
      }
      return {
        label: `${gene.gene_id} (${gene.symbol})`,
        url: gene_url,
      }
    })
  }

  const geneSymbolSearchResponse = await ctx.database.elastic.search({
    index: 'ukbb-t3-genes-search-with-results',
    body: {
      query: {
        bool: {
          must: {
            bool: {
              should: [
                { term: { symbol: upperCaseQuery } },
                { prefix: { symbol: upperCaseQuery } },
              ],
            },
          },
          // Gene must exist in the version of Gencode for the selected dataset
        },
      },
    },
    size: 30,
  })

  const matchingGenes =
    geneSymbolSearchResponse.hits.total > 0
      ? // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'hit' implicitly has an 'any' type.
        geneSymbolSearchResponse.hits.hits.map(hit => hit._source)
      : []

  const geneNameCounts = {}
  // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'gene' implicitly has an 'any' type.
  matchingGenes.forEach(gene => {
    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (geneNameCounts[gene.symbol] === undefined) {
      // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      geneNameCounts[gene.symbol] = 0
    }
    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    geneNameCounts[gene.symbol] += 1
  })

  const geneResults = matchingGenes
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'acc' implicitly has an 'any' type.
    .reduce((acc, gene) => {
      // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'g' implicitly has an 'any' type.
      if (acc.some(g => g.symbol === gene.symbol)) {
        return acc
      }
      return [...acc, gene]
    }, [])
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'gene' implicitly has an 'any' type.
    .map(gene => {
      let gene_url

      if (!gene.burden_sets) {
        gene_url = `/gene/not-in-analysis`
      } else if (gene.burden_sets.includes('pLoF')) {
        gene_url = `/gene/${gene.gene_id}?burdenSet=pLoF`
      } else if (gene.burden_sets.includes('missense|LC')) {
        gene_url = `/gene/${gene.gene_id}?burdenSet=missense|LC`
      } else if (gene.burden_sets.includes('synonymous')) {
        gene_url = `/gene/${gene.gene_id}?burdenSet=synonymous`
      }

      return {
        // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        label: geneNameCounts[gene.symbol] > 1 ? `${gene.symbol} (${gene.gene_id})` : gene.symbol,
        url: gene_url,
      }
    })

  console.log(geneResults)

  if (geneResults.length < 5 && /^rs[0-9]/i.test(query)) {
    // @ts-expect-error ts-migrate(7034) FIXME: Variable 'variantResults' implicitly has type 'any... Remove this comment to see the full error message
    let variantResults
    try {
      const response = await axios({
        url: 'https://gnomad.broadinstitute.org/api',
        method: 'post',
        data: {
          query: `{
            variant(rsid: "${query}", dataset: gnomad_r3) {
              variant_id
              rsid
            }
          }
      `,
        },
      })

      const { variant } = response.data.data

      variantResults = [
        {
          label: `${variant.variant_id} (${variant.rsid})`, // eslint-disable-line no-underscore-dangle
          url: `/variant/${variant.variant_id}`, // eslint-disable-line no-underscore-dangle
        },
      ]
    } catch (err) {
      console.log(err)
      variantResults = []
    }

    // @ts-expect-error ts-migrate(7005) FIXME: Variable 'variantResults' implicitly has an 'any[]... Remove this comment to see the full error message
    return geneResults.concat(variantResults)
  }

  if (geneResults.length < 5) {
    const phenotypeSearchResponse = await ctx.database.elastic.search({
      index: 'ukbb-t3-pheno-info-prepared',
      _source: ['analysis_id', 'description', 'description_more', 'category'],
      body: {
        query: {
          bool: {
            must: {
              multi_match: {
                query,
                fields: ['analysis_id', 'description', 'description_more', 'category'],
                type: 'phrase_prefix',
                // fuzziness: 'AUTO',
              },
            },
          },
        },
      },
      size: 30,
    })

    let matchingPhenotypes =
      phenotypeSearchResponse.hits.total > 0
        ? phenotypeSearchResponse.hits.hits
            // .filter(p => p._source.annotation === 'pLoF') // HACK
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'hit' implicitly has an 'any' type.
            .map(hit => {
              const { analysis_id, description } = hit._source
              return {
                label: `${analysis_id} - ${description || ''}`,
                url: `/gene/undefined/phenotype/${analysis_id}`,
              }
            })
        : []

    // const excludeKeywords = ["pfizer", "biogen", "AbbVie"]
    const excludeKeywords: any[] = []

    matchingPhenotypes = matchingPhenotypes.filter((p: any) => {
      return excludeKeywords.every(k => !p.url.includes(k))
    })

    return geneResults.concat(matchingPhenotypes)
  }

  return geneResults
}
