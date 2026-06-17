import { LocalAuth, Client, MessageTypes, Message } from 'whatsapp-web.js';
import { existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import * as qrcode from 'qrcode-terminal';
import { botLog, botLogError, botLogOk } from '../../utils/botLog.js';
import { whatsappSettings, commandsSettings, packageInfo } from "../../index.js";
import { printMessage } from './printMessage.js';

import dns from 'dns';


const chromium: { path?: string } = require('chromium');

function getPuppeteerCachedChromePath(): string | undefined {
    const chromeCachePath = join(homedir(), '.cache', 'puppeteer', 'chrome');
    if (!existsSync(chromeCachePath)) { return undefined; }

    const cacheDirectories = readdirSync(chromeCachePath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(chromeCachePath, entry.name, process.platform === 'win32' ? 'chrome-win64' : 'chrome-linux64'))
        .map((directory) => process.platform === 'win32' ? join(directory, 'chrome.exe') : join(directory, 'chrome'))
        .filter((chromePath) => existsSync(chromePath));

    return cacheDirectories.at(-1);
}

function getBrowserExecutablePath(): string {
    const browserPaths = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH,
        chromium.path,
        process.platform === 'win32' ? join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe') : undefined,
        process.platform === 'win32' ? join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe') : undefined,
        process.platform === 'win32' ? join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe') : undefined,
        process.platform === 'win32' ? join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe') : undefined,
        process.platform === 'win32' ? join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe') : undefined,
        process.platform === 'linux' ? '/usr/bin/chromium' : undefined,
        process.platform === 'linux' ? '/usr/bin/chromium-browser' : undefined,
        process.platform === 'linux' ? '/usr/bin/google-chrome' : undefined,
        getPuppeteerCachedChromePath(),
    ];

    const browserPath = browserPaths.find((path) => path !== undefined && existsSync(path));
    if (browserPath === undefined) {
        throw new Error('No Chrome/Chromium executable was found. Install Chrome, or run `npx @puppeteer/browsers install chrome` and set PUPPETEER_EXECUTABLE_PATH if needed.');
    }

    return browserPath;
}

dns.setServers([
    '1.1.1.1',
    '1.0.0.1'
]);

const executablePath = getBrowserExecutablePath();
console.log('Using browser:', executablePath);

export const wwebClient = new Client({
    authStrategy: new LocalAuth({
        dataPath: `${whatsappSettings.wwebjsCache}/.wwebjs_auth`,
    }),
    puppeteer: {
        // Force system Chromium instead of bundled one
        executablePath: '/usr/bin/chromium-browser', // or '/usr/bin/chromium' depending on your distro
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-gpu',
            '--no-experiments',
            '--hide-scrollbars',
            '--disable-plugins',
            '--disable-infobars',
            '--disable-translate',
            '--disable-pepper-3d',
            '--disable-extensions',
            '--disable-dev-shm-usage',
            '--disable-notifications',
            '--disable-setuid-sandbox',
            '--disable-crash-reporter',
            '--disable-smooth-scrolling',
            '--disable-login-animations',
            '--disable-dinosaur-easter-egg',
            '--disable-accelerated-2d-canvas',
            '--disable-rtc-smoothness-algorithm',
            '--dns-over-https=https://cloudflare-dns.com/dns-query',
            '--ignore-certificate-errors',
            '--host-resolver-rules=MAP web.whatsapp.com 31.13.94.52',
            '--ignore-certificate-errors',
        ],
    },
    webVersionCache: {
        type: 'local',
        path: `${whatsappSettings.wwebjsCache}/.wwebjs_cache`,
    },
});



let clientStarted: boolean = false;

wwebClient.on('qr', (qr: string) => {
    console.clear();
    console.log("███████████████████████████████████████████████████████\n");
    qrcode.generate(qr, { small: true });
    console.log("Scan the QR code to log in to WhatsApp Web\n");
    console.log("███████████████████████████████████████████████████████\n");
});

wwebClient.on('authenticated', () => {
    botLog('Authenticated.');
});

wwebClient.on('auth_failure', (msg) => {
    botLogError('Auth failure.', msg);
});

wwebClient.on('disconnected', (reason) => {
    botLogError('Client session disconnected. Motive:', reason);
});

wwebClient.on('loading_screen', (percent: number) => {
    if (clientStarted === true) { return; }

    let loading_bar: string = '';
    while (loading_bar.length < Math.round(100 * .5)) {
        if (loading_bar.length < Math.round(percent * .5)) {
            loading_bar += '█';
        } else {
            loading_bar += ':';
        }
    }

    console.clear();
    console.log('\n' +
        `                 █  ${packageInfo.name.toUpperCase()}  █\n\n` +
        '                          ##########\n' +
        '                      #################\n' +
        '                    #####            #####\n' +
        '                  ####                  ####\n' +
        '                 ###                      ###\n' +
        '                ###     ####               ###\n' +
        '               ###     #####                ###\n' +
        '               ###     #####                ###\n' +
        '               ###      ###                 ###\n' +
        '               ###       ####               ###\n' +
        '               ###         ####   ####      ###\n' +
        '                ###         ##########     ###\n' +
        '                 ###            #####     ###\n' +
        '                 ###                    ####\n' +
        '                ###                  #####\n' +
        '                #######################\n' +
        '               ########   ##########\n\n' +
        `                        Release: ${packageInfo.version}\n` +
        `                  MendoBot by MerK2: 2.7.4\n`
    );
    console.log(` ${loading_bar} [ ${percent} % ]\n`);
});

wwebClient.on('ready', () => {
    if (clientStarted === false) {
        clientStarted = true;
    } else { return; }

    botLog('MendoBot is ready to go!');

    const startTime = Date.now();
    const commandPath: string = '../commands';
    let commandExecution = require(`${commandPath}/commands.js`).commandExecution;
    require(`${commandPath}/commandsList.js`);
    botLogOk("All commands loaded by PreLoader")

    if (!whatsappSettings.showMessagesInTheTerminal) { botLog('Mensajes ocultos.'); }


    if (commandsSettings.hotSwappingEnabled) {
        setInterval(() => {
            try {
                delete require.cache[require.resolve(`${commandPath}/commands.js`)];
                delete require.cache[require.resolve(`${commandPath}/commandsList.js`)];
                delete require.cache[require.resolve(`${commandPath}/sendResponses.js`)];
                delete require.cache[require.resolve(`./messageSending.js`)];
                delete require.cache[require.resolve(`../mendotran/mendotran.js`)];

                commandExecution = require(`${commandPath}/commands.js`).commandExecution;
                require(`${commandPath}/commandsList.js`);
            } catch (error) {
                console.error('Error cleaning cache:', error);
            }
        }, commandsSettings.hotSwappingTimer);
    }

   
    if (whatsappSettings.showMessagesInTheTerminal) {
        wwebClient.on('message_edit', async (message: Message) => {
           
            if (message.timestamp * 1000 < startTime) { return; }
            const from: string = message.fromMe ? message.to : message.from;
            printMessage(message, from, true);
        });
    }

    wwebClient.on('message_create', async (message: Message) => {
 
        if (message.isStatus || (message.timestamp * 1000 < startTime)) { return; }

        if (whatsappSettings.ignoreNonTextMessages === true && message.type !== MessageTypes.TEXT && message.type !== MessageTypes.LOCATION) { return; }

        if (message.type === MessageTypes.E2E_NOTIFICATION || message.type === MessageTypes.NOTIFICATION_TEMPLATE ||
            message.type === MessageTypes.NOTIFICATION || message.type === MessageTypes.GROUP_NOTIFICATION ||
            message.type === MessageTypes.UNKNOWN) { return; }

        const from: string = message.fromMe ? message.to : message.from;


        if (whatsappSettings.showMessagesInTheTerminal) { printMessage(message, from); }

      

        if (commandExecution === undefined) { return; }

   
        if (commandsSettings.adminOnly && !message.fromMe) { return; }

        if (message.type === MessageTypes.LOCATION && message.location) {
            try {
                const { getNearestStopsText } = require('../mendotran/mendotran.js');
                const nearestStopsText = getNearestStopsText(Number(message.location.latitude), Number(message.location.longitude), 7);
                await wwebClient.sendMessage(from, nearestStopsText, {
                    quotedMessageId: message.id._serialized,
                    linkPreview: false,
                });
            } catch (error) {
                const errorMessage = typeof error === 'object' && error !== null && 'message' in error
                    ? String(error.message)
                    : 'No se pudo procesar la ubicacion.';
                await wwebClient.sendMessage(from, `⚠️ ${errorMessage}`, {
                    quotedMessageId: message.id._serialized,
                    linkPreview: false,
                });
            }
            return;
        }

        if (message.body.indexOf(commandsSettings.commandPrefix) === 0 && typeof message.body === 'string' && message.type === MessageTypes.TEXT) {
            commandExecution(message);
        }
    });
});

export function startWhatsAppWebClient(): void { wwebClient.initialize(); }
