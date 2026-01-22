/* eslint-disable no-prototype-builtins */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

// To parse this data:
//
//   import { Convert, VariantResponse } from "./file";
//
//   const variantResponse = Convert.toVariantResponse(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface VariantResponse {
  locus: Locus
  alleles: string[]
  region_flag: RegionFlag
  filters: any[]
  rsid: null
  allele_number: number
  allele_count: number
  allele_frequency: number
  homozygote_count: number
  variant_id: string
  chrom: string
  pos: number
  gene_id: string
  gene_symbol: string
  consequence: string
  hgvs: string
  hgvsp: string
  hgvsc: string
  lof: string
  lof_filter: null
  lof_flags: string
  phewas_hits: PhewasHit[]
  phewas_count: number
}

export interface Locus {
  contig: string
  position: number
}

export interface PhewasHit {
  pval: number
  beta: number
  analysis_id: string
}

export interface RegionFlag {
  lcr: boolean
  fail_interval_qc: boolean
  in_capture_region: boolean
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toVariantResponse(json: string): VariantResponse {
    return cast(JSON.parse(json), r('VariantResponse'))
  }

  public static variantResponseToJson(value: VariantResponse): string {
    return JSON.stringify(uncast(value, r('VariantResponse')), null, 2)
  }
}

function invalidValue(typ: any, val: any, key: any = ''): never {
  if (key) {
    throw Error(
      `Invalid value for key "${key}". Expected type ${JSON.stringify(
        typ
      )} but got ${JSON.stringify(val)}`
    )
  }
  throw Error(`Invalid value ${JSON.stringify(val)} for type ${JSON.stringify(typ)}`)
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {}
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }))
    typ.jsonToJS = map
  }
  return typ.jsonToJS
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {}
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }))
    typ.jsToJSON = map
  }
  return typ.jsToJSON
}

function transform(val: any, typ: any, getProps: any, key: any = ''): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val
    return invalidValue(typ, val, key)
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length
    for (let i = 0; i < l; i++) {
      const typ = typs[i]
      try {
        return transform(val, typ, getProps)
      } catch (_) {}
    }
    return invalidValue(typs, val)
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val
    return invalidValue(cases, val)
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue('array', val)
    return val.map((el) => transform(el, typ, getProps))
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null
    }
    const d = new Date(val)
    if (isNaN(d.valueOf())) {
      return invalidValue('Date', val)
    }
    return d
  }

  function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) {
      return invalidValue('object', val)
    }
    const result: any = {}
    Object.getOwnPropertyNames(props).forEach((key) => {
      const prop = props[key]
      const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined
      result[prop.key] = transform(v, prop.typ, getProps, prop.key)
    })
    Object.getOwnPropertyNames(val).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key)
      }
    })
    return result
  }

  if (typ === 'any') return val
  if (typ === null) {
    if (val === null) return val
    return invalidValue(typ, val)
  }
  if (typ === false) return invalidValue(typ, val)
  while (typeof typ === 'object' && typ.ref !== undefined) {
    typ = typeMap[typ.ref]
  }
  if (Array.isArray(typ)) return transformEnum(typ, val)
  if (typeof typ === 'object') {
    return typ.hasOwnProperty('unionMembers')
      ? transformUnion(typ.unionMembers, val)
      : typ.hasOwnProperty('arrayItems')
      ? transformArray(typ.arrayItems, val)
      : typ.hasOwnProperty('props')
      ? transformObject(getProps(typ), typ.additional, val)
      : invalidValue(typ, val)
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== 'number') return transformDate(val)
  return transformPrimitive(typ, val)
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps)
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps)
}

function a(typ: any) {
  return { arrayItems: typ }
}

function u(...typs: any[]) {
  return { unionMembers: typs }
}

function o(props: any[], additional: any) {
  return { props, additional }
}

function m(additional: any) {
  return { props: [], additional }
}

function r(name: string) {
  return { ref: name }
}

const typeMap: any = {
  VariantResponse: o(
    [
      { json: 'locus', js: 'locus', typ: r('Locus') },
      { json: 'alleles', js: 'alleles', typ: a('') },
      { json: 'region_flag', js: 'region_flag', typ: r('RegionFlag') },
      { json: 'filters', js: 'filters', typ: a('any') },
      { json: 'rsid', js: 'rsid', typ: null },
      { json: 'allele_number', js: 'allele_number', typ: 0 },
      { json: 'allele_count', js: 'allele_count', typ: 0 },
      { json: 'allele_frequency', js: 'allele_frequency', typ: 3.14 },
      { json: 'homozygote_count', js: 'homozygote_count', typ: 0 },
      { json: 'variant_id', js: 'variant_id', typ: '' },
      { json: 'chrom', js: 'chrom', typ: '' },
      { json: 'pos', js: 'pos', typ: 0 },
      { json: 'gene_id', js: 'gene_id', typ: '' },
      { json: 'gene_symbol', js: 'gene_symbol', typ: '' },
      { json: 'consequence', js: 'consequence', typ: '' },
      { json: 'hgvs', js: 'hgvs', typ: '' },
      { json: 'hgvsp', js: 'hgvsp', typ: '' },
      { json: 'hgvsc', js: 'hgvsc', typ: '' },
      { json: 'lof', js: 'lof', typ: '' },
      { json: 'lof_filter', js: 'lof_filter', typ: null },
      { json: 'lof_flags', js: 'lof_flags', typ: '' },
      { json: 'phewas_hits', js: 'phewas_hits', typ: a(r('PhewasHit')) },
      { json: 'phewas_count', js: 'phewas_count', typ: 0 },
    ],
    false
  ),
  Locus: o(
    [
      { json: 'contig', js: 'contig', typ: '' },
      { json: 'position', js: 'position', typ: 0 },
    ],
    false
  ),
  PhewasHit: o(
    [
      { json: 'pval', js: 'pval', typ: 3.14 },
      { json: 'beta', js: 'beta', typ: 3.14 },
      { json: 'analysis_id', js: 'analysis_id', typ: '' },
    ],
    false
  ),
  RegionFlag: o(
    [
      { json: 'lcr', js: 'lcr', typ: true },
      { json: 'fail_interval_qc', js: 'fail_interval_qc', typ: true },
      { json: 'in_capture_region', js: 'in_capture_region', typ: true },
    ],
    false
  ),
}
