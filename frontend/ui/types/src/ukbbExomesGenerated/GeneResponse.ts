/* eslint-disable no-prototype-builtins */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

// To parse this data:
//
//   import { Convert, GeneResponse } from "./file";
//
//   const geneResponse = Convert.toGeneResponse(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface GeneResponse {
  gene_id: string
  hgnc_id: string
  symbol: string
  name: string
  previous_symbols: string[]
  synonyms: string[]
  omim_id: string
  symbol_source: string
  symbol_upper_case: string
  search_terms: string[]
  chrom: string
  start: number
  stop: number
  strand: string
  exons: Exon[]
}

export interface Exon {
  feature_type: string
  start: number
  stop: number
  xstart: number
  xstop: number
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toGeneResponse(json: string): GeneResponse {
    return cast(JSON.parse(json), r('GeneResponse'))
  }

  public static geneResponseToJson(value: GeneResponse): string {
    return JSON.stringify(uncast(value, r('GeneResponse')), null, 2)
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
  GeneResponse: o(
    [
      { json: 'gene_id', js: 'gene_id', typ: '' },
      { json: 'hgnc_id', js: 'hgnc_id', typ: '' },
      { json: 'symbol', js: 'symbol', typ: '' },
      { json: 'name', js: 'name', typ: '' },
      { json: 'previous_symbols', js: 'previous_symbols', typ: a('') },
      { json: 'synonyms', js: 'synonyms', typ: a('') },
      { json: 'omim_id', js: 'omim_id', typ: '' },
      { json: 'symbol_source', js: 'symbol_source', typ: '' },
      { json: 'symbol_upper_case', js: 'symbol_upper_case', typ: '' },
      { json: 'search_terms', js: 'search_terms', typ: a('') },
      { json: 'chrom', js: 'chrom', typ: '' },
      { json: 'start', js: 'start', typ: 0 },
      { json: 'stop', js: 'stop', typ: 0 },
      { json: 'strand', js: 'strand', typ: '' },
      { json: 'exons', js: 'exons', typ: a(r('Exon')) },
    ],
    false
  ),
  Exon: o(
    [
      { json: 'feature_type', js: 'feature_type', typ: '' },
      { json: 'start', js: 'start', typ: 0 },
      { json: 'stop', js: 'stop', typ: 0 },
      { json: 'xstart', js: 'xstart', typ: 0 },
      { json: 'xstop', js: 'xstop', typ: 0 },
    ],
    false
  ),
}
