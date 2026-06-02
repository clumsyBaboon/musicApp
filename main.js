const { ipcMain } = require('electron');
const { app, BrowserWindow } = require('electron/main');
const fs = require("fs");
const path = require("path");
const { io } = require("socket.io-client");
const pkg = require("./package.json");
const { send } = require('process');
const VERSION = pkg.version;

let TOKEN = "";

const SERVER_URL_WS = "http://127.0.0.1:9863/api/v1/realtime";
let socket;

function print(data, state) {
    switch (state) {
        case "log":
        case undefined:
            console.log(`[${__filename}] [${VERSION}] ${data}`);
            break;
        case "err":
            console.error(`[${__filename}] [${VERSION}] ${data}`);
            break;
    }
}

let win;

const createWindow = () => {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1400,
    minHeight: 900,
    // icon: path.join(__dirname, "icon.ico"),
    useContentSize: true,
    webPreferences: {
        preload: path.join(__dirname, "preload.js")
    }
  })

  win.setMenuBarVisibility(false);
  win.loadFile('./landing/index.html')
  win.webContents.openDevTools();
}

async function sendPOST(url, data) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": TOKEN,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Status: ${response.status} - ${errText}`);
        }
    } catch (err) {
        print(`Error in fetch: ${err}`, "err");
    }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  try {
    const filePath = path.join(app.getPath("userData"), "token.txt");
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        TOKEN = data;
        print("Token file was successfully read");
    } else print("Token file doesn't exist", "err");
  } catch (err) {
    print(`Error in reading token file: ${err}`, "err");
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on("connect-api", async event => {
    print("Start connecting API...");
    //requestcode
    const url1 = "http://localhost:9863/api/v1/auth/requestcode";
    const data1 = {
        "appId": pkg.build.appId,
        "appName": pkg.name,
        "appVersion": VERSION
    }
    let CODE;
    try {
        const response = await fetch(url1, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data1)
        })

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Status: ${response.status} - ${errText}`);
        }

        const result = await response.json();
        CODE = await result.code;
    } catch (err) {
        print(`Error in fetch: ${err}`, "err");
    }
    print(`CODE: ${CODE}`);

    //request
    const url2 = "http://localhost:9863/api/v1/auth/request";
    const data2 = {
        "appId": pkg.build.appId,
        "appName": pkg.name,
        "appVersion": VERSION,
        "code": CODE
    }
    let TOKEN_buffer;
    try {
        const response = await fetch(url2, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data2)
        })

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Status: ${response.status} - ${errText}`);
        }

        const result = await response.json();
        TOKEN_buffer = await result.token;
    } catch (err) {
        print(`Error in fetch: ${err}`, "err");
    }
    print(`TOKEN: ${TOKEN_buffer}`);
    TOKEN = TOKEN_buffer;
    try {
        const filePath = path.join(app.getPath("userData"), "token.txt");
        fs.writeFileSync(filePath, TOKEN, "utf-8");
        print("Token file saved");
    } catch (err) {
        print(`Error in saving token file: ${err}`, "err");
    }
})

ipcMain.on("connect-ws", event => {
    print("Connecting to WS server...");
    socket = io(SERVER_URL_WS, {
        transports: ["websocket"],
        auth: {
            token: TOKEN
        }
    })
    socket.on("connect", async () => {
        print("Successfully connected");
        win.webContents.send("ws-connected");
        try {
            const url = "http://localhost:9863/api/v1/state";
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": TOKEN,
                    "Content-Type": "application/json"
                }
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Status: ${response.status} - ${errText}`);
            }
            const state = await response.json();
            win.webContents.send("state-update", state);
        } catch (err) {
            print(`Error in fetch: ${err}`, "err");
        }
    })

    socket.on("connect_error", err => print(`Error in Socket.io: ${err}`, "err"));

    socket.on("disconnect", reason => {
        print(`Socket.io closed, reason: ${reason}`);
        win.webContents.send("ws-disconnected");
    });

    socket.on("state-update", state => {
        win.webContents.send("state-update", state);
    })
})

ipcMain.on("change-music", async (event, data) => {
    print(`Change music to VideoId: ${data.videoId}, playlistId: ${data.playlistId}`);
    sendPOST("http://localhost:9863/api/v1/command", {
        "command": "changeVideo",
        "data": {
            "videoId": data.videoId,
            "playlistId": data.playlistId
        }
    })
})

ipcMain.on("change-timeline", async (event, data) => {
    print(`Change timeline to ${data}`);
    sendPOST("http://localhost:9863/api/v1/command", {
        "command": "seekTo",
        "data": data
    })
})

ipcMain.on("play-pause", async () => {
    print("Play pause video");
    sendPOST("http://localhost:9863/api/v1/command", {
        "command": "playPause"
    })
})

ipcMain.on("prev", async () => {
    print("Previous video");
    sendPOST("http://localhost:9863/api/v1/command", {
        "command": "previous"
    })
})

ipcMain.on("next", async () => {
    print("Next video");
    sendPOST("http://localhost:9863/api/v1/command", {
        "command": "next"
    })
})