import fetch from "node-fetch";

const API = "https://owa.visionblo.com/api/mendoza/plan";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0",
    "Accept": "*/*",
    "Accept-Language": "es-AR,es;q=0.8,en-US;q=0.5,en;q=0.3",
    "Content-Type": "application/json",
    "Origin": "https://owa.visionblo.com",
    "Referer": "https://owa.visionblo.com/web/mendoza/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Pragma": "no-cache",
    "Cache-Control": "no-cache"
};

export interface TripPlannerResponse {
    plan: TripOption[];
}

export interface TripOption {
    legs: TripLeg[];
}

export interface TripLeg {
    mode: "walk" | "bus";
    instructions?: {
        text: string;
    }[];

    service?: {
        code: string;
        name: string;
        color: string;
    };

    departure?: {
        predicted?: number;
    };

    arrival?: {
        predicted?: number;
    };
}

export async function planTrip(
    originLat: number,
    originLng: number,
    destinationLat: number,
    destinationLng: number,
    token: string,
    xss: string
): Promise<TripPlannerResponse> {
    const body = {
        token,
        text: "",
        xss,
        criteria: "departure",
        timestamp: Date.now(),
        source: {
            coordinates: [
                originLng,
                originLat
            ]
        },
        destination: {
            coordinates: [
                destinationLng,
                destinationLat
            ]
        }
    };

    const response = await fetch(API, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
            `Trip planner API returned ${response.status}: ${text}`
        );
    }

    return await response.json() as TripPlannerResponse;
}
