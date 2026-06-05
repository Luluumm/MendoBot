import fs from 'node:fs';
import path from 'node:path';

interface SavedStopsData {
    [owner: string]: {
        [alias: string]: string;
    };
}

const SAVED_STOPS_PATH = path.resolve('./json/saved-stops.json');

function readSavedStops(): SavedStopsData {
    if (!fs.existsSync(SAVED_STOPS_PATH)) { return {}; }

    try {
        return JSON.parse(fs.readFileSync(SAVED_STOPS_PATH, 'utf8')) as SavedStopsData;
    } catch {
        return {};
    }
}

function writeSavedStops(data: SavedStopsData): void {
    fs.mkdirSync(path.dirname(SAVED_STOPS_PATH), { recursive: true });
    fs.writeFileSync(SAVED_STOPS_PATH, JSON.stringify(data, null, 4));
}

function normalizeAlias(alias: string): string {
    return alias.trim().replaceAll(/\s+/g, ' ').toUpperCase();
}

export function saveStopAlias(owner: string, alias: string, stopCode: string): void {
    const normalizedAlias = normalizeAlias(alias);
    const normalizedStopCode = stopCode.trim().toUpperCase();

    const data = readSavedStops();
    data[owner] = data[owner] ?? {};
    data[owner][normalizedAlias] = normalizedStopCode;
    writeSavedStops(data);
}

export function getSavedStopAlias(owner: string, alias: string): string | null {
    const data = readSavedStops();
    return data[owner]?.[normalizeAlias(alias)] ?? null;
}

export function listSavedStopAliases(owner: string): Array<{ alias: string; stopCode: string }> {
    const userStops = readSavedStops()[owner] ?? {};
    return Object.entries(userStops).map(([alias, stopCode]) => ({ alias, stopCode }));
}
