// Библиотеки
const { ipcMain, dialog } = require('electron');
const { app, BrowserWindow } = require('electron/main');
const fs = require("fs");
const path = require("path");
const { io } = require("socket.io-client");
const pkg = require("./package.json");
const { send } = require('process');
const VERSION = pkg.version;
const appId = "clumsybaboon-musicapp";

// Настройки по умолчанию
let config = {
    "autoConnect": false, // Автоподключение при старте программы
    "autoScroll": true // Автоскролл слов в треке
}
let TOKEN = ""; // Переменная для хранения токена

const SERVER_URL_WS = "http://127.0.0.1:9863/api/v1/realtime"; // Адрес сокета для постоянного мониторинга
let socket;

// Функция вывода отладки в консоль
function print(data, state) {
    switch (state) { // Выбор режима
        case "log": // Обычный лог
        case undefined:
            console.log(`[${__filename}] [${VERSION}]`, data);
            break;
        case "err": // Ошибка
            console.error(`[${__filename}] [${VERSION}]`, data);
            dialog.showErrorBox("Error", data); // Вывод диалог окна с ошибкой
            break;
    }
}

let win; // Основное окно

// Создание окна
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

// Ф-ция отправки POST запросов
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
            throw new Error(`Status: ${response.status} - ${errText}`); // Подъем ошибки при неудачном запросе 
        }
    } catch (err) {
        print(`Error in fetch: ${err}`, "err"); // Вывод ошибки в консоль
    }
}

// При старте программы
app.whenReady().then(() => {
  createWindow(); // Создание окна

  // Если окно не создалось, попытка создать еще раз
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  try { // ЧТЕНИЕ ТОКЕН ФАЙЛА
    const filePath = path.join(app.getPath("userData"), "token.txt"); // Путь к токен файлу
    if (fs.existsSync(filePath)) { // Проверка ли существует файл
        const data = fs.readFileSync(filePath, "utf-8"); // Чтение файла
        TOKEN = data; // Сохранение в переменную токена
        print("Token file was successfully read"); // Вывод результат чтения
    } else print("Token file doesn't exist");
  } catch (err) { // Ошибка при чтении файла
    print(`Error in reading token file: ${err}`, "err"); // Вывод ошибки в консоль
  }

  try { // ЧТЕНИЕ КОНФИГ ФАЙЛА
    const filePath = path.join(app.getPath("userData"), "config.json"); // Путь к конфиг файлу
    if (fs.existsSync(filePath)) { // Проверка ли существует файл
        const data = fs.readFileSync(filePath, "utf-8"); // Чтение файла
        config = JSON.parse(data); // Сохранение в переменную конфига
        print("Config file was successfully read"); // Вывод результат чтения
    } else print("Config file doesn't exist");
  } catch (err) { // Ошибка при чтении файла
    print(`Error in reading config file: ${err}`, "err"); // Вывод ошибки в консоль
  }
  print(config); // Вывод текущего конфига в консоль
  win.webContents.on("did-finish-load", () => { // Как загрузится окно electron
    win.webContents.send("config-file", config); // Отправить конфиг в окно electron
    if (config.autoConnect) connectWS(); // Автоматическое подключение к ютуб музыке (если включено в настройках)
  })
})

// Если все окна закрыты -> закрыть сокет !Добавить мак ос
app.on('window-all-closed', () => {
    if (socket != null) socket.disconnect();
    app.quit() // Закрыть программу
})

// ===== ФУНКЦИИ ИЗ ELECTRON =====

// Запрос токена \ Первое подключение
ipcMain.on("connect-api", async event => {
    print("Start connecting API..."); // Вывод в консоль
    // requestcode \ Первый запрос
    const url1 = "http://localhost:9863/api/v1/auth/requestcode"; // Адрес запроса временного кода
    const data1 = {
        "appId": appId,
        "appName": pkg.name,
        "appVersion": VERSION
    }
    let CODE; // Временный код для второго запроса
    try {
        // POST запрос
        const response = await fetch(url1, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data1)
        })

        if (!response.ok) { // Если ошибка
            const errText = await response.text(); // Текст ошибки
            throw new Error(`Status: ${response.status} - ${errText}`);
        }

        const result = await response.json(); // Результат запроса
        CODE = await result.code; // Достать временный код из результата
    } catch (err) { // Если ошибка
        print(`Error in fetch: ${err}`, "err"); // Вывод в консоль
        return; // Выйти досрочно из ф-ции
    }
    print(`CODE: ${CODE}`); // Вывод временного кода в консоль

    // requestToken \ Второй запрос
    const url2 = "http://localhost:9863/api/v1/auth/request"; // Адрес запроса токена
    const data2 = {
        "appId": appId,
        "appName": pkg.name,
        "appVersion": VERSION,
        "code": CODE
    }
    let TOKEN_buffer; // Временная переменная для хранения токена
    try {
        const response = await fetch(url2, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data2)
        })

        if (!response.ok) { // Если ошибка
            const errText = await response.text(); // Текст ошибки
            throw new Error(`Status: ${response.status} - ${errText}`);
        }

        const result = await response.json(); // Результат запроса
        TOKEN_buffer = await result.token; // Достать токен из результата
    } catch (err) { // Если ошибка
        print(`Error in fetch: ${err}`, "err"); // Вывод в консоль
        return; // Выйти досрочно из ф-ции
    }
    print(`TOKEN: ${TOKEN_buffer}`); // Вывод токена в консоль
    TOKEN = TOKEN_buffer; // Сохранение в глобальную переменную
    // Записать токен в файл
    try {
        const filePath = path.join(app.getPath("userData"), "token.txt"); // Путь к файлу
        fs.writeFileSync(filePath, TOKEN, "utf-8");
        print("Token file was saved"); // Вывод в консоль
    } catch (err) { // Если ошибка
        print(`Error in saving token file: ${err}`, "err"); // Вывод в консоль
        return; // Досрочно выйти из ф-ции
    }
    // Уведомляю о успешном завершении ф-ции
    dialog.showMessageBox(win, {
        type: "info",
        title: "Info",
        message: "Token was successfully updated and saved",
        buttons: ["Close"]
    })
})

ipcMain.on("connect-ws", connectWS); // Ф-ция вынесена отдельно, потому что она так же может быть вызвана через автоматическое подключение
                                     // при старте программы (если включено в настройках)

// Подключение к ютуб музыке
function connectWS() {
    print("Connecting to WS server..."); // Вывод в консоль
    // Настройка сокета
    socket = io(SERVER_URL_WS, {
        transports: ["websocket"], // При помощи websocket
        auth: {
            token: TOKEN // Токен
        }
    })
    // При подключении сокета
    socket.on("connect", async () => {
        print("Successfully connected"); // Вывод в консоль
        win.webContents.send("ws-connected"); // Отправка в electron
        // Первый запрос делаю вручную, потому что если музыка стоит на паузе сокет даёт автоматически информацию
        // гораздо реже
        try {
            // GET запрос
            const url = "http://localhost:9863/api/v1/state"; // Адрес
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": TOKEN,
                    "Content-Type": "application/json"
                }
            });
            if (!response.ok) { // Если ошибка
                const errText = await response.text(); // Текст ошибки
                throw new Error(`Status: ${response.status} - ${errText}`);
            }
            const state = await response.json(); // Распаковка результата
            win.webContents.send("state-update", state); // Отправка в electron
        } catch (err) { // Если ошибка
            print(`Error in fetch: ${err}`, "err"); // Вывод в консоль
        }
    })

    // Если у сокета ошибка -> Вывод в консоль -> Закрыть сокет
    // Информирование об этом electron-а происходит в следующей ф-ции
    socket.on("connect_error", err => {
        print(`Error in Socket.io: ${err}`, "err");
        socket.disconnect();
    });

    // Если сокет закрыт
    socket.on("disconnect", reason => {
        print(`Socket.io closed, reason: ${reason}`); // Вывод в консоль
        // Если окно electron еще существует -> Информирую его
        if (win && !win.isDestroyed()) win.webContents.send("ws-disconnected");
    });

    // При каждом обновлении -> Отправка в electron
    socket.on("state-update", state => win.webContents.send("state-update", state))
}

// Все ф-ции используют идентичную структуру:
// 1) Вывод в консоль, что будет происходить
// 2) Отправка соответствующего запроса через ф-цию sendPOST
// 3) Если нужны данные, они передаются через переменную data

// Изменить таймлайн
ipcMain.on("change-timeline", async (event, data) => {
    print(`Change timeline to ${data}`);
    sendPOST("http://localhost:9863/api/v1/command", {
        "command": "seekTo",
        "data": data
    })
})

// Остановка \ Воспроизвидение
ipcMain.on("play-pause", async () => {
    print("Play pause video");
    sendPOST("http://localhost:9863/api/v1/command", {
        "command": "playPause"
    })
})

// Переход к предыдушему треку
ipcMain.on("prev", async () => {
    print("Previous video");
    sendPOST("http://localhost:9863/api/v1/command", {
        "command": "previous"
    })
})

// Переход к следующему треку
ipcMain.on("next", async () => {
    print("Next video");
    sendPOST("http://localhost:9863/api/v1/command", {
        "command": "next"
    })
})

// Изменение текущего трека, на заданный
ipcMain.on("play-queue-index", (event, data) => {
    print(`Change video to ${data} (index in Queue)`);
    sendPOST("http://localhost:9863/api/v1/command", {
        "command": "playQueueIndex",
        "data": data
    })
})

// Обновление конфига
ipcMain.on("update-settings", (event, data) => {
    print("Updating settings"); // Вывод в консоль
    config = data; // Изменение переменной конфига на новую
    try {
        const filePath = path.join(app.getPath("userData"), "config.json"); // Путь к файлу
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
        print("Config file was saved"); // Вывод результата
    } catch (err) { // Если ошибка
        print(`Error in saving config file: ${err}`, "err"); // Вывод в консоль
        return; // Досрочно выйти из ф-ции
    }
    // Уведомляю пользователя
    dialog.showMessageBox(win, {
        type: "info",
        title: "Info",
        message: "Settings were successfully updated and saved",
        buttons: ["Close"]
    })
})

// Ф-ция перевода MM:SS.MS в секунды
function strToNumLyr(str) {
    const posDots = str.indexOf(':'); // Нахождения позиции [:]
    const posDot = str.indexOf('.'); // Нахождение позиции [.]
    const min = Number(str.slice(0, posDots));
    const sec = Number(str.slice(posDots + 1, posDot));
    const ms = Number(str.slice(posDot + 1));
    return min * 60000 + sec * 1000 + ms; // Возвращаю результат
}

// Запрос на текст песни
ipcMain.on("require-lyrics", async (event, data) => {
    print("Require lyrics"); // Вывод в консоль
    const url = "https://lrclib.net/api/get"; // Адрес запроса
    // Если сейчас ничего не играет -> досрочно выхожу из ф-ции
    if (data[0].length == 0 || data[1].length == 0 || data[2] == 0) {
        print("Require lyrics err. Nothing is playing");
        return;
    }
    // Параметры для GET запроса
    const data_send = new URLSearchParams({
        track_name: data[0], // Название трека
        artist_name: data[1], // Название исполнителя
        duration: data[2] // Длина трека
    })
    try {
        const response = await fetch(`${url}?${data_send}`); // Формирую запроса
        if (!response.ok) { // Если ошибка
            const errText = await response.text(); // Текст ошибки
            throw new Error(`Status: ${response.status} - ${errText}`);
        }
        const responseJson = await response.json(); // Результат в json-е
        let res; // Переменная для будущих слов
        let type; // Тип будущих слов 
        if (responseJson.syncedLyrics == null) { // Если в результате нет переменной с синхронизированными словами, то использовать обычные !добавить выбор!
            res = responseJson.plainLyrics.split('\n').map(element => ["plain", element]);
                        // Переменую делю по \n и меняю каждый елемент. Пример:
                        // ["Текст1 \n Текст2 \n Текст3"] -> [["plain", "Текст1"], ["plain", "Текст2"], ["plain", "Текст3"]]
            type = "plain"; // Задаю тип
        } else { // Синхронизированные слова построчно
            res = responseJson.syncedLyrics.split('\n').map(element => { // Переменую делю по \n и меняю каждый елемент
                // Данные из syncedLyrics: "[00:17.12] I feel your breath upon my neck\n ... [MM:SS:MS] text"
                const posOpen = element.indexOf("[") + 1; // Первая цифра находится по этому индексу (позиция скобки + 1)
                const posClose = element.indexOf("]"); // Правая скобка находится по этому индексу
                // Метод slice вырезает включительно с первым аргументом, но не включительно со вторым
                const time = strToNumLyr(element.slice(posOpen, posClose)); // Передаю ф-ции которая вернет результат в миллисекундах
                const lyr = element.slice(posClose + 2); // Первая буква слов начинается Позиция ] + 2
                                                         // Между словами и правой скобкой всегда стоит пробел
                return [time, lyr]; // Результат записываеся таким образом
            });
            type = "syn"; // Задаю тип
        }
        // Отправляю результат в electron
        win.webContents.send("lyrics-update", {
            lyr: res,
            type: type
        });
        print("Lyrics were send to renderer"); // Вывожу результат в консоль
    } catch (err) { // Если ошибка
        print(`Error in fetch: ${err}`); // Вывод в консоль
    }
})