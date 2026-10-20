import { and, asc, eq } from 'drizzle-orm'
import type { SmartHomeAccount, SmartHomeDevice, SmartHomeOverview, VacuumStatus } from '~~/shared/types/smart-home'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'
import type { RoborockDeviceInfo, RoborockRegion, RoborockSession } from '~~/server/utils/roborock-api'
import { openSecret, sealSecret } from '~~/server/utils/secret-box'

type AccountRow = typeof tables.smartHomeAccounts.$inferSelect
type DeviceRow = typeof tables.smartHomeDevices.$inferSelect

function nowIso() {
  return new Date().toISOString()
}

function regionName(baseUrl: string) {
  return new URL(baseUrl).hostname.split('.')[0]?.replace(/iot$/, '').toUpperCase() || ''
}

function toAccount(row: AccountRow): SmartHomeAccount {
  return {
    provider: 'roborock',
    email: row.email,
    status: row.status as SmartHomeAccount['status'],
    region: regionName(row.baseUrl),
    connectedAt: row.connectedAt
  }
}

function toDevice(row: DeviceRow): SmartHomeDevice {
  return {
    id: row.id,
    name: row.name,
    model: row.model,
    productName: row.productName,
    protocolVersion: row.protocolVersion,
    supported: row.protocolVersion === '1.0',
    online: row.online,
    lastStatus: (row.lastStatus as VacuumStatus | null) ?? null
  }
}

export interface RoborockAccountContext {
  account: AccountRow
  region: RoborockRegion
}

export function useSmartHomeRepository() {
  return {
    async findAccount(userId: string): Promise<RoborockAccountContext | null> {
      const [row] = await useDatabase()
        .select()
        .from(tables.smartHomeAccounts)
        .where(and(eq(tables.smartHomeAccounts.userId, userId), eq(tables.smartHomeAccounts.provider, 'roborock')))
        .limit(1)
      return row ? { account: row, region: { baseUrl: row.baseUrl, country: row.country, countryCode: row.countryCode } } : null
    },

    async overview(userId: string): Promise<SmartHomeOverview> {
      const found = await this.findAccount(userId)
      if (!found) {
        return { account: null, devices: [] }
      }
      const devices = await useDatabase()
        .select()
        .from(tables.smartHomeDevices)
        .where(eq(tables.smartHomeDevices.accountId, found.account.id))
        .orderBy(asc(tables.smartHomeDevices.name))
      // Devices this app can control first, then the rest, each by name.
      const mapped = devices.map(toDevice).sort((a, b) => Number(b.supported) - Number(a.supported))
      return { account: toAccount(found.account), devices: mapped }
    },

    /** A code was requested: remember where, and with which client identifier, so the login can match it. */
    async saveCodeRequest(userId: string, email: string, region: RoborockRegion, clientIdentifier: string) {
      const db = useDatabase()
      const existing = await this.findAccount(userId)
      const fields = {
        email,
        baseUrl: region.baseUrl,
        country: region.country,
        countryCode: region.countryCode,
        clientIdentifier,
        updatedAt: nowIso()
      }
      if (existing) {
        // A session that still works stays in place until the new login replaces it.
        await db
          .update(tables.smartHomeAccounts)
          .set({ ...fields, status: existing.account.credentials ? existing.account.status : 'awaiting_code' })
          .where(eq(tables.smartHomeAccounts.id, existing.account.id))
        return
      }
      await db.insert(tables.smartHomeAccounts).values({
        id: createId('shacct'),
        userId,
        provider: 'roborock',
        status: 'awaiting_code',
        createdAt: nowIso(),
        ...fields
      })
    },

    async saveSession(accountId: string, session: RoborockSession) {
      await useDatabase()
        .update(tables.smartHomeAccounts)
        .set({ credentials: sealSecret(JSON.stringify(session)), status: 'connected', connectedAt: nowIso(), updatedAt: nowIso() })
        .where(eq(tables.smartHomeAccounts.id, accountId))
    },

    session(account: AccountRow): RoborockSession | null {
      const opened = openSecret(account.credentials)
      return opened ? (JSON.parse(opened) as RoborockSession) : null
    },

    /** Replaces the account's device list with what Roborock reports now, keeping last known status. */
    async syncDevices(userId: string, accountId: string, devices: RoborockDeviceInfo[]) {
      const db = useDatabase()
      const existing = await db.select().from(tables.smartHomeDevices).where(eq(tables.smartHomeDevices.accountId, accountId))
      const byDuid = new Map(existing.map(row => [row.duid, row]))
      const seen = new Set<string>()

      for (const device of devices) {
        seen.add(device.duid)
        const fields = {
          name: device.name,
          model: device.model,
          productName: device.productName,
          protocolVersion: device.protocolVersion,
          localKey: sealSecret(device.localKey),
          online: device.online,
          updatedAt: nowIso()
        }
        const row = byDuid.get(device.duid)
        if (row) {
          await db.update(tables.smartHomeDevices).set(fields).where(eq(tables.smartHomeDevices.id, row.id))
        } else {
          await db.insert(tables.smartHomeDevices).values({
            id: createId('shdev'),
            userId,
            accountId,
            duid: device.duid,
            createdAt: nowIso(),
            ...fields
          })
        }
      }
      for (const row of existing) {
        if (!seen.has(row.duid)) {
          await db.delete(tables.smartHomeDevices).where(eq(tables.smartHomeDevices.id, row.id))
        }
      }
    },

    async findDevice(userId: string, deviceId: string) {
      const [row] = await useDatabase()
        .select()
        .from(tables.smartHomeDevices)
        .where(and(eq(tables.smartHomeDevices.userId, userId), eq(tables.smartHomeDevices.id, deviceId)))
        .limit(1)
      return row || null
    },

    deviceKey(device: DeviceRow) {
      return openSecret(device.localKey)
    },

    async saveStatus(deviceId: string, status: VacuumStatus | null, online: boolean) {
      await useDatabase()
        .update(tables.smartHomeDevices)
        .set({
          ...(status ? { lastStatus: status as unknown as Record<string, unknown>, lastStatusAt: status.checkedAt } : {}),
          online,
          updatedAt: nowIso()
        })
        .where(eq(tables.smartHomeDevices.id, deviceId))
    },

    async disconnect(userId: string) {
      const db = useDatabase()
      await db.delete(tables.smartHomeDevices).where(eq(tables.smartHomeDevices.userId, userId))
      await db
        .delete(tables.smartHomeAccounts)
        .where(and(eq(tables.smartHomeAccounts.userId, userId), eq(tables.smartHomeAccounts.provider, 'roborock')))
    }
  }
}
