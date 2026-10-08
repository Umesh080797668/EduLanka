/**
 * EduLanka — FCM HTTP v1 High-Priority Data Push Sender
 *
 * Sends a real data-only message to test delivery across Foreground,
 * Background, and Swiped-Away/Killed app lifecycle states.
 *
 * Usage:
 *   npx ts-node scripts/send-fcm-message.ts <TARGET_FCM_TOKEN> [TENANT_ID]
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    const token = process.argv[2] || process.env.TARGET_FCM_TOKEN;
    const tenantId = process.argv[3] || '45f9722b-eda0-453f-88d2-2c9ad06ec169';

    if (!token) {
        console.error('Usage: ts-node scripts/send-fcm-message.ts <FCM_TOKEN> [TENANT_ID]');
        console.error('Or set TARGET_FCM_TOKEN in environment.');
        process.exit(1);
    }

    // Initialize Firebase Admin
    if (getApps().length === 0) {
        const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (saJson) {
            const sa = JSON.parse(saJson);
            initializeApp({ credential: cert(sa) });
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            initializeApp();
        } else {
            console.error('Error: Please provide FIREBASE_SERVICE_ACCOUNT JSON or GOOGLE_APPLICATION_CREDENTIALS path in .env');
            process.exit(1);
        }
    }

    const payload = {
        token,
        android: {
            priority: 'high' as const,
        },
        data: {
            type: 'DISASTER_MODE_ACTIVATED',
            tenant_id: tenantId,
            reason: 'CYCLONE_WARNING',
            expected_duration: '5_DAYS',
            timestamp: Date.now().toString(),
        },
    };

    console.log(`Sending high-priority data message to token: ${token.substring(0, 15)}...`);
    try {
        const messaging = getMessaging();
        const messageId = await messaging.send(payload);
        console.log(`✅ FCM Message successfully delivered to Firebase gateway: ${messageId}`);
    } catch (error: any) {
        console.error(`❌ FCM dispatch failed:`, error.message);
        process.exit(1);
    }
}

main();
