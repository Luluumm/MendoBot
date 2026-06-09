import { Arrival, ArrivalsResponse, MetroStopInfo, MendotranBusesData, MendotranStopsData } from '../../ts/interfaces/mendotran.d.js';
import { fetchStopArrivals } from './fetchMendotran.js';
import { getTimeString } from '../../utils/getTimeString.js';
import { botLog, botLogError } from '../../utils/botLog.js';
import { MetroData } from '../../ts/types/mendotran.js';
import { CommandError } from '../commands/commands.js';
import { timeToEmoji } from './emojis.js';
import { ACTUAL_BBDD_VERSION } from '../../index.js';

// Base de datos de Mendotran
const MENDOTRAN_BUSES_DATABASE: MendotranBusesData = require(`../../../json/mendotran-buses.json`);
const MENDOTRAN_STOPS_DATABASE: MendotranStopsData = require(`../../../json/mendotran-stops.json`);
const MENDOTRAN_METRO_DATABASE: MetroData = require(`../../../json/metrotranvia.json`);
const CURRENT_BBDD_VERSION: any = require('../../../json/.bbdd-version.json');

// Verificar que la versión de la base de datos sea la esperada
if (CURRENT_BBDD_VERSION == undefined || CURRENT_BBDD_VERSION.VERSION == undefined) {
    botLogError(`No se encuentra el archivo "./json/.bbdd-version", es posible que tenga que regenerar la base de datos.\n`
    + `Ejecute "npm run refresh" para regenerar la base de datos.\n\n`
    + "Cerrando programa...");
    process.exit();
} else if (CURRENT_BBDD_VERSION.VERSION != ACTUAL_BBDD_VERSION) {
    botLogError(`Su versión de la base de datos no es compatible, `
	+ `ejecute "npm run refresh" para regenerar la base de datos.\n`
	+ `Versión esperada: ${ACTUAL_BBDD_VERSION}.\n`
	+ `Versión actual: ${CURRENT_BBDD_VERSION.VERSION}.\n\n`
    + "Cerrando programa...");
    process.exit();
}

/**
 * Ordenar la lista de arribos de colectivos según su proximidad.
 * @param {Arrival[]} arrivals - Lista de arribos.
 * @returns {Arrival[]} Lista ordenada
 */
function sortByArrivalTime(arrivals: Arrival[]): Arrival[] {
    if (arrivals.length === 1) {
        arrivals[0].arrivalTime = arrivals[0].predicted ? arrivals[0].predicted : arrivals[0].scheduled;
    } else {
        arrivals.sort((a: Arrival, b: Arrival) => {

            // Esto agrega la variable "arrivalTime".
            if (!a.arrivalTime) {
                a.arrivalTime = a.predicted ? a.predicted : a.scheduled;
            }

            if (!b.arrivalTime) {
                b.arrivalTime = b.predicted ? b.predicted : b.scheduled;
            }

            return a.arrivalTime - b.arrivalTime;
        });
    }
    return arrivals;
}

export function normalizeStopCode(stopNumber: string): string {
    if (!stopNumber.match(/^(M|m)+\d+$/i) && isNaN(+stopNumber)) {
        throw new CommandError(
            `"*${stopNumber}*" no es una parada. El formato ha de ser similar al siguiente:\n\n` +
            `\`M1234\` *o* \`1234\``
        );
    }

    let normalizedStopNumber = stopNumber.toUpperCase();
    if (!MENDOTRAN_STOPS_DATABASE[normalizedStopNumber]) {
        if (MENDOTRAN_STOPS_DATABASE["M" + normalizedStopNumber]) {
            normalizedStopNumber = "M" + normalizedStopNumber;
        } else if (MENDOTRAN_STOPS_DATABASE["L" + normalizedStopNumber]) {
            normalizedStopNumber = "L" + normalizedStopNumber;
        } else {
            throw new CommandError(`No existe la parada *${normalizedStopNumber}*.`);
        }
    }

    return normalizedStopNumber;
}

export interface NextArrivalInfo {
    stopCode: string;
    stopLocation: string | null;
    bus: string;
    serviceName: string;
    arrival: Arrival;
}

export async function getNextStopArrival(stopNumber: string, bus: string): Promise<NextArrivalInfo> {
    if (!MENDOTRAN_BUSES_DATABASE || !MENDOTRAN_STOPS_DATABASE) {
        throw new CommandError('No se ha podido cargar la base de datos de Mendotran.');
    }

    const stopCode = normalizeStopCode(stopNumber);
    botLog(`Buscando proximo arribo de la linea ${bus} en la parada "${stopCode}".`);

    if (!MENDOTRAN_STOPS_DATABASE[stopCode].bus_list.includes(bus)) {
        throw new CommandError(`El micro *${bus}* no pasa por la parada *${stopCode}*.`);
    }

    return await fetchStopArrivals(MENDOTRAN_STOPS_DATABASE[stopCode].stop_id).then((arrivalsResponse) => {
        if (!arrivalsResponse || arrivalsResponse.arrivals.length === 0) {
            throw new CommandError(`Sin arribos para el micro *${bus}* en la parada *${stopCode}*.`);
        }

        let serviceID: string | null = null;
        let serviceName = '';
        for (const key in arrivalsResponse.references.services) {
            if (arrivalsResponse.references.services[key].code === bus) {
                serviceID = key;
                serviceName = arrivalsResponse.references.services[key].name;
                break;
            }
        }

        if (serviceID === null) {
            throw new CommandError(`No se encontro informacion del micro *${bus}* para la parada *${stopCode}*.`);
        }

        const arrivals = sortByArrivalTime(arrivalsResponse.arrivals.filter((busInfo) => {
            return busInfo.service_id === Number(serviceID);
        }));

        if (arrivals.length === 0) {
            throw new CommandError(`Sin arribos para el micro *${bus}* en la parada *${stopCode}*.`);
        }

        return {
            stopCode,
            stopLocation: MENDOTRAN_STOPS_DATABASE[stopCode].location,
            bus,
            serviceName,
            arrival: arrivals[0],
        };
    }).catch((error) => {
        throw handleErrors(error);
    });
}

function distanceInMeters(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
    const earthRadius = 6371000;
    const dLat = (toLat - fromLat) * Math.PI / 180;
    const dLon = (toLon - fromLon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(fromLat * Math.PI / 180) * Math.cos(toLat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getNearestStopsText(latitude: number, longitude: number, limit: number = 15): string {
    const stopsWithCoordinates = Object.entries(MENDOTRAN_STOPS_DATABASE)
        .filter(([, stop]) => Array.isArray(stop.coordinates) && stop.coordinates.length >= 2);

    if (stopsWithCoordinates.length === 0) {
        throw new CommandError(
            'La base de datos local todavia no tiene coordenadas de paradas.\n\n' +
            'Ejecute `npm run refresh` para regenerarla con coordenadas y vuelva a enviar su ubicacion.'
        );
    }

    const nearestStops = stopsWithCoordinates
        .map(([code, stop]) => {
            const coordinates = stop.coordinates as [number, number];
            return {
                code,
                stop,
                distance: distanceInMeters(latitude, longitude, coordinates[1], coordinates[0]),
            };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

    let text = `*${nearestStops.length} paradas mas cercanas*\n\n`;
    nearestStops.forEach((nearestStop, index) => {
        const buses = [...new Set(nearestStop.stop.bus_list)].join(', ') || 'Sin micros cargados';
        text += `🚏 ${index + 1}. *${nearestStop.code}* - ${Math.round(nearestStop.distance)} m\n`;
        text += `> 📍 ${nearestStop.stop.location ?? 'Ubicacion sin nombre'}\n`;
        text += `> 🚌 Micros: ${buses}\n\n`;
    });

    return text.trim();
}

/**
 * La función recibe el objeto con la información de los arribos
 * y formatea las mismas en una cadena de texto que luego será
 * enviada al usuario.
 * @param {ArrivalsResponse} arrivalsResponse - Respuesta recibida por una solicitud al servidor de mendotran.
 * @param {number} limit - Límite de micros que se imprimirán. Por defecto 10.
 * @returns {string} Cadena de texto con los horarios ordenados por proximidad.
 */
export function arrivalsToString(arrivalsResponse: ArrivalsResponse, limit: number = 10): string {
    let text = "";
    if (arrivalsResponse.arrivals !== undefined && arrivalsResponse.arrivals.length > 0 && arrivalsResponse.references !== undefined) {
        // Ordenar lista por orden de llegada
        arrivalsResponse.arrivals = sortByArrivalTime(arrivalsResponse.arrivals);

        // Esto guarda cual fue el último arribo en ser formateado.
        let lastServiceID: number = 0;

        for (let i = 0; i < limit && i < arrivalsResponse.arrivals.length; i++) {
            const arrival = arrivalsResponse.arrivals[i];

            // De acá sacamos información como el letrero del micro.
            const referencia = arrivalsResponse.references.services[arrival.service_id];

            if (referencia == undefined) {
                botLogError("No se pudo encontrar información sobre el colectivo.")
                continue;
            }
            // Si el micro actual es el mismo que el anterior, se evitará imprimir el letrero nuevamente.
            if (arrival.service_id != lastServiceID) {
                // Letrero
                let color = MENDOTRAN_BUSES_DATABASE[`${referencia.code}`].color;
                let letrero = referencia.name;
                letrero = letrero.trim()
                                .replaceAll(/\s\s+/g, ' ')                // Borrar doble espacios.
                                .replaceAll(/(\s|\b)(-|–)(\s|\b)/g, ', ') // Remplazar guiones por comas.
                                .toUpperCase();

                // TODO: Revisar. No sé qué hace esto.
                if (letrero.charAt(letrero.length).match(/\W/i)) {
                    letrero = letrero.slice(0, letrero.length);
                }

                if (text.length > 0) text += '\n\n';

                text += `${color} *${referencia.code} - ${letrero}* ${color}\n\n`;
            } else {
                text += '\n\n';
            }
            lastServiceID = arrival.service_id;

            // Horarios
            text += `> ${timeToEmoji(arrival.arrivalTime)} ${getTimeString(arrival.arrivalTime, true, true)} hs`;

            const minutesLeft = Math.floor((arrival.arrivalTime - Date.now()) / 60000);
            if (minutesLeft > 0) {
                // Indicar cuantos minutos y/o horas faltan.
                if (minutesLeft >= 60) {
                    const hours = Math.trunc(minutesLeft / 60);
                    text += `\n> ⏳ En ${hours} hora${hours > 1 ? 's' : ''} `;

                    const minutes = minutesLeft % 60;
                    if (minutes) {
                        text += `y ${minutes} minuto${minutes > 1 ? 's' : ''} `;
                    }

                    // Emojis expresivos
                    if (minutesLeft < 90) {
                        text += `😩`;
                    } else if (minutesLeft < 120) {
                        text += `😭`;
                    } else {
                        text += `💀`;
                    }

                } else {
                    text += `\n> ⏳ En ${minutesLeft} minuto${minutesLeft > 1 ? 's' : ''}`;
                }

                if (arrival.predicted) {
                    const delay = Math.floor((arrival.scheduled - arrival.predicted) / 60000);

                    // Retraso
                    if (delay === 0) {
                        text += `\n> 🟢 A tiempo`;
                    } else if (delay > 0) {
                        text += `\n> 🔴 ${delay} minuto${delay > 1 ? 's' : ''} antes`;
                    } else if (delay < 0) {
                        text += `\n> 🔵 ${Math.abs(delay)} minuto${delay < -1 ? 's' : ''} tarde`;
                        if (delay <= -10 && delay > -15) { text += ' 😬'; }
                        if (delay <= -15 && delay > -20) { text += '... Aún hay esperanzas 🫠'; }
                        if (delay <= -20) { text += '... Quizá deba buscar una alternativa 🫥'; }
                    }
                } else {
                    // Horario planificado
                    text += `\n> ⚫ Planificada`;
                }
            } else {
                text += `\n> 🚍 *Arribando*`;
            }
        }
    }
    return text;
}

/**
 * Busca los horarios de una parada de colectivos, opcionalmente los filtra.
 * @param {string} stopNumber - Número de la parada.
 * @param {string} bus - Opcional: Indica una linea de colectivo para ser filtrada.
 * @returns {Promise<string>} Cadena de texto con los horarios ordenados por proximidad.
 */
export async function getStopArrivals(stopNumber: string, bus?: string): Promise<string> {
    if (!MENDOTRAN_BUSES_DATABASE || !MENDOTRAN_STOPS_DATABASE) {
        throw new CommandError('No se ha podido cargar la base de datos de Mendotran.');
    }

    if (!stopNumber.match(/^(M|m)+\d+$/i) && isNaN(+stopNumber)) {
        throw new CommandError(
            `"*${stopNumber}*" no es una parada. El formato ha de ser similar al siguiente:\n\n` +
            `\`M1234\` *ó* \`1234\` 🤓`
        );
    }
    
    stopNumber = stopNumber.toUpperCase();
    botLog(`Buscando parada "${stopNumber}".`);
    if (!MENDOTRAN_STOPS_DATABASE[stopNumber]) {
        if (MENDOTRAN_STOPS_DATABASE["M" + stopNumber]) {
            stopNumber = "M" + stopNumber;
        } else if (MENDOTRAN_STOPS_DATABASE["L" + stopNumber]) {
            stopNumber = "L" + stopNumber;
        } else {
            throw new CommandError(`No existe la parada *${stopNumber}*.`);
        }
    }
    
    if (bus) {
        botLog(`Buscando línea ${bus} en la parada "${stopNumber}".`);
        if (!MENDOTRAN_STOPS_DATABASE[stopNumber].bus_list.includes(bus)) {
            throw new CommandError(`El micro *${bus}* no pasa por la parada *${stopNumber}*.`);
        }
    }

    return await fetchStopArrivals(MENDOTRAN_STOPS_DATABASE[stopNumber].stop_id).then((arrivalsResponse) => {
        // Verificar que hayan arribos para la parada.
        if (!arrivalsResponse || arrivalsResponse.arrivals.length === 0) {
            return `🚎 Sin arribos para la parada *${stopNumber}* 🏃‍♀️`;
        }

        // Filtrar por colectivo.
        if (bus) {
            let filtroExitoso = false;
            // Debemos buscar el ID del servicio.
            for (const key in arrivalsResponse.references.services) {
                if (arrivalsResponse.references.services[key].code != bus) {
                    continue;
                }
                const serviceID = key;
                filtroExitoso = true;

                arrivalsResponse.arrivals = arrivalsResponse.arrivals.filter((busInfo) => {
                    return busInfo.service_id === Number(serviceID);
                });

                if (arrivalsResponse.arrivals.length === 0) {
                    return `🚎 Sin arribos para el micro *${bus}* en la parada *${stopNumber}* 🏃‍♀️`;
                }
            }

            // Si por algún motivo el filtro falla, tirar error.
            if (filtroExitoso === false) {
                throw new CommandError(`Ocurrió un error al intentar filtrar los micros de la parada. Si el problema persiste, pruebe con el comando:\n\n\`Parada ${stopNumber}\``);
            }
        }

        // String
        let text = `🚦 *Parada ${stopNumber}${bus ? ' - Línea ' + bus : ''}* 🚦\n\n`
                    + arrivalsToString(arrivalsResponse, bus ? 5 : 10)
                    + `\n\n> 📍 *${MENDOTRAN_STOPS_DATABASE[stopNumber].location}* 📍`;

        return text;
    }).catch((error) => {
        throw handleErrors(error);
    });
}

/**
 * Buscar los horarios de una estación de metro.
 * @param {string} stopName - Nombre de la estación.
 * @returns {Promise<string>} Cadena de texto con los horarios del metro-tranvía.
 */
export async function getMetroArrivals(stopName: string): Promise<string> {
    return await searchMetroStop(stopName)
        .then(async (stop: MetroStopInfo) => {
            const metro100Arrivals = await fetchStopArrivals(MENDOTRAN_STOPS_DATABASE[stop["100"]].stop_id);
            const metro101Arrivals = await fetchStopArrivals(MENDOTRAN_STOPS_DATABASE[stop["101"]].stop_id);

            metro100Arrivals.arrivals = sortByArrivalTime(metro100Arrivals.arrivals);
            metro101Arrivals.arrivals = sortByArrivalTime(metro101Arrivals.arrivals);

            // Limitar número de arribos que se muestran.
            const arrivalsLimit = 3;
            const metro100Restantes = metro100Arrivals.arrivals.length - arrivalsLimit;
            const metro101Restantes = metro101Arrivals.arrivals.length - arrivalsLimit;

            metro100Arrivals.arrivals.splice(arrivalsLimit);
            metro101Arrivals.arrivals.splice(arrivalsLimit);

            if (metro100Arrivals.arrivals.length > 0 || metro101Arrivals.arrivals.length > 0) {
                let text = `🚦 *Estación ${Array.isArray(stop.name) ? stop.name.join(' / ') : stop.name}* 🚦\n\n`
                        + (metro100Arrivals.arrivals.length > 0 ? arrivalsToString(metro100Arrivals) : `🚋 *Sin arribos para el andén ${stop.direction[0]}* 🏃‍♀️`)
                        + (metro100Restantes > 0 ? `\n\n> 🚏 *${metro100Restantes} más en camino*` : '')
                        + '\n\n'
                        + (metro101Arrivals.arrivals.length > 0 ? arrivalsToString(metro101Arrivals) : `🚋 *Sin arribos para el andén ${stop.direction[1]}* 🏃‍♀️`)
                        + (metro101Restantes > 0 ? `\n\n> 🚏 *${metro101Restantes} más en camino*` : '')
                        + `\n\n> 📍 *${MENDOTRAN_STOPS_DATABASE[stop["100"]].location}* 📍`;
                return text;
            } else {
                return `🚋 Sin arribos para la estación 🏃‍♀️`;
            }
        })
        .catch((error) => {
            throw handleErrors(error);
        });
}

/**
 * Busca información de una estación de metro-tranvía en la base de datos. Esta función
 * iterará sobre cada posible nombre de estación ya que hay paradas con hasta 2 formas
 * de ser llamadas. Por ejemplo: "Pedro Molina / UTN".
 * @param {string} stopName - Nombre de la estación.
 * @returns {Promise<MetroStopInfo>}
 */
async function searchMetroStop(stopName: string): Promise<MetroStopInfo> {
    if (!MENDOTRAN_METRO_DATABASE || !MENDOTRAN_STOPS_DATABASE) {
        throw new CommandError('No se ha podido cargar la base de datos de Mendotran.');
    }

    // Ignorar tildes
    stopName = stopName.replaceAll(/á/gi, 'a')
                       .replaceAll(/é/gi, 'e')
                       .replaceAll(/í/gi, 'i')
                       .replaceAll(/ó/gi, 'o')
                       .replaceAll(/ú/gi, 'u');

    // Buscar estación
    for (const estacion of MENDOTRAN_METRO_DATABASE) {
        if (estacion.name) {
            if (Array.isArray(estacion.name)) {
                if (estacion.name.some((stationName) => stationName.search(new RegExp(stopName, 'i')) >= 0)) {
                    return estacion;
                }
            } else {
                if (estacion.name.search(new RegExp(stopName, 'i')) >= 0) {
                    return estacion;
                }
            }
        }
    }

    throw new CommandError(`No se ha encontrado la estación *"${stopName}"*.`);
}

function handleErrors(error: Error | CommandError): string | CommandError {
    if (error instanceof CommandError) {
        throw error;
    }

    console.error('\n', error, '\n');
    if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
            throw new CommandError(
                'La petición tardó demasiado en responder. Esto puede deberse a una baja en la velocidad del servidor.\n\n*Por favor, vuelva a intentarlo.*\n\n🐌 🦥'
            );
        } else {
            throw new CommandError(
                `Ha ocurrido un error al procesar la petición, "*${error.name}*".\n\n*Por favor, vuelva a intentarlo.*\n\n🤖`
            );
        }
    }
    throw new CommandError('Ha ocurrido un error desconocido.\n\n*Por favor, vuelva a intentarlo.*\n\n😅');
}
