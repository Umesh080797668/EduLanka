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
        content_html: "<p>Testing concurrent notice bursts.</p>",
        scope: "SCHOOL_WIDE",
        send_sms: true,
    });

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${__ENV.SUPER_ADMIN_TOKEN_MOCK}`
    };

    // 1. Check active platform maintenance notice endpoint
    const mRes = http.get(`${BASE_URL}/notices/maintenance/active`, { headers });
    check(mRes, {
        'maintenance notices responded': (r) => r.status === 200 || r.status === 304,
    });

    // 2. Mint chat socket ticket (simulating live client connecting)
    const ticketRes = http.get(`${BASE_URL}/chat/socket-ticket`, { headers });
    check(ticketRes, {
        'socket ticket responded': (r) => r.status === 200 || r.status === 401 || r.status === 403,
    });

    // 3. Hammer Fastify API aggressively with broadcast
    const res = http.post(`${BASE_URL}/notices/broadcast`, payload, { headers });

    check(res, {
        'status is 200/201, 401/403 or 429 Throttle': (r) => r.status === 200 || r.status === 201 || r.status === 401 || r.status === 403 || r.status === 429,
    });

    // 4. Sample random Websocket Handshakes mirroring client storms
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
