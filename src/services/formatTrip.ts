import { TripOption } from "./tripPlanner";

function parseWalkDistance(text: string): string {
    const match = text.match(/(\d+)\s*m/);
    return match ? `${match[1]} m` : "";
}

function formatDuration(ms: number): string {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes} minutos`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatTrip(
    trip: TripOption
): string {
    const lines: string[] = [];
    let totalDuration = 0;
    let totalWalk = 0;

    for (const leg of trip.legs) {
        if (leg.arrival?.predicted && leg.departure?.predicted) {
            totalDuration += leg.arrival.predicted - leg.departure.predicted;
        }

        if (leg.mode === "walk") {
            const instrText = leg.instructions?.[0]?.text ?? "";
            const dist = parseWalkDistance(instrText);
            totalWalk += parseInt(dist) || 0;
            lines.push(`> 🚶 Caminá ${dist || "unos metros"}`);
            continue;
        }

        if (leg.mode === "bus" && leg.service) {
            const board = leg.instructions?.find(i => i.text.startsWith("Toma"));
            const leave = leg.instructions?.find(i => i.text.startsWith("Desciende"));

            lines.push(`>  *🚌 Línea ${leg.service.code}*`);

            if (board) {
                lines.push(`>  ➡️ ${board.text}`);
            }
            if (leave) {
                lines.push(`>  📍 ${leave.text}`);
            }
        }
    }

    const result: string[] = [];
    result.push("🚌 *Mejor recorrido*");
    result.push("");

    if (totalWalk > 0) {
        result.push(`> 🚶 Caminata total: ~${totalWalk} m`);
    }
    if (totalDuration > 0) {
        result.push(`> ⏱️ Duración: ${formatDuration(totalDuration)}`);
    }
    result.push("");

    for (const line of lines) {
        result.push(line);
    }

    return result.join("\n");
}
