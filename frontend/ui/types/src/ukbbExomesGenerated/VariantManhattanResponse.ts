/* eslint-disable no-prototype-builtins */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

// To parse this data:
//
//   import { Convert, VariantManhattanResponse } from "./file";
//
//   const variantManhattanResponse = Convert.toVariantManhattanResponse(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface VariantManhattanResponse {
  trait_type: string
  phenocode: string
  pheno_sex: string
  coding: string
  modifier: string
  data: Datum[]
}

export interface Datum {
  pval: number
  chrom: string
  pos: number
  is_binned: boolean
  beta: number | null
  variant_id: null | string
  rsid: null | string
  gene_id: null | string
  gene_symbol: null | string
  consequence: null | string
  hgvsp: null | string
  hgvsc: null | string
  allele_count: number | null
  allele_number: number | null
  allele_frequency: number | null
  homozygote_count: number | null
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toVariantManhattanResponse(json: string): VariantManhattanResponse {
    return cast(JSON.parse(json), r('VariantManhattanResponse'))
  }

  public static variantManhattanResponseToJson(value: VariantManhattanResponse): string {
    return JSON.stringify(uncast(value, r('VariantManhattanResponse')), null, 2)
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
  VariantManhattanResponse: o(
    [
      { json: 'trait_type', js: 'trait_type', typ: '' },
      { json: 'phenocode', js: 'phenocode', typ: '' },
      { json: 'pheno_sex', js: 'pheno_sex', typ: '' },
      { json: 'coding', js: 'coding', typ: '' },
      { json: 'modifier', js: 'modifier', typ: '' },
      { json: 'data', js: 'data', typ: a(r('Datum')) },
    ],
    false
  ),
  Datum: o(
    [
      { json: 'pval', js: 'pval', typ: 3.14 },
      { json: 'chrom', js: 'chrom', typ: '' },
      { json: 'pos', js: 'pos', typ: 0 },
      { json: 'is_binned', js: 'is_binned', typ: true },
      { json: 'beta', js: 'beta', typ: u(3.14, null) },
      { json: 'variant_id', js: 'variant_id', typ: u(null, '') },
      { json: 'rsid', js: 'rsid', typ: u(null, '') },
      { json: 'gene_id', js: 'gene_id', typ: u(null, '') },
      { json: 'gene_symbol', js: 'gene_symbol', typ: u(null, '') },
      { json: 'consequence', js: 'consequence', typ: u(null, '') },
      { json: 'hgvsp', js: 'hgvsp', typ: u(null, '') },
      { json: 'hgvsc', js: 'hgvsc', typ: u(null, '') },
      { json: 'allele_count', js: 'allele_count', typ: u(0, null) },
      { json: 'allele_number', js: 'allele_number', typ: u(0, null) },
      { json: 'allele_frequency', js: 'allele_frequency', typ: u(3.14, null) },
      { json: 'homozygote_count', js: 'homozygote_count', typ: u(0, null) },
    ],
    false
  ),
}
