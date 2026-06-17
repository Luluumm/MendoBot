export function isAdmin(phone: string): boolean {
    const adminPhone = process.env.ADMIN_PHONE;

    if (!adminPhone) {
        return false;
    }

    const normalize = (value: string) =>
        value.replace("@c.us", "").replace(/\D/g, "");

    return normalize(phone) === normalize(adminPhone);
}