/**
 * DiscordLogger — Webhook-based crash/event logging
 *
 * Ported from digital-sign/app/player/page.tsx sendDiscordLog()
 */

import Config from 'react-native-config';

// Throttle: prevent spam during error loops
let lastSendTime = 0;
const MIN_INTERVAL_MS = 5000; // 5 seconds between sends

interface DeviceInfo {
    name: string;
    code: string;
    id: string;
}

let deviceInfo: DeviceInfo = { name: 'Unknown', code: 'N/A', id: 'No ID' };

/**
 * Set device info for all future log messages.
 */
export function setDeviceInfo(info: DeviceInfo): void {
    deviceInfo = info;
}

/**
 * Send a Discord embed log.
 *
 * @param title - Embed title (e.g. "❌ Player Error")
 * @param description - Embed description
 * @param color - Embed color as decimal integer
 *   - Red: 15548997
 *   - Orange: 16744192
 *   - Yellow: 16776960
 *   - Green: 5763719
 *   - Blue: 3447003
 *   - Gray: 9807270
 */
export async function sendDiscordLog(
    title: string,
    description: string,
    color: number,
): Promise<void> {
    const webhookUrl = Config.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    // Throttle
    const now = Date.now();
    if (now - lastSendTime < MIN_INTERVAL_MS) return;
    lastSendTime = now;

    try {
        const payload = {
            embeds: [
                {
                    title,
                    description: `${description}\n**Device:** ${deviceInfo.name} | **Code:** ${deviceInfo.code} | **ID:** ${deviceInfo.id}`,
                    color,
                    timestamp: new Date().toISOString(),
                },
            ],
        };

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch {
        // Logging is best-effort; never crash the app for it
    }
}
