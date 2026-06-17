export function isAdmin(phone: string): boolean {
    const adminPhone = process.env.ADMIN_PHONE;

    console.log("================================");
    console.log("PHONE RECEIVED:", phone);
    console.log("ADMIN FROM ENV:", adminPhone);

    const normalize = (value: string) =>
        value.replace("@c.us", "").replace("@g.us", "").replace(/\D/g, "");

    console.log("PHONE NORMALIZED:", normalize(phone));
    console.log("ADMIN NORMALIZED:", normalize(adminPhone ?? ""));

    const result = normalize(phone) === normalize(adminPhone ?? "");

    console.log("IS ADMIN:", result);
    console.log("================================");

    return result;
}