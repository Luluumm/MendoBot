export function isAdmin(id: string): boolean {
    const adminId = process.env.ADMIN_ID;

    if (!adminId) {
        return false;
    }

    return id === adminId;
}