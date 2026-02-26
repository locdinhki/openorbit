import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, resolve } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { networkInterfaces } from 'os'
import { randomUUID } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initCore } from '@openorbit/core/config'
import { setCoreNotifier } from '@openorbit/core/core-notifier'
import {
  registerIPCHandlers,
  cleanupSession,
  setUpdater,
  setAIService,
  setScheduler,
  getActiveCoordinator,
  getActiveSessionManager,
  getOrCreateSessionManager,
  type PairingContext
} from './ipc-handlers'
import { Scheduler } from '@openorbit/core/automation/scheduler'
import { initLogger } from '@openorbit/core/utils/logger'
import { ConfigWatcher } from '@openorbit/core/utils/config-watcher'
import { TrayManager } from './tray'
import { Notifier } from './utils/notifier'
import { Updater } from './updater'
import { RPCServer } from './rpc-server'
import { registerRPCHandlers } from './rpc-handlers'
import { setRelaySender } from '@openorbit/core/automation/relay-session'
import { IPC } from '@openorbit/core/ipc-channels'
import { initExtensionHost } from '@openorbit/core/extensions/extension-host'
import { getDatabase } from '@openorbit/core/db/database'
import { AIProviderRegistry } from '@openorbit/core/ai/provider-registry'
import type { ExtensionMainAPI } from '@openorbit/core/extensions/types'

// Built-in extensions (statically imported so electron-vite bundles them)
import extAiClaudeSdkMain from '@openorbit/ext-ai-claude-sdk/main/index'
import extAiClaudeMain from '@openorbit/ext-ai-claude/main/index'
import extAiOpenaiMain from '@openorbit/ext-ai-openai/main/index'
import extAiOllamaMain from '@openorbit/ext-ai-ollama/main/index'
import extJobsMain from '@openorbit/ext-jobs/main/index'
import extTelegramMain from '@openorbit/ext-telegram/main/index'
import extImessageMain from '@openorbit/ext-imessage/main/index'
import extWhatsappMain from '@openorbit/ext-whatsapp/main/index'
import extDiscordMain from '@openorbit/ext-discord/main/index'
import extDbViewerMain from '@openorbit/ext-db-viewer/main/index'
import extZillowMain from '@openorbit/ext-zillow/main/index'
import extGhlMain from '@openorbit/ext-ghl/main/index'

let mainWindow: BrowserWindow | null = null
let configWatcher: ConfigWatcher | null = null
let cronScheduler: Scheduler | null = null
let trayManager: TrayManager | null = null
let updater: Updater | null = null
let rpcServer: RPCServer | null = null
let extensionHost: ReturnType<typeof initExtensionHost> | null = null
let isCleaningUp = false
let pairingContext: PairingContext | null = null

function getLocalIpAddress(): string {
  const ifaces = networkInterfaces()
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address
      }
    }
  }
  return '127.0.0.1'
}

function loadOrCreateToken(tokenPath: string): string {
  try {
    return readFileSync(tokenPath, 'utf-8').trim()
  } catch {
    const token = randomUUID()
    writeFileSync(tokenPath, token, { mode: 0o600 })
    return token
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'OpenOrbit',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  registerIPCHandlers(mainWindow, pairingContext ?? undefined)

  // Initialize AI Provider Registry (populated by provider extensions)
  const aiRegistry = new AIProviderRegistry()
  const aiServiceFacade = aiRegistry.toService()
  setAIService(aiServiceFacade)

  // Create scheduler early so extensions can register task handlers during activation
  cronScheduler = new Scheduler({
    onRunStart: (scheduleId) => {
      mainWindow?.webContents.send(IPC.SCHEDULE_RUN_START, { scheduleId })
    },
    onRunComplete: (scheduleId, result) => {
      mainWindow?.webContents.send(IPC.SCHEDULE_RUN_COMPLETE, { scheduleId, ...result })
    }
  })
  setScheduler(cronScheduler)

  // Initialize extension system
  const preloadedModules = new Map<string, ExtensionMainAPI>([
    ['ext-ai-claude-sdk', extAiClaudeSdkMain],
    ['ext-ai-claude', extAiClaudeMain],
    ['ext-ai-openai', extAiOpenaiMain],
    ['ext-ai-ollama', extAiOllamaMain],
    ['ext-jobs', extJobsMain],
    ['ext-telegram', extTelegramMain],
    ['ext-imessage', extImessageMain],
    ['ext-whatsapp', extWhatsappMain],
    ['ext-discord', extDiscordMain],
    ['ext-db-viewer', extDbViewerMain],
    ['ext-zillow', extZillowMain],
    ['ext-ghl', extGhlMain]
  ])

  const projectRoot = is.dev ? resolve(__dirname, '../..') : resolve(app.getAppPath(), '../..')

  extensionHost = initExtensionHost({
    ipcMain,
    getMainWindow: () => mainWindow,
    db: getDatabase(),
    services: {
      browser: {
        getSession: () => getOrCreateSessionManager(),
        isInitialized: () => getActiveSessionManager()?.isInitialized() ?? false,
        ensureReady: async () => {
          const sm = getOrCreateSessionManager()
          if (!sm.isInitialized()) {
            await sm.init()
          }
        }
      },
      ai: aiServiceFacade,
      settings: { get: () => null },
      scheduler: {
        addJob: () => '',
        removeJob: () => {},
        registerTaskType: (taskType, handler, meta) => {
          cronScheduler?.registerTaskType(taskType, handler, meta)
        }
      },
      notifications: { show: () => {} }
    },
    projectRoot,
    extensionDataRoot: join(app.getPath('userData'), 'extensions'),
    preloadedModules
  })

  // Discover and activate extensions, then register the shell IPC handler.
  // The renderer bootstrap waits on SHELL_EXTENSIONS, so this must complete first.
  const extensionsReady = extensionHost.discoverAndLoadAll().catch((err) => {
    console.error('Failed to load extensions:', err)
  })

  ipcMain.handle(IPC.SHELL_EXTENSIONS, async () => {
    await extensionsReady
    return extensionHost!.listExtensions()
  })

  // Watch config directories for hot-reload
  const hintsDir = join(app.getPath('userData'), 'hints')
  if (!existsSync(hintsDir)) mkdirSync(hintsDir, { recursive: true })

  configWatcher = new ConfigWatcher(300)
  configWatcher.watch(hintsDir, 'hints')
  configWatcher.on('change', (event: { type: string }) => {
    mainWindow?.webContents.send(IPC.CONFIG_CHANGED, { type: event.type })
  })

  // Start cron scheduler (task handlers already registered by extensions during activation)
  cronScheduler.start()

  // Initialize system tray
  trayManager = new TrayManager({
    onStartAutomation: () => {
      const coord = getActiveCoordinator()
      if (!coord.isRunning()) {
        coord.startAll().catch(() => {})
      }
    },
    onStopAutomation: () => {
      getActiveCoordinator().stop()
    }
  })
  trayManager.init(mainWindow, icon)

  // Initialize desktop notifications
  const notifier = new Notifier()
  notifier.setMainWindow(mainWindow)
  setCoreNotifier(notifier)

  // Initialize auto-updater (production only)
  if (!is.dev) {
    updater = new Updater({
      isAutomationRunning: () => getActiveCoordinator().isRunning()
    })
    updater.init(mainWindow)
    setUpdater(updater)
  }
}

app.whenReady().then(() => {
  const userData = app.getPath('userData')

  // Initialize core config before anything else
  initCore({
    dataDir: join(userData, 'data'),
    backupDir: join(userData, 'backups'),
    logDir: join(userData, 'logs'),
    hintsDir: join(userData, 'hints'),
    browserProfileDir: join(userData, 'data', 'browser-profile'),
    isDev: is.dev
  })

  // Initialize file logging
  initLogger(join(userData, 'logs'), is.dev)

  // Start JSON-RPC WebSocket server for CLI/remote access
  const tokenPath = join(userData, 'rpc-token')
  const rpcToken = loadOrCreateToken(tokenPath)

  // Read bind host from settings (default: localhost only)
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must import after initCore initializes DB
  const { SettingsRepo } = require('@openorbit/core/db/settings-repo')
  const settingsRepo = new SettingsRepo()
  const rpcBindHost = (settingsRepo.get('rpc.bind-host') as string) ?? '127.0.0.1'

  rpcServer = new RPCServer({ token: rpcToken, host: rpcBindHost })
  registerRPCHandlers(rpcServer, {
    getCoordinator: () => getActiveCoordinator()
  })
  rpcServer.start()

  // Build pairing context for QR code (local LAN IP + port + token)
  const localIp = getLocalIpAddress()
  pairingContext = { wsUrl: `ws://${localIp}:${rpcServer.getPort()}`, token: rpcToken }

  // Wire up relay CDP sender so SessionManager relay mode can route commands
  setRelaySender((tabId, cdpMethod, cdpParams) =>
    rpcServer!.sendRelayCommand(tabId, cdpMethod, cdpParams ?? {})
  )

  electronApp.setAppUserModelId('com.openorbit.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', (e) => {
  if (!isCleaningUp) {
    isCleaningUp = true
    e.preventDefault()

    rpcServer?.destroy()
    rpcServer = null
    updater?.destroy()
    updater = null
    trayManager?.destroy()
    trayManager = null
    cronScheduler?.stop()
    cronScheduler = null
    configWatcher?.close()
    configWatcher = null

    const cleanup = async (): Promise<void> => {
      if (extensionHost) {
        await extensionHost.deactivateAll()
        extensionHost = null
      }
      await cleanupSession()
    }

    cleanup().finally(() => {
      app.quit()
    })
  }
})
