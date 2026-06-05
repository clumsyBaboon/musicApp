const list = [
    {
        name: "photo1",
        pos: -4,
        needChange: true
    },
    {
        name: "photo2",
        pos: -3,
        needChange: true
    },
    {
        name: "photo3",
        pos: -2,
        needChange: true
    },
    {
        name: "photo4",
        pos: -1,
        needChange: true
    },
    {
        name: "photo5",
        pos: 0,
        needChange: true
    },
    {
        name: "photo6",
        pos: 1,
        needChange: true
    },
    {
        name: "photo7",
        pos: 2,
        needChange: true
    },
    {
        name: "photo8",
        pos: 3,
        needChange: true
    },
    {
        name: "photo9",
        pos: 4,
        needChange: true
    },
]

let playlistId;
let playingNumber;

let isCursorDragging = false;
let videoDuration;

let lastQueue;

function loop(times) {
    list.forEach(element => {
        element.pos += times;
        if (element.pos >= 5 || element.pos <= -5) {
            element.pos = element.pos * -1 + times;
            element.needChange = true;
            document.querySelector(`#${element.name}`).style.backgroundImage = "var(--default-album-photo)";
        }
        document.querySelector(`#${element.name}`).className = `album-photo pos${element.pos}`;
    })
}

function loop_from_site(value) {
    for (const element of list) if (element.name == `photo${value}` && !element.needChange && element.pos != 0) {
        window.electronAPI.playQueueIndex(playingNumber + element.pos);
        return;
    }
}

function command_next() { window.electronAPI.next() }

function command_prev() { window.electronAPI.prev() }

function command_play_pause() { window.electronAPI.playPause() }

let openedLyrics = false;
function lyrics() {
    openedLyrics = !openedLyrics;
    document.querySelector(".music-playback-wrapper").style.width = `${openedLyrics ? 50 : 100}%`;
    document.documentElement.style.setProperty("--open-lyrics-opacity", openedLyrics ? "0" : "1");
    document.documentElement.style.setProperty("--album-photo-decrease", openedLyrics ? "10vh" : "0vh");
    document.documentElement.style.setProperty("--left-position-album-photo", openedLyrics ? "calc(var(--album-photo-size) * 0.1 )" : "calc(50vw - var(--album-photo-size) / 2)");
    document.documentElement.style.setProperty("--music-control-wrapper-left", openedLyrics ? "calc(var(--album-photo-size) * 0.15 )" : "calc(50vw - var(--album-photo-size) * 0.45)")
}

function fullscreen() {
    document.documentElement.requestFullscreen();
}

document.querySelector("#music-range").addEventListener('input', () => {
    updateMusicRange();
    isCursorDragging = true;
});
document.querySelector("#music-range").addEventListener('change', () => {
    window.electronAPI.changeTimeline(Math.floor(document.querySelector("#music-range").value / document.querySelector("#music-range").max * videoDuration))
    isCursorDragging = false;
})
window.onload = () => updateMusicRange();

function updateMusicRange() {
    const value = document.querySelector("#music-range").value / document.querySelector("#music-range").max * 100;
    document.querySelector("#music-range").style.background = `linear-gradient(to right, rgba(255, 255, 255, 30%) 0%, white ${value}%, rgba(255, 255, 255, 30%) ${value}%, rgba(255, 255, 255, 30%) 100%)`;
}

function connect_api() {
    window.electronAPI.connectAPI();
}

function connect_ws() {
    window.electronAPI.connectWS();
}

window.electronAPI.getState(state => {
    console.log(state);
    updateScreen(state);
});

// Socket.io server control
window.electronAPI.onWSConnected(() => {
    document.documentElement.style.setProperty("--show-control-opacity", "1");
})
window.electronAPI.onWSDisconnected(() => {
    document.documentElement.style.setProperty("--show-control-opacity", "0");
})

function secToMin(sec) {
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec) % 60;
    const paddedSeconds = String(seconds).padStart(2, "0");
    return `${minutes}:${paddedSeconds}`;
}

const ui = {
    set songName(name) { document.querySelector("#music-name").textContent = name },
    set authorName(name) { document.querySelector("#music-author").textContent = name },
    set durationNow(value) { document.querySelector("#duration-now").textContent = value },
    set durationLeft(value) { document.querySelector("#duration-left").textContent = value },
    set timeline(value) { document.querySelector("#music-range").value = value },
    set playPause(value) { document.querySelector("#play-pause-svg").setAttribute("d", value ? "M6 19h4V5H6v14zm8-14v14h4V5h-4z" : "M8 5v14l11-7z") }
}

function updateScreen(state) {
    const player = state.player;
    if (player.queue.items.length == 0) return;
    const playingNumberTemp = findSelectedNumber(player.queue.items);
    const playlistIdTemp = state.playlistId;
    ui.durationNow = secToMin(player.videoProgress);
    ui.durationLeft = `-${secToMin(state.video.durationSeconds - Math.floor(player.videoProgress))}`;
    if (player.trackState == 0) ui.playPause = false;
    else if (player.trackState == 1) ui.playPause = true;
    if (!isCursorDragging) ui.timeline = Math.floor(player.videoProgress / state.video.durationSeconds * document.querySelector("#music-range").max);
    videoDuration = state.video.durationSeconds;
    updateMusicRange();
    if (playingNumberTemp != playingNumber) {
        ui.songName = player.queue.items[playingNumberTemp].title;
        ui.authorName = player.queue.items[playingNumberTemp].author;
        if (playlistIdTemp == playlistId && playingNumber - playingNumberTemp != 0) loop(playingNumber - playingNumberTemp);
        if (playlistIdTemp == playlistId) {
            list.forEach(element => {
                if (element.needChange) {
                    if (playingNumberTemp + element.pos >= 0 && playingNumberTemp + element.pos < player.queue.items.length) {
                        const thumbnails = player.queue.items[playingNumberTemp + element.pos].thumbnails;
                        document.querySelector(`#${element.name}`).style.backgroundImage = `url(${thumbnails[thumbnails.length - 1].url})`;
                        element.needChange = false;
                    } else {
                        document.querySelector(`#${element.name}`).style.backgroundImage = "var(--default-album-photo)";
                        element.needChange = true;
                    }
                }
            })
        }
    }
    playingNumber = playingNumberTemp;
    if (playlistIdTemp != playlistId || lastQueue != player.queue.items) {
        playlistId = playlistIdTemp;
        list.forEach(element => {
            if (playingNumberTemp + element.pos >= 0 && playingNumberTemp + element.pos < player.queue.items.length) {
                const thumbnails = player.queue.items[playingNumberTemp + element.pos].thumbnails;
                document.querySelector(`#${element.name}`).style.backgroundImage = `url(${thumbnails[thumbnails.length - 1].url})`;
                element.needChange = false;
            } else {
                document.querySelector(`#${element.name}`).style.backgroundImage = "var(--default-album-photo)";
                element.needChange = true;
            }
        })
        lastQueue = player.queue.items;
    }
}

function findSelectedNumber(queue) {
    for (let i = 0; i <= queue.length; i++) if (queue[i].selected) return i;
    return false;
} 

//SETINGS
const settingsMenu = document.querySelector("#settings");
let isSettingsOpen = false;
let config;

function openSettings() {
    if (isSettingsOpen) return;
    isSettingsOpen = true;
    settingsMenu.style.animation = "openSettings 300ms ease-in-out forwards";
    console.log(config.autoConnect);
    document.querySelector("#autoConnectAtStart").checked = config.autoConnect;
    document.querySelector("#settings-wrapper").style.backgroundColor = "rgba(0, 0, 0, 50%)";
    document.querySelector("#settings-wrapper").style.pointerEvents = "auto";
}

function settings_close() {
    isSettingsOpen = false;
    settingsMenu.style.animation = "closeSettings 300ms ease-in-out forwards";
    document.querySelector("#settings-wrapper").style.backgroundColor = "rgba(0, 0, 0, 0%)";
    document.querySelector("#settings-wrapper").style.pointerEvents = "none";
}

function settings_save() {
    const data = {
        autoConnect: document.querySelector("#autoConnectAtStart").checked
    }
    config = data;
    window.electronAPI.updateSettings(data);
}

window.electronAPI.onConfigFile(data => config = data);