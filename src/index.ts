export const whatsappSettings = require('../config/whatsapp.json');
export const commandsSettings = require('../config/commands.json');
export const commandsPrefix = commandsSettings.commandPrefix ?? '';
export const packageInfo = require('../package.json');
export const ACTUAL_BBDD_VERSION: number = 2;

import dns from 'node:dns';
dns.setServers(['1.1.1.1', '1.0.0.1']);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { botLogError } from './utils/botLog.js'

import { startWhatsAppWebClient } from './modules/whatsapp/client.js'; 
import fs from 'node:fs';

if (!fs.existsSync("./json/.bbdd-version.json") || !fs.existsSync("./json/mendotran-buses.json") || !fs.existsSync("./json/mendotran-stops.json") || process.argv.includes('refresh')) {
    if (!process.argv.includes('refresh')) {
        botLogError(`No se han encontrado los archivos de la base de datos en "./json". `
            + `Se procederá a generar la base de datos.`
        );
    }
    
    require('./modules/mendotran/generateDatabase.js')
        .getMendotranDatabase()
        .then(() => {
            startWhatsAppWebClient();
        });
} else {
    startWhatsAppWebClient();
}
