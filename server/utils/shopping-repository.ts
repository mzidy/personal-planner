import { and, asc, desc, eq } from 'drizzle-orm'
import type {
  ShoppingGroup,
  ShoppingHorizon,
  ShoppingItemRecord,
  ShoppingOverview
} from '~~/shared/types/shopping'
import type { ShoppingItemInput, ShoppingItemPatch } from '~~/shared/schemas/shopping'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'

const HORIZONS: { horizon: ShoppingHorizon; label: string; blurb: string }[] = [
  { horizon: 'short', label: 'Short-term', blurb: 'Buying soon — this week or this month.' },
  { horizon: 'medium', label: 'Medium-term', blurb: 'Planned for the next few months.' },
  { horizon: 'long', label: 'Long-term', blurb: 'Bigger purchases to save toward.' }
]

function nowIso() {
  return new Date().toISOString()
}

function sum(items: ShoppingItemRecord[]) {
  return items.reduce((total, item) => total + (item.price ?? 0), 0)
}

export function useShoppingRepository() {
  return {
    async listItems(userId: string): Promise<ShoppingItemRecord[]> {
      const db = useDatabase()
      return (await db
        .select()
        .from(tables.shoppingItems)
        .where(eq(tables.shoppingItems.userId, userId))
        .orderBy(asc(tables.shoppingItems.bought), desc(tables.shoppingItems.createdAt))) as ShoppingItemRecord[]
    },

    async createItem(userId: string, input: ShoppingItemInput): Promise<ShoppingItemRecord> {
      const record: ShoppingItemRecord = {
        id: createId('buy'),
        userId,
        horizon: input.horizon,
        name: input.name,
        description: input.description || '',
        price: input.price ?? null,
        bought: false,
        boughtAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
      await useDatabase().insert(tables.shoppingItems).values(record)
      return record
    },

    async updateItem(userId: string, itemId: string, patch: ShoppingItemPatch): Promise<ShoppingItemRecord | null> {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.shoppingItems)
        .where(and(eq(tables.shoppingItems.userId, userId), eq(tables.shoppingItems.id, itemId)))
        .limit(1)) as ShoppingItemRecord[]

      if (!record) {
        return null
      }

      const updated: ShoppingItemRecord = {
        ...record,
        ...patch,
        description: patch.description === undefined ? record.description : patch.description,
        price: patch.price === undefined ? record.price : patch.price,
        boughtAt:
          patch.bought === undefined || patch.bought === record.bought
            ? record.boughtAt
            : patch.bought
              ? nowIso()
              : null,
        updatedAt: nowIso()
      }

      await db
        .update(tables.shoppingItems)
        .set({
          horizon: updated.horizon,
          name: updated.name,
          description: updated.description,
          price: updated.price,
          bought: updated.bought,
          boughtAt: updated.boughtAt,
          updatedAt: updated.updatedAt
        })
        .where(eq(tables.shoppingItems.id, itemId))

      return updated
    },

    async deleteItem(userId: string, itemId: string): Promise<ShoppingItemRecord | null> {
      const db = useDatabase()
      const [record] = (await db
        .select()
        .from(tables.shoppingItems)
        .where(and(eq(tables.shoppingItems.userId, userId), eq(tables.shoppingItems.id, itemId)))
        .limit(1)) as ShoppingItemRecord[]

      if (!record) {
        return null
      }

      await db.delete(tables.shoppingItems).where(eq(tables.shoppingItems.id, itemId))
      return record
    },

    async getOverview(userId: string): Promise<ShoppingOverview> {
      const items = await this.listItems(userId)

      const groups: ShoppingGroup[] = HORIZONS.map(meta => {
        const groupItems = items.filter(item => item.horizon === meta.horizon)
        const open = groupItems.filter(item => !item.bought)
        const bought = groupItems.filter(item => item.bought)

        return {
          ...meta,
          items: groupItems,
          openCount: open.length,
          boughtCount: bought.length,
          openCost: sum(open),
          boughtCost: sum(bought)
        }
      })

      const open = items.filter(item => !item.bought)
      const bought = items.filter(item => item.bought)

      return {
        groups,
        totalCount: items.length,
        openCount: open.length,
        boughtCount: bought.length,
        openCost: sum(open),
        boughtCost: sum(bought)
      }
    }
  }
}
