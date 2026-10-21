import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseRoborockMap, toMapView } from '../../server/utils/roborock-map'

/**
 * Real Roborock maps (see tests/fixtures/roborock-maps/README.md). Every
 * expected value below is copied from python-roborock's snapshot for the same
 * file, so the port is checked against the reference parser's output.
 */
function fixture(name: string) {
  return parseRoborockMap(readFileSync(new URL(`../fixtures/roborock-maps/${name}`, import.meta.url)))
}

describe('parseRoborockMap', () => {
  it('reads rooms, charger, robot and path of an S5 map', () => {
    const map = fixture('s5_fw2008_with_segments.bin')
    expect(map).toMatchObject({ isValid: true, majorVersion: 1, minorVersion: 1, mapIndex: 919, mapSequence: 814 })
    expect(map.charger).toEqual({ x: 25652, y: 25222, a: 98 })
    expect(map.robot).toEqual({ x: 25642, y: 25401, a: -88 })
    expect(map.path).toHaveLength(933)
    expect([...map.rooms.entries()]).toEqual([
      [1, { x0: 23250, y0: 24950, x1: 26550, y1: 26400 }],
      [2, { x0: 25150, y0: 26400, x1: 26600, y1: 29950 }]
    ])
    expect(map.walls).toEqual([])
    expect(map.noGoAreas).toEqual([])
    expect(map.zones).toEqual([])
  })

  it('reads virtual walls, no-go areas and cleaned zones', () => {
    const map = fixture('s5_fw1886_with_forbidden_zones_and_virtual_walls.bin')
    expect(map).toMatchObject({ isValid: true, majorVersion: 1, minorVersion: 0, mapIndex: 875, mapSequence: 64 })
    expect(map.charger).toEqual({ x: 25612, y: 25254, a: null })
    // This firmware sends no heading (an 8-byte block). The snapshot says a=0 because the
    // reference's image generator sets a missing heading to 0 while drawing; the view does too.
    expect(map.robot).toEqual({ x: 28697, y: 26764, a: null })
    expect(toMapView(map, 'now').robot![2]).toBe(0)
    expect(map.path).toHaveLength(55)
    expect(map.walls).toEqual([[25300, 27850, 25300, 26850]])
    expect(map.noGoAreas).toEqual([[27000, 28750, 28850, 28750, 28850, 28100, 27000, 28100]])
    expect(map.zones).toEqual([[27289, 25480, 28919, 27358]])
    expect(map.rooms.size).toBe(0)
  })

  it('reads six rooms, no-go and no-mop areas of an S6 map', () => {
    const map = fixture('s6_fw2652_with_active_segment_and_no_mop_zone.bin')
    expect(map).toMatchObject({ isValid: true, mapIndex: 804, mapSequence: 43 })
    expect(map.charger).toEqual({ x: 25273, y: 25603, a: -1 })
    expect(map.robot).toEqual({ x: 30550, y: 26455, a: -92 })
    expect(map.path).toHaveLength(78)
    expect(map.noGoAreas).toEqual([[25000, 28000, 27200, 28000, 27200, 27100, 25000, 27100]])
    expect(map.noMopAreas).toEqual([[29750, 27400, 32400, 27400, 32400, 25950, 29750, 25950]])
    expect(Object.fromEntries(map.rooms)).toEqual({
      16: { x0: 29550, y0: 29550, x1: 30450, y1: 30900 },
      17: { x0: 29000, y0: 24550, x1: 33100, y1: 29400 },
      18: { x0: 30550, y0: 29400, x1: 34750, y1: 31250 },
      19: { x0: 25050, y0: 24550, x1: 28950, y1: 29650 },
      20: { x0: 25150, y0: 29350, x1: 28150, y1: 30950 },
      21: { x0: 33350, y0: 24500, x1: 35300, y1: 29400 }
    })
  })

  it('refuses something that is not a map', () => {
    expect(() => parseRoborockMap(Buffer.from('12345'))).toThrow('not a Roborock map')
    expect(() => parseRoborockMap(Buffer.alloc(0))).toThrow('not a Roborock map')
  })
})

describe('toMapView', () => {
  const map = fixture('s5_fw2008_with_segments.bin')
  const view = toMapView(map, '2026-10-21T07:00:00.000Z')
  const pixels = Buffer.from(view.pixels, 'base64')
  const at = (x: number, y: number) => pixels[Math.floor(y) * view.width + Math.floor(x)]

  it('crops to what was mapped and keeps one byte per pixel', () => {
    expect(pixels).toHaveLength(view.width * view.height)
    expect(view.width).toBeLessThan(map.image!.width)
    expect(view.height).toBeLessThan(map.image!.height)
    expect(view.rooms).toEqual([1, 2])
    expect(new Set(pixels)).toEqual(new Set([0, 1, 2, 3, 4, 16 + 1, 16 + 2].filter(value => pixels.includes(value))))
  })

  it('places the charger and the robot inside the mapped floor', () => {
    const [chargerX, chargerY] = view.charger!
    const [robotX, robotY, heading] = view.robot!
    expect(heading).toBe(-88)
    for (const [x, y] of [
      [chargerX, chargerY],
      [robotX, robotY]
    ] as const) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(view.width)
      expect(y).toBeLessThan(view.height)
    }
    // The robot sits on mapped ground (room, floor or scanned), not outside the map.
    expect(at(robotX, robotY)).not.toBe(0)
  })

  it('puts room 1 where python-roborock says room 1 is', () => {
    // Centre of room 1's bounding box, converted the same way as every object.
    const room = map.rooms.get(1)!
    const image = map.image!
    const cx = (room.x0 + room.x1) / 2 / 50 - image.left
    const cyRaw = (room.y0 + room.y1) / 2 / 50 - image.top
    const cropX = view.charger![0] - (map.charger!.x / 50 - image.left)
    const cropY = view.charger![1] - (image.height - (map.charger!.y / 50 - image.top) - 1)
    const x = Math.round(cx + cropX)
    const y = Math.round(image.height - cyRaw - 1 + cropY)
    // The box centre of an L-shaped room can fall outside it, so look in a small neighbourhood.
    const around = [-2, -1, 0, 1, 2].flatMap(dx => [-2, -1, 0, 1, 2].map(dy => at(x + dx, y + dy)))
    expect(around).toContain(16 + 1)
  })

  it('keeps the path and areas in pixel pairs', () => {
    expect(view.path.length).toBe(933 * 2)
    const walls = toMapView(fixture('s5_fw1886_with_forbidden_zones_and_virtual_walls.bin'), 'now')
    expect(walls.walls[0]).toHaveLength(4)
    expect(walls.noGo[0]).toHaveLength(8)
    expect(walls.zones[0]).toHaveLength(8)
  })
})
