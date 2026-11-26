/**
 * Serene for macOS.
 *
 * The whole planner runs inside the app: Electron starts the same Nuxt server
 * the website runs (built with `npm run desktop:build`), pointed at a SQLite
 * file in ~/Library/Application Support/Serene, and shows it in a window. So
 * every page and API works as on the web, with the data kept on this Mac.
 */
const { app, BrowserWindow, Menu, dialog, session, shell } = require('electron')
const { fork } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')

/** One fixed port, so the origin (and with it the login and browser storage) stays the same between launches. */
const PREFERRED_PORT = 47821
const HOST = '127.0.0.1'

let server = null
let mainWindow = null
let origin = ''
let quitting = false

// The same data folder whether running packaged or from the repo.
app.setName('Serene')
app.setPath('userData', path.join(app.getPath('appData'), 'Serene'))

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

/** Where the server and its migrations live: Resources/ when packaged, the repo while developing. */
const appRoot = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..')
const serverEntry = app.isPackaged
  ? path.join(process.resourcesPath, 'server', 'server', 'index.mjs')
  : path.join(appRoot, '.output', 'server', 'index.mjs')

function dataPath(...parts) {
  return path.join(app.getPath('userData'), ...parts)
}

/**
 * Settings kept beside the database: the session secret, made once per Mac,
 * and the port. Created owner-readable only.
 */
function loadConfig() {
  const file = dataPath('config.json')
  let config = {}
  try {
    config = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    // First launch, or an unreadable file: start fresh below.
  }
  if (typeof config.sessionPassword !== 'string' || config.sessionPassword.length < 32) {
    config.sessionPassword = crypto.randomBytes(32).toString('hex')
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 })
  return config
}

/**
 * Optional extra settings in ~/Library/Application Support/Serene/serene.env,
 * one KEY=value per line: for example NUXT_ANTHROPIC_API_KEY for the AI features.
 */
function loadExtraEnv() {
  const values = {}
  try {
    for (const line of fs.readFileSync(dataPath('serene.env'), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (match && !line.trimStart().startsWith('#')) {
        values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
      }
    }
  } catch {
    // No file: nothing extra.
  }
  return values
}

function portIsFree(port) {
  return new Promise(resolve => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port, HOST)
  })
}

async function choosePort(saved) {
  for (const port of [saved, PREFERRED_PORT].filter(Boolean)) {
    if (await portIsFree(port)) {
      return port
    }
  }
  // Both taken (another copy, or some other program): any free port will do for this run.
  return new Promise(resolve => {
    const probe = net.createServer()
    probe.listen(0, HOST, () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (!server || server.exitCode !== null) {
      throw new Error('The planner server stopped while starting.')
    }
    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) {
        return
      }
    } catch {
      // Not listening yet.
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error('The planner server did not start in time.')
}

async function startServer() {
  const config = loadConfig()
  const port = await choosePort(config.port)
  if (port !== config.port) {
    config.port = port
    fs.writeFileSync(dataPath('config.json'), JSON.stringify(config, null, 2), { mode: 0o600 })
  }
  origin = `http://${HOST}:${port}`

  const entry = serverEntry
  const logDir = dataPath('logs')
  fs.mkdirSync(logDir, { recursive: true })
  const log = fs.openSync(path.join(logDir, 'server.log'), 'a')

  server = fork(entry, [], {
    // The server finds its migrations in ./drizzle.
    cwd: appRoot,
    // Electron's own binary, running as plain Node.
    execPath: process.execPath,
    stdio: ['ignore', log, log, 'ipc'],
    env: {
      ...process.env,
      ...loadExtraEnv(),
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      HOST,
      PORT: String(port),
      SERENE_SERVER_ENTRY: entry,
      NUXT_DATABASE_URL: dataPath('planner.db'),
      NUXT_SESSION_PASSWORD: config.sessionPassword,
      NUXT_APP_ORIGIN: origin,
      // One person per Mac: the first sign-up claims the workspace.
      NUXT_SINGLE_USER_MODE: 'true',
      // Never the website's hosted database, whatever the shell environment says.
      TURSO_DATABASE_URL: '',
      TURSO_AUTH_TOKEN: ''
    }
  })
  server.on('exit', code => {
    if (!quitting && mainWindow) {
      dialog.showErrorBox('Serene stopped', `The planner server exited (code ${code}). Details are in ${path.join(logDir, 'server.log')}.`)
      app.quit()
    }
  })

  await waitForServer(origin, 30_000)
}

/** Links to other sites open in the default browser; the window only ever shows the planner. */
function keepNavigationInside(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(origin)) {
      return { action: 'allow' }
    }
    if (/^(https?|mailto):/.test(url)) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(origin)) {
      event.preventDefault()
      if (/^(https?|mailto):/.test(url)) {
        shell.openExternal(url)
      }
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: 'Serene',
    show: false,
    backgroundColor: '#fcf8fa',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  })
  keepNavigationInside(mainWindow.webContents)
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.loadURL(`${origin}/dashboard`)
}

function buildMenu() {
  const template = [
    { role: 'appMenu' },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => go('/dashboard') },
        { label: 'Finance', accelerator: 'CmdOrCtrl+2', click: () => go('/finance') },
        { label: 'Tasks', accelerator: 'CmdOrCtrl+3', click: () => go('/priorities') },
        { label: 'Calendar', accelerator: 'CmdOrCtrl+4', click: () => go('/calendar') },
        { label: 'Smart Home', accelerator: 'CmdOrCtrl+5', click: () => go('/smart-home') },
        { label: 'AI Assistant', accelerator: 'CmdOrCtrl+6', click: () => go('/assistant') },
        { type: 'separator' },
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => mainWindow?.webContents.navigationHistory.goBack() },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => mainWindow?.webContents.navigationHistory.goForward() }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Show Data Folder', click: () => shell.openPath(app.getPath('userData')) },
        { label: 'Show Server Log', click: () => shell.openPath(dataPath('logs', 'server.log')) }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function go(route) {
  if (!mainWindow) {
    createWindow()
    return
  }
  mainWindow.loadURL(`${origin}${route}`)
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  buildMenu()

  // Voice control records with the microphone; nothing else is ever granted.
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const fromPlanner = (details.requestingUrl || contents.getURL()).startsWith(origin)
    callback(fromPlanner && (permission === 'media' || permission === 'clipboard-sanitized-write'))
  })

  try {
    await startServer()
  } catch (error) {
    dialog.showErrorBox('Serene could not start', `${error.message}\n\nDetails are in ${dataPath('logs', 'server.log')}.`)
    app.quit()
    return
  }
  createWindow()

  app.on('activate', () => {
    if (!mainWindow) {
      createWindow()
    }
  })
})

// A Mac app stays running with no windows; ⌘Q quits it.
app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  quitting = true
  if (server && server.exitCode === null) {
    server.kill('SIGTERM')
  }
})
