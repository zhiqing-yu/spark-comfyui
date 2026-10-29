'use strict'

const { app, BrowserWindow, dialog, nativeImage, session, shell } = require('electron')
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const root = process.env.SPARK_COMFYUI_ROOT || path.resolve(__dirname, '..', '..')
const script = path.join(root, 'spark-comfyui.sh')
const url = process.env.SPARK_COMFYUI_URL || 'http://127.0.0.1:8188'
const container = process.env.CONTAINER_NAME || 'spark-comfyui'
const stateDir = process.env.XDG_STATE_HOME
  ? path.join(process.env.XDG_STATE_HOME, 'spark-comfyui-desktop')
  : path.join(app.getPath('home'), '.local', 'state', 'spark-comfyui-desktop')
const logPath = path.join(stateDir, 'service.log')

app.setName('Spark ComfyUI')
app.setAppUserModelId('local.spark-comfyui-desktop')
app.setDesktopName('spark-comfyui.desktop')
// Use Chromium's defaults until profiling demonstrates a need for an override.

let mainWindow
let startedByApp = false
let exitRequested = false
let closeAttempts = 0
let launchTask

const primaryInstance = app.requestSingleInstanceLock()
if (!primaryInstance) app.quit()
app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

function appendLog(text) {
  fs.mkdirSync(stateDir, { recursive: true })
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${text}\n`)
}

function command(...args) {
  appendLog(`$ ${script} ${args.join(' ')}`)
  return new Promise((resolve, reject) => {
    const log = fs.openSync(logPath, 'a')
    let child
    try {
      child = spawn(script, args, { cwd: root, stdio: ['ignore', log, log] })
    } finally {
      fs.closeSync(log)
    }
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`命令退出码: ${code}`)))
  })
}

function isServiceRunning() {
  const result = spawnSync('docker', ['ps', '-q', '--filter', `name=^${container}$`], { encoding: 'utf8' })
  return result.status === 0 && Boolean(result.stdout.trim())
}

function healthy() {
  return new Promise((resolve) => {
    const request = http.get(`${url}/system_stats`, { timeout: 2000 }, (response) => {
      response.resume()
      resolve(response.statusCode === 200)
    })
    request.on('timeout', () => { request.destroy(); resolve(false) })
    request.on('error', () => resolve(false))
  })
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (exitRequested || await healthy()) return
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('等待 ComfyUI 就绪超时')
}

function forceExit() {
  if (exitRequested) return
  exitRequested = true
  const stopBackend = startedByApp
  if (mainWindow && !mainWindow.isDestroyed()) {
    const window = mainWindow
    window.removeAllListeners('close')
    window.destroy()
  }
  const finish = () => app.exit(0)
  if (!stopBackend) {
    finish()
    return
  }
  Promise.resolve(launchTask).catch(() => {}).then(() => command('stop'))
    .catch((error) => appendLog(error.stack || String(error)))
    .finally(finish)
}

function showSplash() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'comfyui.png'))
  const iconDataUrl = icon.toDataURL()
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Spark ComfyUI',
    backgroundColor: '#18181b',
    icon: path.join(__dirname, 'assets', 'comfyui.png'),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      partition: 'persist:spark-comfyui'
    }
  })
  mainWindow.setMenuBarVisibility(false)

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (!targetUrl.startsWith(url)) {
      shell.openExternal(targetUrl)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.webContents.on('dom-ready', () => {
    const currentUrl = mainWindow.webContents.getURL()
    if (currentUrl.startsWith(url)) {
      mainWindow.webContents.executeJavaScript(`
        (() => {
          function applySparkOptimizations() {
            const canvas = window.app?.canvas
            if (!canvas || !canvas.constructor) {
              setTimeout(applySparkOptimizations, 100)
              return
            }
            const LGraphCanvas = canvas.constructor
            if (!LGraphCanvas.__sparkOptimized) {
              LGraphCanvas.__sparkOptimized = true
              Object.defineProperty(LGraphCanvas.prototype, 'bgcanvas', {
                get() { return this.canvas },
                set() {},
                configurable: true
              })
              const origMouseDown = LGraphCanvas.prototype.processMouseDown
              LGraphCanvas.prototype.processMouseDown = function(...args) {
                this.__origShadows = this.render_shadows
                this.render_shadows = false
                return origMouseDown.apply(this, args)
              }
              const origMouseUp = LGraphCanvas.prototype.processMouseUp
              LGraphCanvas.prototype.processMouseUp = function(...args) {
                if (this.__origShadows !== undefined) {
                  this.render_shadows = this.__origShadows
                }
                return origMouseUp.apply(this, args)
              }
            }
            if (canvas.bgcanvas !== canvas.canvas) {
              delete canvas.bgcanvas
              canvas.bgctx = canvas.canvas.getContext('2d')
              canvas.draw(true, true)
            }
          }
          applySparkOptimizations()
        })()
      `).catch(() => {})
    }
  })

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <style>body{margin:0;background:#18181b;color:#fafafa;font:16px system-ui;display:grid;place-items:center;height:100vh}main{text-align:center}img{width:96px;height:96px;margin-bottom:20px}h1{margin:0 0 10px;font-size:32px}.sub{color:#a1a1aa}.spin{margin:26px auto;border:3px solid #3f3f46;border-top-color:#3b82f6;border-radius:50%;width:20px;height:20px;animation:r .8s linear infinite}@keyframes r{to{transform:rotate(360deg)}}</style>
    <main><img src="${iconDataUrl}"><h1>Spark ComfyUI</h1><div class="sub">正在启动优化后的本地工作空间…</div><div class="spin"></div></main>`))
  mainWindow.show()
  mainWindow.on('close', (event) => {
    if (exitRequested) return
    event.preventDefault()
    closeAttempts += 1
    // showMessageBoxSync inside this handler deadlocks GTK. A second close
    // bypasses the dialog so the window cannot remain stuck.
    if (closeAttempts > 1) {
      forceExit()
      return
    }
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['取消', startedByApp ? '退出并停止' : '退出'],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
      title: '退出 Spark ComfyUI？',
      message: startedByApp ? '退出应用并停止 ComfyUI？' : '退出应用？',
      detail: '再点一次窗口关闭按钮会直接退出。'
    }).then(({response}) => {
      if (response === 1) forceExit()
      else closeAttempts = 0
    }).catch((error) => {
      appendLog(error.stack || String(error))
      forceExit()
    })
  })
}

async function launch() {
  try {
    await session.fromPartition('persist:spark-comfyui').setProxy({ mode: 'direct' })
    showSplash()
    if (!isServiceRunning()) {
      startedByApp = true
      await command('service')
    }
    await waitForBackend()
    if (!exitRequested) await mainWindow.loadURL(url)
  } catch (error) {
    appendLog(error.stack || String(error))
    if (!exitRequested) dialog.showErrorBox('Spark ComfyUI 启动失败', `${error.message}\n\n日志: ${logPath}`)
  }
}

if (primaryInstance) {
  app.whenReady().then(() => { launchTask = launch() })
  app.on('window-all-closed', () => { if (!exitRequested) forceExit() })
  app.on('before-quit', (event) => {
    if (exitRequested) return
    event.preventDefault()
    forceExit()
  })
}
