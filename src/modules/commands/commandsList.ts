import { CommandError, createCommand } from "./commands.js";
import { sendResponse, sendErrorResponse } from "./sendResponses.js";
import { getMetroArrivals, getNextStopArrival, getStopArrivals, normalizeStopCode } from "../mendotran/mendotran.js";
import { getSavedStopAlias, listSavedStopAliases, saveStopAlias } from "../mendotran/savedStops.js";
import { getTimeString } from "../../utils/getTimeString.js";
import { wwebClient } from "../whatsapp/client.js";
const os = require('os');
function getMessageOwner(message: any): string {
    return message.fromMe ? message.to : message.from;
}

function resolveSavedStop(owner: string, stopOrAlias: string): string {
    return getSavedStopAlias(owner, stopOrAlias) ?? stopOrAlias;
}

function parseBusAndStop(args: any[]): { bus: string; stop: string } {
    const bus = args.shift()?.toString();
    const stop = args.join(" ").trim();

    if (!bus || !bus.match(/^\d+$/) || !stop) {
        throw new CommandError('Uso: `Recordatorio n°MICRO n°PARADA`');
    }

    return { bus, stop };
}

createCommand(['ping'], {
    info: {
        name: 'Ping',
        description: 'Ping-pong! 🏓',
    }
})
    .setCallback(async (args, message) => {
        await sendResponse('Pong!', message, {
            reaction: '🏓',
        });
    })
    .closeCommand();

createCommand(['pong'], {
    info: {
        name: 'Pong',
        description: 'Ping-pong! 🏓',
    }
})
    .setCallback(async (args, message) => {
        await sendResponse('Ping!', message, {
            reaction: '🏓',
        });
    })
    .closeCommand();

createCommand(['micro', 'bus', 'm', '🚍'], {
    options: {
        disableQuotationMarks: true,
    },
    info: {
        name: 'Mendotran - Micro',
        description: 'Obtener los horarios de un colectivo en una parada.'
    }
})
    .addParameter('number', {
        name: 'Línea',
        description: 'El número del colectivo que querés consultar.',
        example: '608',
    })
    .addParameter('string', {
        name: 'Nº de parada',
        description: 'El código de parada del colectivo.',
        example: 'M1028',
    })
    .setCallback(async function (args, message) {
        const owner = getMessageOwner(message);
        const stop = resolveSavedStop(owner, args.slice(1).join(" "));
        await getStopArrivals(stop, args[0] ? args[0].toString() : args[0])
            .then(async (arrivals) => {
                await sendResponse(arrivals, message, {
                    reaction: '🚌',
                    messageOptions: { linkPreview: false },
                });
            });
    })
    .closeCommand();

createCommand(['stop', 'parada', 'p', '🚏'], {
    options: {
        disableQuotationMarks: true,
    },
    info: {
        name: 'Mendotran - Parada',
        description: 'Obtener los horarios de una parada de colectivos.',
    }
})
    .addParameter('string', {
        name: 'Nº de parada',
        description: 'El código de parada de la cual desea saber sus horarios.',
        example: 'M1012',
    })
    .setCallback(async function (args, message) {
        const owner = getMessageOwner(message);
        await getStopArrivals(resolveSavedStop(owner, args[0]))
            .then(async (arrivals) => {
                await sendResponse(arrivals, message, {
                    reaction: '🚌',
                    messageOptions: {
                        linkPreview: false,
                    },
                });
            });
    })
    .closeCommand();

createCommand(['guardarparada', 'guardar', 'save'], {
    options: {
        disableQuotationMarks: true,
    },
    info: {
        name: 'Mendotran - Guardar parada',
        description: 'Guardar un nombre corto para una parada.',
    }
})
    .setCallback(async function (args, message) {
        const alias = args.shift()?.toString().trim();
        const stop = args.join(" ").trim();

        if (!alias || !stop) {
            throw new CommandError('Uso: `GuardarParada NOMBRE n°PARADA`');
        }

        const stopCode = normalizeStopCode(stop);
        saveStopAlias(getMessageOwner(message), alias, stopCode);

        await sendResponse(`Guardada: *${alias.toUpperCase()}* ➡️ *${stopCode}*\n\n> Ya puede usar:\n> \`n°MICRO ${alias.toUpperCase()}\``, message, {
            reaction: '✅',
            messageOptions: { linkPreview: false },
        });
    })
    .closeCommand();

createCommand(['mystops', 'misparadas', 'paradasguardadas', 'savedstops'], {
    options: {
        disableQuotationMarks: true,
    },

    info: {
        name: 'Mendotran - Mis paradas',
        description: 'Ver las paradas guardadas.',
    }
})
    .setCallback(async function (args, message) {
        const savedStops = listSavedStopAliases(getMessageOwner(message));

        if (savedStops.length === 0) {
            await sendResponse('No tiene paradas guardadas todavia.\n\nUse: `GuardarParada NOMBRE n°PARADA`', message, {
                reaction: '📌',
                messageOptions: { linkPreview: false },
            });
            return;
        }

        const text = savedStops.map((savedStop) => `> 🚏 *${savedStop.alias}-${savedStop.stopCode}*`).join('\n');
        await sendResponse(`💾 *Paradas guardadas* 💾\n\n${text}`, message, {
            reaction: '📋',
            messageOptions: { linkPreview: false },
        });
    })
    .closeCommand();

// Recordatorio
createCommand(['recordatorio', 'reminder', 'recordar', 'r'], {
    info: {
        name: 'Mendotran - Recordatorio',
        description: 'Enviar un aviso 5 minutos antes de que llegue un micro.',
    }
})
    .setCallback(async function (args, message) {
        const { bus, stop } = parseBusAndStop([...args]);
        const owner = getMessageOwner(message);
        const stopCodeOrAlias = resolveSavedStop(owner, stop);
        const nextArrival = await getNextStopArrival(stopCodeOrAlias, bus);
        const reminderAt = nextArrival.arrival.arrivalTime - (5 * 60 * 1000);
        const waitTime = reminderAt - Date.now();

        if (waitTime <= 0) {
            throw new CommandError(`El micro *${bus}* llega a las *${getTimeString(nextArrival.arrival.arrivalTime, true, true)}*, falta menos de 5 minutos.`);
        }

        if (waitTime > 2147483647) {
            throw new CommandError('Ese arribo queda demasiado lejos para programar un recordatorio.');
        }

        setTimeout(() => {
            const text = `🔔 *Recordatorio Mendotran*\n\n> El micro *${nextArrival.bus}* llega a la parada *${nextArrival.stopCode}* aproximadamente a las *${getTimeString(nextArrival.arrival.arrivalTime, true, true)}*.\n\n> 📍 ${nextArrival.stopLocation ?? 'Ubicacion sin nombre'}`;
            wwebClient.sendMessage(owner, text).catch(console.error);
        }, waitTime);

        await sendResponse(`⏰ Te recordaré!!⏰.\n\n> Te enviaré un mensaje a las *${getTimeString(reminderAt, true, true)}* para el micro *${bus}* en *${nextArrival.stopCode}*.`, message, {
            reaction: '⏰',
            messageOptions: { linkPreview: false },
        });
    })
    .closeCommand();

createCommand(['metro', 'metrotranvia', 'metrotranvía', 'estacion', 'estación', '🚊'], {
    options: {
        disableQuotationMarks: true,
    },
    info: {
        name: 'Mendotran - Metrotranvía',
        description: 'Obtener los horarios de una estación de metrotranvía.',
    }
})
    .addParameter('string', {
        name: 'Nombre de la estación',
        example: 'Piedra buena'
    })
    .setCallback(async (args, message) => {
        await getMetroArrivals(args[0])
            .then(async (arrivals) => {
                await sendResponse(arrivals, message, {
                    reaction: '🚋',
                });
            });
    })
    .closeCommand();




    createCommand(['uptime', 'up', '⏱️'], {
    options: {
        disableQuotationMarks: true,
    },
    info: {
        name: 'Uptime',
        description: 'Muestra cuánto tiempo lleva encendido el bot.',
    }
})
    .setCallback(async (_, message) => {
        const uptime = process.uptime();

        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const formatted = [
            days ? `${days}d` : null,
            hours ? `${hours}h` : null,
            minutes ? `${minutes}m` : null,
            `${seconds}s`
        ]
            .filter(Boolean)
            .join(' ');

        await sendResponse(
            `⏱️ *Bot's uptime:* ${formatted}`,
            message,
            {
                reaction: '⏱️',
            }
        );
    })
    .closeCommand();