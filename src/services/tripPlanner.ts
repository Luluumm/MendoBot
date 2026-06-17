import fetch from "node-fetch";

const API = "https://owa.visionblo.com/api/mendoza/plan";

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
    const response = await fetch(API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            token,
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
        })
    });

    if (!response.ok) {
        throw new Error(
            `Trip planner API returned ${response.status}`
        );
    }

    return await response.json() as TripPlannerResponse;
}