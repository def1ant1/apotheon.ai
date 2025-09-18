// Function to paginate an array of items.
export function paginate<T>(currentPage = 1, itemsPerPage = 6, items: T[]) {
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  return items.slice(startIndex, endIndex)
}
