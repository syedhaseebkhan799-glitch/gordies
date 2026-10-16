// Windows app: serves the static build (electron/web, copied from out/) on app://gordies,
// so it opens without internet and old chats stay readable offline.
const { app, BrowserWindow, protocol, net, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const WEB = path.join(__dirname, "web");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function fileFor(urlPath) {
  let p = path.normalize(path.join(WEB, decodeURIComponent(urlPath)));
  if (!p.startsWith(WEB)) return null;
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p) && fs.existsSync(p + ".html")) p += ".html";
  return fs.existsSync(p) ? p : null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 360,
    minHeight: 500,
    title: "Gordies",
    autoHideMenuBar: true,
    backgroundColor: "#0b0b0f",
  });
  // Links to other sites open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith("app://")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL("app://gordies/");
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  // Windows only shows toast notifications for apps with an AppUserModelID.
  app.setAppUserModelId("com.gordies.app");

  app.whenReady().then(() => {
    protocol.handle("app", (req) => {
      const file = fileFor(new URL(req.url).pathname) ?? path.join(WEB, "404.html");
      return net.fetch(pathToFileURL(file).toString());
    });
    createWindow();
  });

  app.on("window-all-closed", () => app.quit());
}
