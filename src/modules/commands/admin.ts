const ADMIN_PHONE = process.env.ADMIN_PHONE;

export function isAdmin(sender: string): boolean {
    const phone = sender
        .replace('@s.whatsapp.net', '')
        .replace('@lid', '');

    return phone === ADMIN_PHONE;
}