import { BusColor } from "../../ts/types/mendotran";
export const METRO_EMOJI: BusColor = '🚉';

export const BUS_COLOR_LIST: readonly BusColor[] = [
    '🔲',
    '🟥',
    '⬜',
    '🟩',
    '🟨',
    '🟧',
    '🟦',
    '🟦',
    '🟪',
    '🟫',
];

export const EMOJI_TIME: readonly string[][] = [
    ['🕛', '🕧'],
    ['🕐', '🕜'],
    ['🕑', '🕝'],
    ['🕒', '🕞'],
    ['🕓', '🕟'],
    ['🕔', '🕠'],
    ['🕕', '🕡'],
    ['🕖', '🕢'],
    ['🕗', '🕣'],
    ['🕘', '🕤'],
    ['🕙', '🕥'],
    ['🕚', '🕦'],
];

export function getBusColor(linea: string): BusColor {
    if (+linea >= 100 && +linea < 1000) {
        if (linea == '100' || linea == '101') {
            return METRO_EMOJI;
        } else {
            return BUS_COLOR_LIST[+String(+linea).charAt(0)];
        }
    } else {
        return BUS_COLOR_LIST[0];
    }
}

export function timeToEmoji(unixTime: number): string {
    const time: Date = new Date(unixTime);
    const minutes: number = time.getMinutes();
    const hours: number = time.getHours() % 12;
    
    return (EMOJI_TIME[hours][Math.round(minutes / 60)]);
}