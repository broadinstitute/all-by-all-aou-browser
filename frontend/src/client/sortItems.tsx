import { orderBy } from 'lodash'
import { isObject } from 'lodash'

const getValue = (isAscending: boolean) => (value: any) => {
  if (isObject(value)) {
    return Infinity
  }

  if (typeof value !== 'string' && isNaN(value)) {
    return isAscending ? Infinity : -Infinity
  }


  return value || ''
}

const sortItems = (items: any, { sortKey, sortOrder }: { sortKey: string; sortOrder: string }) => {
  const order: any = sortOrder === 'ascending' ? ['asc'] : ['desc']

  const isAscending = sortOrder === 'ascending'

  const getVal = getValue(isAscending)

  return orderBy(items, (variant: any) => getVal(variant[sortKey]), order)
}

export default sortItems
