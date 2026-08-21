import orderBy from 'lodash/orderBy'
import isObject from 'lodash/isObject'

const getValue = (isAscending: boolean, distinguishZero: boolean) => (value: any) => {
  if (distinguishZero && (value === null || value === undefined)) {
    return isAscending ? Infinity : -Infinity
  }

  if (isObject(value)) {
    return Infinity
  }

  if (typeof value !== 'string' && isNaN(value)) {
    return isAscending ? Infinity : -Infinity
  }

  return distinguishZero ? value : value || ''
}

const sortItems = (items: any, { sortKey, sortOrder }: { sortKey: string; sortOrder: string }) => {
  const order: any = sortOrder === 'ascending' ? ['asc'] : ['desc']

  const isAscending = sortOrder === 'ascending'
  const distinguishZero = sortKey === 'mac_case' || sortKey === 'mac_control'

  const getVal = getValue(isAscending, distinguishZero)

  return orderBy(items, (variant: any) => getVal(variant[sortKey]), order)
}

export default sortItems
