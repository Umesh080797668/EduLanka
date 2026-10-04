// =============================================================================
// EduLanka — Chat & SMS Queue Concurrent Load Test
// =============================================================================
// Simulates peak emergency school closure or broadcast event where:
// 1. High-volume parent/student chat activity spikes
// 2. An emergency or urgent SMS broadcast queue blast is triggered simultaneously
// 3. Verifies that Redis rate limiting, BullMQ queueing, and quota reservations
//    remain non-blocking, isolated, and resilient under concurrent load.
//
// RUN:
//   k6 run infrastructure/tests/chat-sms-load.js
// =============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

import { BASE_URL, CREDENTIALS, scaled } from './config.js';
import { loginAs } from './auth.js';
import { get, post, safeJson } from './http.js';

export const chatLatency = new Trend('chat_message_latency', true);
export const smsDispatchLatency = new Trend('sms_dispatch_latency', true);
export const rateLimitCounter = new Counter('chat_rate_limits_provoked');
export const concurrencyErrors = new Rate('load_concurrency_errors');

http.setResponseCallback(http.expectedStatuses(200, 201, 204, 400, 403, 404, 429));

export const options = {
    scenarios: {
        // High-frequency chat traffic from teachers and parents
        chat_stream: {
            executor: 'ramping-vus',
            startVUs: 2,
            stages: [
                { duration: '15s', target: scaled(10) },
                { duration: '30s', target: scaled(20) },
                { duration: '15s', target: 0 },
            ],
            exec: 'chatFlow',
        },
        // Simultaneous SMS queue dispatch blasts from school administration
        sms_blast: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '15s', target: scaled(4) },
                { duration: '30s', target: scaled(6) },
                { duration: '15s', target: 0 },
            ],
            exec: 'smsBlastFlow',
        },
    },
    thresholds: {
        load_concurrency_errors: ['rate<0.05'], // Max 5% unexpected transport failure
        chat_message_latency: ['p(95)<800'],   // 95% of chat writes under 800ms
        sms_dispatch_latency: ['p(95)<1500'],  // 95% of queue dispatches under 1500ms
    },
};

export function setup() {
    console.log('[Setup] Logging in pilot roles for Chat & SMS load test...');
    const adminSession = loginAs(CREDENTIALS.SCHOOL_ADMIN);
    const teacherSession = loginAs(CREDENTIALS.TEACHER);
    const parentSession = loginAs(CREDENTIALS.PARENT);

    // Fetch conversation thread or create one between teacher and parent
    let conversationId = null;
    const convListRes = get('/chat/conversations', teacherSession, {
        name: 'load_chat_get_conversations',
        expectedStatuses: [200, 404],
    });
    const convs = safeJson(convListRes);
    if (Array.isArray(convs) && convs.length > 0) {
        conversationId = convs[0].id;
    }

    return {
        adminSession,
        teacherSession,
        parentSession,
        conversationId,
    };
}

/**
 * Scenario 1: Concurrent Chat messaging, history polling, and rate-limit provocation.
 */
export function chatFlow(data) {
    const session = Math.random() > 0.5 ? data.teacherSession : data.parentSession;
    const convId = data.conversationId;

    if (!convId) {
        // Poll conversation inbox if no shared thread ID was pre-seeded
        const inboxRes = get('/chat/conversations', session, {
            name: 'chat_list_inbox',
            expectedStatuses: [200, 404],
        });
        check(inboxRes, { 'chat inbox response OK': (r) => r.status === 200 || r.status === 404 });
        sleep(0.5);
        return;
    }

    // 1. Fetch recent conversation messages
    const histRes = get(`/chat/conversations/${convId}/messages?limit=15`, session, {
        name: 'chat_get_messages',
        expectedStatuses: [200, 403, 404],
    });
    chatLatency.add(histRes.timings.duration);

    // 2. Dispatch rapid message to exercise atomic Redis rate limiter
    const msgRes = post(`/chat/conversations/${convId}/messages`, session, {
        content: `Load test message VU=${__VU} ITER=${__ITER} ts=${Date.now()}`,
    }, {
        name: 'chat_send_message',
        expectedStatuses: [201, 400, 403, 429],
    });
    chatLatency.add(msgRes.timings.duration);

    if (msgRes.status === 429) {
        rateLimitCounter.add(1);
    } else if (msgRes.status >= 500) {
        concurrencyErrors.add(1);
    }

    sleep(0.3 + Math.random() * 0.4);
}

/**
 * Scenario 2: Concurrent SMS dispatch and quota reservation exercising BullMQ queue.
 */
export function smsBlastFlow(data) {
    const session = data.adminSession;
    const testRecipients = [
        `+9477100${String(__VU).padStart(2, '0')}${String(__ITER % 100).padStart(2, '0')}`,
        `+9477200${String(__VU).padStart(2, '0')}${String(__ITER % 100).padStart(2, '0')}`,
    ];

    // 1. Check current SMS Quota state
    get('/sms/quotas', session, {
        name: 'sms_get_quota',
        expectedStatuses: [200, 403, 404],
    });

    // 2. Dispatch batch SMS through the Redis reservation lifecycle
    const blastRes = post('/sms/send-bulk', session, {
        recipients: testRecipients,
        message: `[EduLanka Emergency Alert] High-concurrency queue test from VU ${__VU}.`,
        isSafetyCritical: false,
    }, {
        name: 'sms_dispatch_bulk',
        expectedStatuses: [200, 201, 400, 403, 429],
    });
    smsDispatchLatency.add(blastRes.timings.duration);

    if (blastRes.status >= 500) {
        concurrencyErrors.add(1);
    }

    sleep(1.0 + Math.random() * 0.5);
}
