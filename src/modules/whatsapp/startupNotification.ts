import fs from 'fs';

import { sendAdminMessage } from './messageSending.js';

import { getSystemInfo } from '../../utils/systemInfo.js';
import { getNgrokTunnel } from '../../utils/ngrok.js';

const BOOT_FILE = '/tmp/mendobot-startup-sent';

export async function sendStartupNotification() {

    if (fs.existsSync(BOOT_FILE)) {
        return;
    }

    fs.writeFileSync(
        BOOT_FILE,
        Date.now().toString()
    );

    const info = await getSystemInfo();

    const tunnel =
        await getNgrokTunnel()
        ?? 'Tunnel not available';

    await sendAdminMessage(
`🟢 MendoBot Online

🏷️ Device: ${info.hostname}
🐧 OS: ${info.osName}
🌡️ CPU: ${info.cpuTemp}°C
⏱️ Uptime: ${info.uptimeText}

🔐 SSH:
${tunnel}`
    );
}