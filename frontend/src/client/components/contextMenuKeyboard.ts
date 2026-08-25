export type MenuNavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'

export const getNextMenuItemIndex = (
  key: MenuNavigationKey,
  currentIndex: number,
  itemCount: number
): number => {
  if (itemCount <= 0) return -1
  if (key === 'Home') return 0
  if (key === 'End') return itemCount - 1
  if (key === 'ArrowDown') {
    return currentIndex < 0 ? 0 : (currentIndex + 1) % itemCount
  }
  return currentIndex < 0 ? itemCount - 1 : (currentIndex - 1 + itemCount) % itemCount
}
