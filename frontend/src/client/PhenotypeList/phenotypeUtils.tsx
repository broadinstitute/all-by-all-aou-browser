import { AnalysisMetadata, GenePhewasAnnotated, GeneAssociations } from '../types'

/* eslint-disable no-plusplus */
export function getUniquePhenotypesFromVariantDataset(variants: any) {
  return variants.reduce((acc: any, variant: any) => {
    const { phenotype_id, logp } = variant

    const pheno = acc.find((v: any) => v.phenotype_id === phenotype_id)

    if (!pheno) {
      return [...acc, { ...variant, numSnps: 1 }]
    }

    if (pheno.logp > logp) {
      return [
        ...acc.filter((v: any) => v.phenotype_id !== phenotype_id),
        { ...pheno, numSnps: pheno.numSnps + 1 },
      ]
    }

    return [
      ...acc.filter((v: any) => v.phenotype_id !== phenotype_id),
      { ...variant, numSnps: pheno.numSnps + 1 },
    ]
  }, [])
}

function getRandomColor() {
  const letters = '0123456789ABCDEF'
  let color = '#'
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

export function getPhenotypes(variants: any) {
  const uniquePhenos = new Set()

  variants.forEach((v: any) => {
    uniquePhenos.add(v.phenotype_id)
  })

  return [...uniquePhenos]
}

export function colorPhenotypes(phenotypes: any) {
  return phenotypes.reduce((acc: any, p: any) => {
    return {
      ...acc,
      [p]: getRandomColor(),
    }
  }, {})
}

export const analysesIdFromAttrs = (analysis: any) =>
  `${analysis.trait_type}-${analysis.phenocode}-${analysis.pheno_sex}-${analysis.coding}-${analysis.modifier}`

export const analysesIdFromArray = (analysisIdArray: any) => {
  const keys = ['trait_type', 'phenocode', 'pheno_sex', 'coding', 'modifier']
  if (keys.length !== analysisIdArray.length) {
    console.warn('analysis id array different length than keys')
  }
  return analysisIdArray.join('-')
}

const capitalize = (text: any) => text.charAt(0).toUpperCase() + text.slice(1)

function prepareIcdPhenotype(phenotype: any) {
  if (phenotype) {
    let { description, description_more } = phenotype

    const icdDescriptionRe = /Date (\w+) first reported \((.+)\)/

    description = description || ''

    const match = description.match(icdDescriptionRe)

    if (match) {
      const icd10Code = match[1]
      let condition = match[2] || ''
      condition = capitalize(condition)
      description_more = `${description}; ${description_more}`
      description = `${icd10Code} ${condition}`
      return { ...phenotype, description, description_more }
    }
  }

  return phenotype
}

function prepareCustomPhenotype(phenotype: any) {
  if (phenotype) {
    const { phenocode, modifier } = phenotype

    const customPhenoRe = /custom/

    const match = modifier && modifier.match(customPhenoRe)

    if (match) {
      return { ...phenotype, description: phenocode.replace(/_/g, ' ') }
    }

    return phenotype
  }
  return phenotype
}

function prepareCodingDescriptionPhenotype(phenotype: any) {
  if (phenotype) {
    let { description, description_more } = phenotype
    const { coding_description } = phenotype

    const operationRe = /OPCS4|Non-cancer|Cancer code|Operation code|Treatment\/medication code/

    description = description || ''

    const match = description.match(operationRe)

    if (match) {
      description_more = `${description}; ${description_more}`
      description = capitalize(coding_description)
      return { ...phenotype, description, description_more }
    }

    return phenotype
  }

  return phenotype
}

const pipe =
  (...fns: any[]) =>
  (x: any) =>
    fns.reduce((v, f) => f(v), x)

export function preparePhenotypeText(phenotype: any) {
  return pipe(
    prepareIcdPhenotype,
    prepareCodingDescriptionPhenotype,
    prepareCustomPhenotype
  )(phenotype)
}

export const preparePhenotypesText = (phenotypes: any) =>
  phenotypes.map((phenotype: any) => preparePhenotypeText(phenotype))

export const modifyCategoryColor = (category: CategoriesResponse) => {
  if (category.color === '#079055') {
    return { ...category, color: '#add8e6' }
  }
  return category
}

interface ShowcaseGroup {
  category: string
  phenocodes: Set<string>
  analyses: Set<string>
  phenoCount: number
  analysisCount: number
  color: string
  classification_group: string
}

export interface CategoriesResponse {
  classification_group: string
  category: string
  phenocodes: string[]
  analyses: string[]
  phenoCount: number
  analysisCount: number
  color: string
}

export function createShowcaseGroups(categories: AnalysisMetadata[]): CategoriesResponse[] {
  const groupsMap = new Map<string, ShowcaseGroup>()

  categories.forEach((category) => {
    const { category: categoryNameOrNull, analysis_id } = category

    const categoryName = categoryNameOrNull ?? 'Unknown'

    let group = groupsMap.get(categoryName)

    if (!group) {
      group = {
        category: categoryName,
        phenocodes: new Set(),
        analyses: new Set(),
        phenoCount: 0,
        analysisCount: 0,
        color: '',
        classification_group: 'axaou_category',
      }
      groupsMap.set(categoryName, group)
    }

    group.phenocodes.add(analysis_id)
    group.analyses.add(analysis_id)
  })

  groupsMap.forEach((group) => {
    group.phenoCount = group.phenocodes.size
    group.analysisCount = group.analyses.size
    group.color = getRandomColor()
  })

  return Array.from(groupsMap.values()).map((group) => ({
    classification_group: group.classification_group,
    category: group.category,
    phenocodes: Array.from(group.phenocodes),
    analyses: Array.from(group.analyses),
    phenoCount: group.phenoCount,
    analysisCount: group.analysisCount,
    color: group.color,
  }))
}

export const annotateGenePhewasWithAnalysisMetadata = (
  genePhewasData: GeneAssociations[],
  analysesMetadata: AnalysisMetadata[] = []
): GenePhewasAnnotated[] => {
  return genePhewasData.map((geneAssociation) => {
    const analysisMeta = analysesMetadata.find(
      (analysis) => analysis.analysis_id === geneAssociation.analysis_id
    )
    if (analysisMeta) {
      return {
        ...geneAssociation,
        ...analysisMeta,
        phenocode: analysisMeta.analysis_id,
        saige_version: '1.0',
        inv_normalized: 'no',
        coding: 'C123',
        modifier: 'MOD1',
        n_cases_both_sexes: 1000,
        n_cases_females: 500,
        n_cases_males: 500,
        coding_description: 'Description of the coding',
        BETA: geneAssociation.beta_burden,
      }
    }
    return {
      ...geneAssociation,
      analysis_id: 'dummy_analysis_id',
      ancestry_group: 'dummy_ancestry_group',
      category: 'dummy_category',
      description: 'dummy_description',
      description_more: 'dummy_description_more',
      keep_pheno_burden: false,
      keep_pheno_skat: false,
      keep_pheno_skato: false,
      lambda_gc_acaf: null,
      lambda_gc_exome: null,
      lambda_gc_gene_burden_001: 0,
      n_cases: 0,
      n_controls: null,
      pheno_sex: 'dummy_pheno_sex',
      trait_type: 'dummy_trait_type',
      phenocode: 'dummy_phenocode',
      saige_version: '1.0',
      inv_normalized: 'no',
      coding: 'C123',
      modifier: 'MOD1',
      n_cases_both_sexes: 1000,
      n_cases_females: 500,
      n_cases_males: 500,
      coding_description: 'Description of the coding',
      BETA: geneAssociation.beta_burden,
    }
  })
}
