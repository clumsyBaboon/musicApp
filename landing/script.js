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

let lyrics_type = null;
let lyrics_list = null;
let last = null;
let openedLyrics = false;

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

function lyrics() {
    openedLyrics = !openedLyrics;
    document.querySelector(".music-playback-wrapper").style.width = `${openedLyrics ? 50 : 100}%`;
    document.documentElement.style.setProperty("--open-lyrics-opacity", openedLyrics ? "0" : "1");
    document.documentElement.style.setProperty("--album-photo-decrease", openedLyrics ? "10vh" : "0vh");
    document.documentElement.style.setProperty("--left-position-album-photo", openedLyrics ? "calc(var(--album-photo-size) * 0.5 )" : "calc(50vw - var(--album-photo-size) / 2)");
    document.documentElement.style.setProperty("--music-control-wrapper-left", openedLyrics ? "calc(var(--album-photo-size) * 0.55 )" : "calc(50vw - var(--album-photo-size) * 0.45)");
    
    document.querySelector(".lyrics-wrapper").style.opacity = openedLyrics ? "1" : "0";
    if (openedLyrics) {
        const data = [
            ui.songName,
            ui.authorName,
            ui.duration
        ]
        window.electronAPI.requireLyrics(data);
    }
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

function moveTo(value) {
    window.electronAPI.changeTimeline(value);
}

function updateMusicRange() {
    const value = document.querySelector("#music-range").value / document.querySelector("#music-range").max;
    document.documentElement.style.setProperty("--percen-filled", value);
}

function updateLyrics(videoProg) {
    if (lyrics_list == null || lyrics_type != "syn") return;
    const pElements = document.querySelectorAll(".lyrics-wrapper p");
    let lastTemp = 0;
    for (let i = 0; i < lyrics_list.length; i++) {
        if (lyrics_list[i][0] <= Math.floor(videoProg.toFixed(2) * 1000)) {
            pElements[i].className = "active";
            lastTemp = i;
        } else pElements[i].className = "";
    }
    if (lastTemp != last && config.autoScroll) pElements[lastTemp].scrollIntoView({ block: "center", behavior: "smooth" });
    last = lastTemp;
}

function connect_api() {
    window.electronAPI.connectAPI();
}

function connect_ws() {
    window.electronAPI.connectWS();
}

window.electronAPI.getState(state => {
    // console.log(state);
    updateScreen(state);
});

// Socket.io server control
window.electronAPI.onWSConnected(() => {
    document.documentElement.style.setProperty("--show-control-opacity", "1");
})
window.electronAPI.onWSDisconnected(() => {
    document.documentElement.style.setProperty("--show-control-opacity", "0");
})

window.electronAPI.onLyrics(lyr => {
    console.log(lyr);
    if (lyrics_list == lyr.lyr) return;
    lyrics_list = lyr.lyr;
    lyrics_type = lyr.type;
    document.querySelectorAll(".lyrics-wrapper p").forEach(element => element.remove());
    const lyricsWrapper = document.querySelector(".lyrics-wrapper");
    lyr.lyr.forEach(element => {
        const newElement = document.createElement('p');
        newElement.textContent = element[1];
        if (lyrics_type == "syn") newElement.onclick = () => moveTo(Math.floor(element[0] / 1000));
        else newElement.className = "active";
        lyricsWrapper.insertBefore(newElement, lyricsWrapper.lastElementChild);
    })
})

function secToMin(sec) {
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec) % 60;
    const paddedSeconds = String(seconds).padStart(2, "0");
    return `${minutes}:${paddedSeconds}`;
}

const ui = {
    set songName(name) { document.querySelector("#music-name").textContent = name },
    get songName() { return document.querySelector("#music-name").textContent },
    set authorName(name) { document.querySelector("#music-author").textContent = name },
    get authorName() { return document.querySelector("#music-author").textContent },
    set durationNow(value) { document.querySelector("#duration-now").textContent = value },
    set durationLeft(value) { document.querySelector("#duration-left").textContent = value },
    set timeline(value) { document.querySelector("#music-range").value = value },
    set playPause(value) { document.querySelector("#play-pause-img").src = value ? "./img/stop.svg" : "./img/play.svg" },
    duration: 0
}

function strToNumLyr(str) {
    const posDots = str.indexOf(':');
    const min = Number(str.slice(0, posDots));
    const sec = Number(str.slice(posDots + 1));
    return min * 60 + sec;
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
    if (openedLyrics) updateLyrics(player.videoProgress);
    if (playingNumberTemp != playingNumber) {
        ui.songName = player.queue.items[playingNumberTemp].title;
        ui.authorName = player.queue.items[playingNumberTemp].author;
        ui.duration = strToNumLyr(player.queue.items[playingNumberTemp].duration);
        lyrics_list = null;
        last = null;
        document.querySelectorAll(".lyrics-wrapper p").forEach(element => element.remove());
        const lyricsWrapper = document.querySelector(".lyrics-wrapper");
        const newElement = document.createElement('p');
        newElement.className = "active";
        newElement.textContent = "Loading...";
        lyricsWrapper.insertBefore(newElement, lyricsWrapper.lastElementChild);
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
        if (openedLyrics) {
            const data = [
                ui.songName,
                ui.authorName,
                ui.duration
            ]
            window.electronAPI.requireLyrics(data);
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
    console.log(config.autoScroll);
    document.querySelector("#autoConnectAtStart").checked = config.autoConnect;
    document.querySelector("#autoScrollLyrics").checked = config.autoScroll;
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
        autoConnect: document.querySelector("#autoConnectAtStart").checked,
        autoScroll: document.querySelector("#autoScrollLyrics").checked
    }
    config = data;
    window.electronAPI.updateSettings(data);
}

window.electronAPI.onConfigFile(data => config = data);