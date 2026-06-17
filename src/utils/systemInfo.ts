import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function getSystemInfo() {
    const hostname = os.hostname();

    const { stdout: osInfo } = await execAsync(
        "grep PRETTY_NAME /etc/os-release"
    );

    const { stdout: tempInfo } = await execAsync(
        "sensors package_thermal-virtual-0"
    );

    const osName =
        osInfo.match(/PRETTY_NAME="(.+)"/)?.[1]
        ?? 'Unknown Linux';

    const cpuTemp =
        tempInfo.match(/\+?([0-9.]+)°C/)?.[1]
        ?? 'Unknown';

    const uptime = os.uptime();

    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    return {
        hostname,
        osName,
        cpuTemp,
        uptimeText: `${days}d ${hours}h ${minutes}m`
    };
}