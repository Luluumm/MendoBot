import { MendotranStopsData } from "../ts/interfaces/mendotran";

const MENDOTRAN_STOPS_DATABASE: MendotranStopsData = require("../../json/mendotran-stops.json");

function normalize(text: string): string {
    return text.toLowerCase()
        .replace(/[áäàâ]/g, "a")
        .replace(/[éëèê]/g, "e")
        .replace(/[íïìî]/g, "i")
        .replace(/[óöòô]/g, "o")
        .replace(/[úüùû]/g, "u");
}

export interface ResolvedDestination {
    lat: number;
    lng: number;
    label: string;
    stopCode: string;
}

export function resolveDestination(query: string): ResolvedDestination | null {
    const normalized = normalize(query);
    const candidates: { code: string; label: string; lat: number; lng: number; score: number }[] = [];

    for (const [code, stop] of Object.entries(MENDOTRAN_STOPS_DATABASE)) {
        if (!stop.coordinates || stop.coordinates.length < 2) continue;
        const loc = stop.location ?? "";
        const locNorm = normalize(loc);

        const idx = locNorm.indexOf(normalized);
        if (idx === -1) continue;

        const score = loc.length - normalized.length + (idx === 0 ? 100 : 0);
        candidates.push({
            code,
            label: loc,
            lat: stop.coordinates[1],
            lng: stop.coordinates[0],
            score,
        });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);

    return {
        lat: candidates[0].lat,
        lng: candidates[0].lng,
        label: candidates[0].label,
        stopCode: candidates[0].code,
    };
}
