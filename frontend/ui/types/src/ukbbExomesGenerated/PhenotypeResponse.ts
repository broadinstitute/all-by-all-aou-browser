/* eslint-disable no-prototype-builtins */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

// To parse this data:
//
//   import { Convert, PhenotypeResponse } from "./file";
//
//   const phenotypeResponse = Convert.toPhenotypeResponse(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface PhenotypeResponse {
  n_cases: number
  n_controls: number
  heritability: number
  saige_version: string
  inv_normalized: string
  trait_type: string
  phenocode: string
  pheno_sex: string
  coding: string
  modifier: string
  n_cases_both_sexes: number
  n_cases_females: number
  n_cases_males: number
  description: string
  description_more: string
  coding_description: string
  category: string
  Abbvie_Priority: string
  Biogen_Priority: string
  Pfizer_Priority: string
  score: number
  analysis_id: string
  classifications: Array<string[]>
  cls_confidences: number[]
  cls_unique: string[]
  cls_unique_joined: string
  cls_leaves: string[]
  cls_leaves_joined: string
  cls_paths_joined: string[]
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toPhenotypeResponse(json: string): PhenotypeResponse {
    return cast(JSON.parse(json), r('PhenotypeResponse'))
  }

  public static phenotypeResponseToJson(value: PhenotypeResponse): string {
    return JSON.stringify(uncast(value, r('PhenotypeResponse')), null, 2)
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
  PhenotypeResponse: o(
    [
      { json: 'n_cases', js: 'n_cases', typ: 0 },
      { json: 'n_controls', js: 'n_controls', typ: 0 },
      { json: 'heritability', js: 'heritability', typ: 3.14 },
      { json: 'saige_version', js: 'saige_version', typ: '' },
      { json: 'inv_normalized', js: 'inv_normalized', typ: '' },
      { json: 'trait_type', js: 'trait_type', typ: '' },
      { json: 'phenocode', js: 'phenocode', typ: '' },
      { json: 'pheno_sex', js: 'pheno_sex', typ: '' },
      { json: 'coding', js: 'coding', typ: '' },
      { json: 'modifier', js: 'modifier', typ: '' },
      { json: 'n_cases_both_sexes', js: 'n_cases_both_sexes', typ: 0 },
      { json: 'n_cases_females', js: 'n_cases_females', typ: 0 },
      { json: 'n_cases_males', js: 'n_cases_males', typ: 0 },
      { json: 'description', js: 'description', typ: '' },
      { json: 'description_more', js: 'description_more', typ: '' },
      { json: 'coding_description', js: 'coding_description', typ: '' },
      { json: 'category', js: 'category', typ: '' },
      { json: 'Abbvie_Priority', js: 'Abbvie_Priority', typ: '' },
      { json: 'Biogen_Priority', js: 'Biogen_Priority', typ: '' },
      { json: 'Pfizer_Priority', js: 'Pfizer_Priority', typ: '' },
      { json: 'score', js: 'score', typ: 0 },
      { json: 'analysis_id', js: 'analysis_id', typ: '' },
      { json: 'classifications', js: 'classifications', typ: a(a('')) },
      { json: 'cls_confidences', js: 'cls_confidences', typ: a(3.14) },
      { json: 'cls_unique', js: 'cls_unique', typ: a('') },
      { json: 'cls_unique_joined', js: 'cls_unique_joined', typ: '' },
      { json: 'cls_leaves', js: 'cls_leaves', typ: a('') },
      { json: 'cls_leaves_joined', js: 'cls_leaves_joined', typ: '' },
      { json: 'cls_paths_joined', js: 'cls_paths_joined', typ: a('') },
    ],
    false
  ),
}
