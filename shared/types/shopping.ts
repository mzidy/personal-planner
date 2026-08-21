export type ShoppingHorizon = 'short' | 'medium' | 'long'

export interface ShoppingItemRecord {
  id: string
  userId: string
  horizon: ShoppingHorizon
  name: string
  description: string
  price: number | null
  bought: boolean
  boughtAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ShoppingGroup {
  horizon: ShoppingHorizon
  label: string
  blurb: string
  items: ShoppingItemRecord[]
  openCount: number
  boughtCount: number
  openCost: number
  boughtCost: number
}

export interface ShoppingOverview {
  groups: ShoppingGroup[]
  totalCount: number
  openCount: number
  boughtCount: number
  openCost: number
  boughtCost: number
}
