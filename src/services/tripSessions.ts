export type TripSessionState = "awaiting_location" | "awaiting_destination";

export interface TripSession {
    state: TripSessionState;
    originLat?: number;
    originLng?: number;
    readyAt: number;
}

const sessions = new Map<string, TripSession>();

export function createTripSession(userId: string) {
    sessions.set(userId, { state: "awaiting_location", readyAt: 0 });
}

export function setTripOrigin(userId: string, lat: number, lng: number) {
    const session = sessions.get(userId);
    if (!session) return;
    session.originLat = lat;
    session.originLng = lng;
    session.state = "awaiting_destination";
    session.readyAt = Date.now() + 2000;
}

export function getTripSession(userId: string) {
    return sessions.get(userId);
}

export function clearTripSession(userId: string) {
    sessions.delete(userId);
}
