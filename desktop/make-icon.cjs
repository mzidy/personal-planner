/**
 * Draws the app icon and writes build/icon.icns. Run with `npm run icon`
 * (Electron renders the SVG; macOS's sips and iconutil make the .icns).
 */
const { app, BrowserWindow } = require('electron')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

// The macOS icon grid: a 1024 canvas with an 824 rounded square in the middle.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c2740"/>
      <stop offset="1" stop-color="#0c111f"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8be6db"/>
      <stop offset="1" stop-color="#4fb8ab"/>
    </linearGradient>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>
  <circle cx="512" cy="512" r="250" fill="none" stroke="#6bd8cb" stroke-opacity="0.18" stroke-width="18"/>
  <path d="M640 380c-28-46-82-74-146-74-86 0-150 46-150 112 0 152 300 92 300 214 0 66-66 112-156 112-70 0-128-30-158-80"
        fill="none" stroke="url(#mark)" stroke-width="64" stroke-linecap="round"/>
</svg>`

app.whenReady().then(async () => {
  // Offscreen: a hidden window is never painted, so there would be nothing to capture.
  const window = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  window.webContents.setFrameRate(10)
  const painted = new Promise(resolve => window.webContents.once('paint', (_event, _dirty, image) => resolve(image)))
  await window.loadURL(`data:text/html,<html><body style="margin:0;background:transparent">${encodeURIComponent(SVG)}</body></html>`)
  const image = await painted

  const build = path.join(__dirname, 'build')
  const iconset = path.join(build, 'icon.iconset')
  fs.rmSync(iconset, { recursive: true, force: true })
  fs.mkdirSync(iconset, { recursive: true })
  const master = path.join(build, 'icon-1024.png')
  fs.writeFileSync(master, image.resize({ width: 1024, height: 1024 }).toPNG())

  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const pixels = size * scale
      const name = scale === 1 ? `icon_${size}x${size}.png` : `icon_${size}x${size}@2x.png`
      execFileSync('sips', ['-z', String(pixels), String(pixels), master, '--out', path.join(iconset, name)], { stdio: 'ignore' })
    }
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(build, 'icon.icns')])
  fs.rmSync(iconset, { recursive: true, force: true })
  console.log('Wrote build/icon.icns')
  app.quit()
})
