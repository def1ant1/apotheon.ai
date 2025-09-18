export interface ProductFilters {
  gender: string[]
  category: string[]
  color: string[]
  price: number[]
  rating: number
}

export type ProductFilterKeys = keyof ProductFilters
export type ProductFilterValues = ProductFilters[ProductFilterKeys]
