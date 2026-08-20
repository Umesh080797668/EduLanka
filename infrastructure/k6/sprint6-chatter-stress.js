import http from 'k6/http';
import { check, sleep } from 'k6';
import ws from 'k6/ws';

export const options = {
    stages: [
        { duration: '30s', target: 500 }, // Ramping up concurrently simulating chaotic emergency dispatches
        { duration: '1m', target: 1000 },
        { duration: '30s', target: 0 },
    ],
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api/v1';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';

export default function () {
    const payload = JSON.stringify({
        title: "Disaster Impending",
        content: "Testing concurrent notice bursts.",
        send_sms: true,
    });

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${__ENV.SUPER_ADMIN_TOKEN_MOCK}`
    };

    // 1. Hammer Fastify API aggressively
    const res = http.post(`${BASE_URL}/notices/broadcast`, payload, { headers });

    check(res, {
        'status is 200/201 or 429 Throttle': (r) => r.status === 201 || r.status === 429,
    });

    // 2. Sample random Websocket Handshakes mirroring client storms
    if (Math.random() > 0.5) {
        const socketRes = ws.connect(`${WS_URL}`, { headers }, function (socket) {
            socket.on('open', () => {
                socket.send(JSON.stringify({ event: 'ping' }));
            });
            setTimeout(() => socket.close(), 1000);
        });

        check(socketRes, { 'status is 101': (r) => r && r.status === 101 });
    }

    sleep(1);
}
