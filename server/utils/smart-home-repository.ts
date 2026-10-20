import { and, asc, eq } from 'drizzle-orm'
import type {
  SmartHomeAccount,
  SmartHomeDevice,
  SmartHomeOverview,
  SmartHomeProvider,
  VacuumStatus
} from '~~/shared/types/smart-home'
import { useDatabase } from '~~/server/database/client'
import * as tables from '~~/server/database/schema'
import { createId } from '~~/server/utils/id'
import type { RoborockRegion, RoborockSession } from '~~/server/utils/roborock-api'
import { openSecret, sealSecret } from '~~/server/utils/secret-box'
import type { XiaomiQrLogin, XiaomiSession } from '~~/server/utils/xiaomi-cloud'

type AccountRow = typeof tables.smartHomeAccounts.$inferSelect
type DeviceRow = typeof tables.smartHomeDevices.$inferSelect

/** What a Xiaomi account keeps sealed: the session once connected, and an open QR login if any. */
export interface XiaomiState {
  session?: XiaomiSession
  pending?: XiaomiQrLogin
}

export interface DeviceInput {
  duid: string
  name: string
  model: string
  productName: string
  protocolVersion: string
  /** Roborock's per-device key; Xiaomi cloud control needs none. */
  localKey: string | null
  online: boolean
}

function nowIso() {
  return new Date().toISOString()
}

function regionName(account: AccountRow) {
  if (account.provider === 'xiaomi') {
    return account.country.toUpperCase()
  }
  return new URL(account.baseUrl).hostname.split('.')[0]?.replace(/iot$/, '').toUpperCase() || ''
}

function xiaomiState(account: AccountRow): XiaomiState {
  const opened = openSecret(account.credentials)
  return opened ? (JSON.parse(opened) as XiaomiState) : {}
}

function toAccount(row: AccountRow): SmartHomeAccount {
  const pending = row.provider === 'xiaomi' && row.status === 'awaiting_scan' ? xiaomiState(row).pending : undefined
  return {
    provider: row.provider as SmartHomeProvider,
    email: row.email,
    status: row.status as SmartHomeAccount['status'],
    region: regionName(row),
    connectedAt: row.connectedAt,
    qrImageUrl: pending?.qrImageUrl ?? null,
    qrExpiresAt: pending?.expiresAt ?? null
  }
}

function isSupported(provider: SmartHomeProvider, protocolVersion: string) {
  return provider === 'roborock' ? protocolVersion === '1.0' : protocolVersion === 'miio'
}

function toDevice(row: DeviceRow, provider: SmartHomeProvider): SmartHomeDevice {
  return {
    id: row.id,
    provider,
    name: row.name,
    model: row.model,
    productName: row.productName,
    protocolVersion: row.protocolVersion,
    supported: isSupported(provider, row.protocolVersion),
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
    async findAccountRow(userId: string, provider: SmartHomeProvider) {
      const [row] = await useDatabase()
        .select()
        .from(tables.smartHomeAccounts)
        .where(and(eq(tables.smartHomeAccounts.userId, userId), eq(tables.smartHomeAccounts.provider, provider)))
        .limit(1)
      return row || null
    },

    async findAccount(userId: string): Promise<RoborockAccountContext | null> {
      const row = await this.findAccountRow(userId, 'roborock')
      return row ? { account: row, region: { baseUrl: row.baseUrl, country: row.country, countryCode: row.countryCode } } : null
    },

    async overview(userId: string): Promise<SmartHomeOverview> {
      const db = useDatabase()
      const accounts = await db.select().from(tables.smartHomeAccounts).where(eq(tables.smartHomeAccounts.userId, userId))
      const providerOf = new Map(accounts.map(account => [account.id, account.provider as SmartHomeProvider]))
      const devices = await db
        .select()
        .from(tables.smartHomeDevices)
        .where(eq(tables.smartHomeDevices.userId, userId))
        .orderBy(asc(tables.smartHomeDevices.name))

      const byProvider = (provider: SmartHomeProvider) => {
        const row = accounts.find(account => account.provider === provider)
        return row ? toAccount(row) : null
      }
      // Devices this app can control first, then the rest, each by name.
      const mapped = devices
        .filter(row => providerOf.has(row.accountId))
        .map(row => toDevice(row, providerOf.get(row.accountId)!))
        .sort((a, b) => Number(b.supported) - Number(a.supported))

      return { accounts: { roborock: byProvider('roborock'), xiaomi: byProvider('xiaomi') }, devices: mapped }
    },

    // ------------------------------------------------------------ Roborock

    /** A code was requested: remember where, and with which client identifier, so the login can match it. */
    async saveCodeRequest(userId: string, email: string, region: RoborockRegion, clientIdentifier: string) {
      const db = useDatabase()
      const existing = await this.findAccountRow(userId, 'roborock')
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
          .set({ ...fields, status: existing.credentials ? existing.status : 'awaiting_code' })
          .where(eq(tables.smartHomeAccounts.id, existing.id))
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

    // ------------------------------------------------------------ Xiaomi

    xiaomiState,

    /** A QR login was opened. A working session stays in place until the new scan replaces it. */
    async saveXiaomiPending(userId: string, agentId: string, pending: XiaomiQrLogin) {
      const db = useDatabase()
      const existing = await this.findAccountRow(userId, 'xiaomi')
      const state: XiaomiState = { ...(existing ? xiaomiState(existing) : {}), pending }
      const fields = { credentials: sealSecret(JSON.stringify(state)), status: 'awaiting_scan', updatedAt: nowIso() }
      if (existing) {
        await db.update(tables.smartHomeAccounts).set(fields).where(eq(tables.smartHomeAccounts.id, existing.id))
        return
      }
      await db.insert(tables.smartHomeAccounts).values({
        id: createId('shacct'),
        userId,
        provider: 'xiaomi',
        email: '',
        baseUrl: '',
        clientIdentifier: agentId,
        createdAt: nowIso(),
        ...fields
      })
    },

    async saveXiaomiSession(accountId: string, session: XiaomiSession, server: string, apiBase: string) {
      await useDatabase()
        .update(tables.smartHomeAccounts)
        .set({
          credentials: sealSecret(JSON.stringify({ session } satisfies XiaomiState)),
          status: 'connected',
          email: `Xiaomi ID ${session.userId}`,
          country: server,
          baseUrl: apiBase,
          connectedAt: nowIso(),
          updatedAt: nowIso()
        })
        .where(eq(tables.smartHomeAccounts.id, accountId))
    },

    /** The QR code expired unused: back to connected if there is a session, otherwise gone. */
    async clearXiaomiPending(account: AccountRow) {
      const state = xiaomiState(account)
      if (!state.session) {
        await this.disconnect(account.userId, 'xiaomi')
        return
      }
      await useDatabase()
        .update(tables.smartHomeAccounts)
        .set({ credentials: sealSecret(JSON.stringify({ session: state.session })), status: 'connected', updatedAt: nowIso() })
        .where(eq(tables.smartHomeAccounts.id, account.id))
    },

    // ------------------------------------------------------------ devices

    /** Replaces an account's device list with what the provider reports now, keeping last known status. */
    async syncDevices(userId: string, accountId: string, devices: DeviceInput[]) {
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
          localKey: device.localKey ? sealSecret(device.localKey) : '',
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
        .select({ device: tables.smartHomeDevices, account: tables.smartHomeAccounts })
        .from(tables.smartHomeDevices)
        .innerJoin(tables.smartHomeAccounts, eq(tables.smartHomeAccounts.id, tables.smartHomeDevices.accountId))
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

    async disconnect(userId: string, provider: SmartHomeProvider) {
      const account = await this.findAccountRow(userId, provider)
      if (!account) {
        return
      }
      const db = useDatabase()
      await db.delete(tables.smartHomeDevices).where(eq(tables.smartHomeDevices.accountId, account.id))
      await db.delete(tables.smartHomeAccounts).where(eq(tables.smartHomeAccounts.id, account.id))
    }
  }
}
