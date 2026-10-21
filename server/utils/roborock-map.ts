import type { VacuumMapView } from '~~/shared/types/smart-home'

/**
 * Reads a Roborock map (the "RRMap" format that Roborock-made vacuums upload,
 * whether through Xiaomi Home or the Roborock app). Ported from
 * PiotrMachowski's Xiaomi Cloud Map Extractor and vacuum-map-parser-roborock
 * (map_data_parser.py, image_parser.py). Pure functions; tested against real
 * S5 and S6 maps with the values python-roborock's own tests expect.
 *
 * The map is a header followed by blocks: [type u16][header length u16]
 * [data length u32][rest of header][data], all little-endian. Coordinates
 * are in millimetres; the image is in 50 mm pixels with its rows stored
 * bottom-up.
 */

const BLOCK = {
  CHARGER: 1,
  IMAGE: 2,
  PATH: 3,
  GOTO_PATH: 4,
  GOTO_PREDICTED_PATH: 5,
  CURRENTLY_CLEANED_ZONES: 6,
  GOTO_TARGET: 7,
  ROBOT_POSITION: 8,
  NO_GO_AREAS: 9,
  VIRTUAL_WALLS: 10,
  NO_MOPPING_AREAS: 12,
  DIGEST: 1024
} as const

/** Millimetres per image pixel. */
export const MM_PER_PIXEL = 50

const PIXEL_OUTSIDE = 0x00
const PIXEL_WALL = 0x01
const PIXEL_INSIDE = 0xff
const PIXEL_SCAN = 0x07

export interface MapPoint {
  x: number
  y: number
  a: number | null
}

export interface ParsedRoborockMap {
  majorVersion: number
  minorVersion: number
  mapIndex: number
  mapSequence: number
  isValid: boolean
  image: { top: number; left: number; width: number; height: number; pixels: Buffer } | null
  charger: MapPoint | null
  robot: MapPoint | null
  goto: { x: number; y: number } | null
  path: { x: number; y: number }[]
  gotoPath: { x: number; y: number }[]
  predictedPath: { x: number; y: number }[]
  zones: [number, number, number, number][]
  walls: [number, number, number, number][]
  noGoAreas: number[][]
  noMopAreas: number[][]
  /** Bounding box of each room, in millimetres, keyed by room number. */
  rooms: Map<number, { x0: number; y0: number; x1: number; y1: number }>
}

const u16 = (data: Buffer, at: number) => data.readUInt16LE(at)
const u32 = (data: Buffer, at: number) => data.readUInt32LE(at)

function objectPosition(data: Buffer, length: number): MapPoint {
  let a: number | null = null
  if (length > 8) {
    a = u32(data, 8)
    if (a > 0xff) {
      a = (a & 0xff) - 256
    }
  }
  return { x: u32(data, 0), y: u32(data, 4), a }
}

function pathPoints(raw: Buffer, blockStart: number, header: Buffer) {
  const length = u32(header, 0x04)
  const start = blockStart + 0x14
  const points: { x: number; y: number }[] = []
  for (let at = start; at + 4 <= start + length && at + 4 <= raw.length; at += 4) {
    points.push({ x: u16(raw, at), y: u16(raw, at + 2) })
  }
  return points
}

function quads(data: Buffer, header: Buffer): [number, number, number, number][] {
  const count = u16(header, 0x08)
  const out: [number, number, number, number][] = []
  for (let at = 0; at < count * 8 && at + 8 <= data.length; at += 8) {
    out.push([u16(data, at), u16(data, at + 2), u16(data, at + 4), u16(data, at + 6)])
  }
  return out
}

function areas(data: Buffer, header: Buffer) {
  const count = u16(header, 0x08)
  const out: number[][] = []
  for (let at = 0; at < count * 16 && at + 16 <= data.length; at += 16) {
    out.push(Array.from({ length: 8 }, (_, index) => u16(data, at + index * 2)))
  }
  return out
}

export function parseRoborockMap(raw: Buffer): ParsedRoborockMap {
  if (raw.length < 20 || raw.toString('latin1', 0, 2) !== 'rr') {
    throw new Error('This is not a Roborock map')
  }

  const map: ParsedRoborockMap = {
    majorVersion: u16(raw, 0x08),
    minorVersion: u16(raw, 0x0a),
    mapIndex: u32(raw, 0x0c),
    mapSequence: u32(raw, 0x10),
    isValid: false,
    image: null,
    charger: null,
    robot: null,
    goto: null,
    path: [],
    gotoPath: [],
    predictedPath: [],
    zones: [],
    walls: [],
    noGoAreas: [],
    noMopAreas: [],
    rooms: new Map()
  }

  let blockStart = u16(raw, 0x02)
  while (blockStart + 8 <= raw.length) {
    const headerLength = u16(raw, blockStart + 0x02)
    const header = raw.subarray(blockStart, blockStart + headerLength)
    const type = u16(header, 0x00)
    const dataLength = u32(header, 0x04)
    const dataStart = blockStart + headerLength
    const data = raw.subarray(dataStart, dataStart + dataLength)

    switch (type) {
      case BLOCK.CHARGER:
        map.charger = objectPosition(data, dataLength)
        break
      case BLOCK.ROBOT_POSITION:
        map.robot = objectPosition(data, dataLength)
        break
      case BLOCK.IMAGE:
        map.image = {
          top: u32(header, headerLength - 16),
          left: u32(header, headerLength - 12),
          height: u32(header, headerLength - 8),
          width: u32(header, headerLength - 4),
          pixels: data
        }
        break
      case BLOCK.PATH:
        map.path = pathPoints(raw, blockStart, header)
        break
      case BLOCK.GOTO_PATH:
        map.gotoPath = pathPoints(raw, blockStart, header)
        break
      case BLOCK.GOTO_PREDICTED_PATH:
        map.predictedPath = pathPoints(raw, blockStart, header)
        break
      case BLOCK.GOTO_TARGET:
        map.goto = { x: u16(data, 0), y: u16(data, 2) }
        break
      case BLOCK.CURRENTLY_CLEANED_ZONES:
        map.zones = quads(data, header)
        break
      case BLOCK.VIRTUAL_WALLS:
        map.walls = quads(data, header)
        break
      case BLOCK.NO_GO_AREAS:
        map.noGoAreas = areas(data, header)
        break
      case BLOCK.NO_MOPPING_AREAS:
        map.noMopAreas = areas(data, header)
        break
      case BLOCK.DIGEST:
        map.isValid = true
        break
    }
    // The reference advances by the header length's low byte.
    blockStart += dataLength + (header[2] ?? 0)
  }

  if (map.image) {
    const { pixels, width, height, left, top } = map.image
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const pixel = pixels[column + width * row]
        if (pixel === undefined || pixel === PIXEL_OUTSIDE || pixel === PIXEL_WALL || pixel === PIXEL_INSIDE || pixel === PIXEL_SCAN) {
          continue
        }
        if ((pixel & 0x07) === 7) {
          const number = pixel >> 3
          const room = map.rooms.get(number)
          if (!room) {
            map.rooms.set(number, { x0: column, y0: row, x1: column, y1: row })
          } else {
            room.x0 = Math.min(room.x0, column)
            room.y0 = Math.min(room.y0, row)
            room.x1 = Math.max(room.x1, column)
            room.y1 = Math.max(room.y1, row)
          }
        }
      }
    }
    for (const room of map.rooms.values()) {
      room.x0 = (room.x0 + left) * MM_PER_PIXEL
      room.y0 = (room.y0 + top) * MM_PER_PIXEL
      room.x1 = (room.x1 + left) * MM_PER_PIXEL
      room.y1 = (room.y1 + top) * MM_PER_PIXEL
    }
  }

  return map
}

/**
 * Pixel classes sent to the page, one byte each: 0 outside, 1 wall, 2 floor,
 * 3 scanned or unknown, 4 obstacle, and 16 + n for room n.
 */
function pixelClass(pixel: number) {
  if (pixel === PIXEL_OUTSIDE) return 0
  if (pixel === PIXEL_WALL) return 1
  if (pixel === PIXEL_INSIDE) return 2
  if (pixel === PIXEL_SCAN) return 3
  const kind = pixel & 0x07
  if (kind === 0) return 4
  if (kind === 1) return 1
  if (kind === 7) return 16 + (pixel >> 3)
  return 3
}

const MAX_PATH_POINTS = 4000

/**
 * The map as the page draws it: cropped to what was mapped, rows top-down,
 * and every object converted to pixel coordinates in that crop.
 */
export function toMapView(map: ParsedRoborockMap, fetchedAt: string): VacuumMapView {
  const image = map.image
  if (!image || !image.width || !image.height) {
    throw new Error('The map has no image')
  }

  // Classify into screen orientation (row 0 at the top) and find what was mapped.
  const { width, height } = image
  const classes = new Uint8Array(width * height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let row = 0; row < height; row += 1) {
    const screenRow = height - row - 1
    for (let column = 0; column < width; column += 1) {
      const value = pixelClass(image.pixels[column + width * row] ?? 0)
      classes[column + width * screenRow] = value
      if (value !== 0) {
        minX = Math.min(minX, column)
        maxX = Math.max(maxX, column)
        minY = Math.min(minY, screenRow)
        maxY = Math.max(maxY, screenRow)
      }
    }
  }
  if (maxX < 0) {
    throw new Error('The map is empty')
  }

  const margin = 3
  const cropX = Math.max(0, minX - margin)
  const cropY = Math.max(0, minY - margin)
  const cropWidth = Math.min(width, maxX + margin + 1) - cropX
  const cropHeight = Math.min(height, maxY + margin + 1) - cropY
  const cropped = Buffer.alloc(cropWidth * cropHeight)
  for (let row = 0; row < cropHeight; row += 1) {
    const from = (row + cropY) * width + cropX
    cropped.set(classes.subarray(from, from + cropWidth), row * cropWidth)
  }

  const toPixel = (x: number, y: number): [number, number] => [
    Math.round((x / MM_PER_PIXEL - image.left - cropX) * 10) / 10,
    Math.round((height - (y / MM_PER_PIXEL - image.top) - 1 - cropY) * 10) / 10
  ]
  const polygon = (points: number[]) => {
    const out: number[] = []
    for (let index = 0; index + 1 < points.length; index += 2) {
      out.push(...toPixel(points[index]!, points[index + 1]!))
    }
    return out
  }
  const flatPath = (points: { x: number; y: number }[]) => {
    const step = Math.max(1, Math.ceil(points.length / MAX_PATH_POINTS))
    const out: number[] = []
    for (let index = 0; index < points.length; index += step) {
      out.push(...toPixel(points[index]!.x, points[index]!.y))
    }
    return out
  }

  return {
    width: cropWidth,
    height: cropHeight,
    pixels: cropped.toString('base64'),
    charger: map.charger ? toPixel(map.charger.x, map.charger.y) : null,
    robot: map.robot ? [...toPixel(map.robot.x, map.robot.y), map.robot.a ?? 0] : null,
    path: flatPath(map.path),
    noGo: map.noGoAreas.map(polygon),
    noMop: map.noMopAreas.map(polygon),
    walls: map.walls.map(wall => polygon(wall)),
    zones: map.zones.map(([x0, y0, x1, y1]) => polygon([x0, y0, x1, y0, x1, y1, x0, y1])),
    rooms: [...map.rooms.keys()].sort((a, b) => a - b),
    mapIndex: map.mapIndex,
    fetchedAt
  }
}
