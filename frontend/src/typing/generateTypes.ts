import axios from 'axios'
import { writeTypeForTable } from './quicktype'
const fs = require('fs')

let geneAnalysesPrepared = JSON.parse(
  fs.readFileSync(__dirname + '/copiedObjects/geneAnalysesPrepared.json')
) as string[]

// let variantsPrepared = JSON.parse(
//   fs.readFileSync(__dirname + '/copiedObjects/variantsPrepared.json')
// ) as string[]

const API_URL = 'http://localhost:5000/api'

const quicktypeOutputPath = `${__dirname}/../../src/client/types/generated`

const phenotypeId = 'categorical-20004-both_sexes-1368-'
const burdenSet = 'pLoF'
const geneIdOrName = 'ENSG00000139618'
const variantId = '13-32338517-AC-A'

const queries = [
  // {
  //   typeName: 'AnalysisResponse',
  //   url: `/analysis/${phenotypeId}/gene-manhattan?burdenSet=${burdenSet}`,
  // },
  // {
  //   typeName: 'AnalysesMetadataResponse',
  //   url: `/phenotypes`,
  // },
  // {
  //   typeName: 'TopGenesResponse',
  //   url: `/top-genes?burdenSet=${burdenSet}`,
  // },
  // {
  //   typeName: 'GenePhewasResponse',
  //   url: `/phewas/${geneIdOrName}?burdenSet=${burdenSet}`,
  // },
  // {
  //   typeName: 'CategoriesResponse',
  //   url: `/categories`,
  // },
  // // {
  // //   typeName: 'TopPhenotypesResponse',
  // //   url: `/top-phenotypes?burdenSet=${burdenSet}`,
  // // },

  // {
  //   typeName: 'VariantResponse',
  //   url: `/variant/${variantId}`,
  // },

  // {
  //   typeName: 'PhenotypeResponse',
  //   url: `/phenotype/${phenotypeId}`,
  // },

  // {
  //   typeName: 'GeneResponse',
  //   url: `/gene/${geneIdOrName}`,
  // },

  // { typeName: 'GeneAnalysisResponse', url: `/gene/${geneIdOrName}/analysis/${phenotypeId}` },
  // {
  //   typeName: 'VariantQcResponse',
  //   url: `/gene/${geneIdOrName}/variant-qc`,
  // },
  // {
  //   typeName: 'VariantAssociationResponse',
  //   url: `/gene/${geneIdOrName}/variant-associations/${phenotypeId}`,
  // },
  // {
  //   typeName: 'VariantManhattanResponse',
  //   url: `/analysis/${phenotypeId}/variant-manhattan`,
  // },
  // {
  //   typeName: 'GwasCatalogAssociationsResponse',
  //   url: `/gwas-catalog/gene/${geneIdOrName}`,
  // },
  // {
  //   typeName: 'GeneAnalysisQcResponse',
  //   url: `/gene/${geneIdOrName}/gene-analysis-qc`,
  // },
  {
    typeName: 'AnalysisQcResponse',
    url: `/phenotype/${phenotypeId}/qc`,
  },
].map((query) => ({
  ...query,
  lang: 'typescript',
  filePath: `${quicktypeOutputPath}/${query.typeName}.ts`,
}))

const copiedObjects = [
  {
    typeName: 'GeneAnalysisPrepared',
    data: geneAnalysesPrepared,
  },
  // {
  //   typeName: 'Variant',
  //   data: variantsPrepared,
  // },
].map((obj) => ({
  ...obj,
  lang: 'typescript',
  filePath: `${quicktypeOutputPath}/${obj.typeName}.ts`,
}))

async function main() {
  await Promise.all(
    copiedObjects.map(async (obj) => {
      try {
        return writeTypeForTable(obj)
      } catch (err) {
        console.log(err)
      }
    })
  )
  await Promise.all(
    queries.map(async (query) => {
      try {
        const { url, ...rest } = query

        const response = await axios(`${API_URL}${url}`)
        const data = response.data as unknown[]
        return writeTypeForTable({ data, ...rest })
      } catch (err) {
        console.log(err)
      }
    })
  )
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
