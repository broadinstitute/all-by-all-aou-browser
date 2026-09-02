import type { MembershipFilterOptions } from '../variantState'

const FILTER_KEYS_BY_ANNOTATION = {
  pLoF: ['pLoF'],
  'pLoF;missenseLC': ['pLoF', 'missense'],
  missenseLC: ['missense'],
  synonymous: ['synonymous'],
} as const satisfies Record<string, readonly (keyof MembershipFilterOptions)[]>

type BurdenAnnotation = keyof typeof FILTER_KEYS_BY_ANNOTATION

const filterKeysForAnnotation = (annotation: string): readonly (keyof MembershipFilterOptions)[] =>
  FILTER_KEYS_BY_ANNOTATION[annotation as BurdenAnnotation] || []

export const isBurdenAnnotationSelected = (
  annotation: string,
  filters: MembershipFilterOptions
): boolean => {
  const keys = filterKeysForAnnotation(annotation)
  return keys.length > 0 && keys.every((key) => filters[key])
}

export const setBurdenAnnotationSelected = (
  annotation: string,
  checked: boolean,
  filters: MembershipFilterOptions
): MembershipFilterOptions => {
  const nextFilters = { ...filters }
  filterKeysForAnnotation(annotation).forEach((key) => {
    nextFilters[key] = checked
  })
  return nextFilters
}
