const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    connectAPI: () => ipcRenderer.send("connect-api"),
    connectWS: () => ipcRenderer.send("connect-ws"),
    changeTimeline: data => ipcRenderer.send("change-timeline", data),
    next: () => ipcRenderer.send("next"),
    prev: () => ipcRenderer.send("prev"),
    playQueueIndex: data => ipcRenderer.send("play-queue-index", data),
    updateSettings: data => ipcRenderer.send("update-settings", data),
    playPause: () => ipcRenderer.send("play-pause"),
    getState: callback => ipcRenderer.on("state-update", (event, data) => callback(data)),
    onWSConnected: callback => ipcRenderer.on("ws-connected", event => callback()),
    onWSDisconnected: callback => ipcRenderer.on("ws-disconnected", event => callback()),
    onConfigFile: callback => ipcRenderer.on("config-file", (event, data) => callback(data))
})