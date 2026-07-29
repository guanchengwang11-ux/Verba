const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log/main");
const { copyFile, mkdir, access } = require("node:fs/promises");
const { constants } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

const serverPort = 3000;
let localServer;
let updateState = { status: "idle", message: "Update check has not started." };

function writeUpdaterLog(level, event, detail) {
  const message = `[updater] ${event}${detail ? ` ${JSON.stringify(detail)}` : ""}`;
  log[level](message);
}

function configureUpdater(service) {
  log.transports.console.level = "info";
  log.transports.file.level = "info";
  log.transports.file.resolvePathFn = () => join(app.getPath("logs"), "updater.log");
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  const setState = (status, detail = {}) => { updateState = { status, checkedAt: new Date().toISOString(), ...detail }; };
  autoUpdater.on("checking-for-update", () => { setState("checking"); writeUpdaterLog("info", "checking-for-update"); });
  autoUpdater.on("update-available", (info) => { setState("available", { version: info.version }); writeUpdaterLog("info", "update-available", info); });
  autoUpdater.on("update-not-available", (info) => { setState("not-available", { version: info.version }); writeUpdaterLog("info", "update-not-available", info); });
  autoUpdater.on("download-progress", (progress) => { setState("downloading", { percent: progress.percent }); writeUpdaterLog("info", "download-progress", progress); });
  autoUpdater.on("update-downloaded", (info) => { setState("downloaded", { version: info.version }); writeUpdaterLog("info", "update-downloaded", info); });
  autoUpdater.on("error", (error) => { setState("error", { message: error.message }); writeUpdaterLog("error", "error", { message: error.message, stack: error.stack }); });
  service.setUpdateHandlers({
    getState: () => updateState,
    check: async () => autoUpdater.checkForUpdates(),
    install: () => {
      if (updateState.status !== "downloaded") throw new Error("No downloaded update is ready to install.");
      writeUpdaterLog("info", "quit-and-install");
      autoUpdater.quitAndInstall();
    }
  });
}

async function ensureConfiguration() {
  const configurationDirectory = join(app.getPath("userData"), "config");
  const environmentFile = join(configurationDirectory, ".env");
  await mkdir(configurationDirectory, { recursive: true });
  try {
    await access(environmentFile, constants.F_OK);
  } catch {
    await copyFile(join(app.getAppPath(), ".env.example"), environmentFile);
  }
  return configurationDirectory;
}

async function startServer(configurationDirectory) {
  const service = await import(pathToFileURL(join(app.getAppPath(), "server.mjs")).href);
  configureUpdater(service);
  localServer = await service.startServer({ port: serverPort, publicDirectory: app.getAppPath(), configurationDirectory });
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${serverPort}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("The local translation service did not start.");
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    backgroundColor: "#f7f7f2",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.setMenuBarVisibility(false);
  window.once("ready-to-show", () => window.show());
  window.loadURL(`http://127.0.0.1:${serverPort}`);
}

app.whenReady().then(async () => {
  try {
    const configurationDirectory = await ensureConfiguration();
    await startServer(configurationDirectory);
    await waitForServer();
    createWindow();
    autoUpdater.checkForUpdates().catch((error) => writeUpdaterLog("error", "startup-check-failed", { message: error.message }));
  } catch (error) {
    dialog.showErrorBox("Verba could not start", `${error.message}\n\nCheck your .env file in ${join(app.getPath("userData"), "config")}.`);
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { if (localServer) localServer.close(); });
