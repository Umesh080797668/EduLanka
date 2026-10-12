import request from 'supertest';

describe('Production Infrastructure (e2e)', () => {
    // Docker Nginx gateway runs on 8081 locally
    const GATEWAY_URL = process.env['GATEWAY_URL'] || 'http://localhost:8081';
    let isGatewayReachable = false;

    beforeAll(async () => {
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500));
            await Promise.race([
                request(GATEWAY_URL).get('/api/v1/health'),
                timeoutPromise,
            ]);
            isGatewayReachable = true;
        } catch {
            isGatewayReachable = false;
        }
    });

    describe('CORS Handling', () => {
        it('should allow cross-origin requests from explicitly allowed origins (preflight)', async () => {
            if (!isGatewayReachable) {
                console.warn('Skipping gateway CORS check: Nginx gateway not running locally on ' + GATEWAY_URL);
                return;
            }

            const res = await request(GATEWAY_URL)
                .options('/api/v1/health')
                .set('Origin', 'http://localhost:3000') // Development frontend origin
                .set('Access-Control-Request-Method', 'GET');

            expect(res.status).toBe(204);
            expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
            expect(res.headers['access-control-allow-methods']).toContain('GET');
        });

        it('should strip standard response body from OPTIONS requests', async () => {
            if (!isGatewayReachable) return;

            const res = await request(GATEWAY_URL)
                .options('/api/v1/health')
                .set('Origin', 'http://localhost:3000')
                .set('Access-Control-Request-Method', 'GET');

            expect(res.text).toBe('');
        });
    });

    describe('Nginx Rate Limiting', () => {
        // Nginx configuration: limit_req_zone $binary_remote_addr zone=api_auth:10m rate=5r/m; burst=3 nodelay;
        it('should trigger 429 Too Many Requests on /auth/ burst threshold', async () => {
            if (!isGatewayReachable) return;

            let status429Count = 0;
            const requests = [];

            // Burst is 3, rate is 5/min. Sending 10 rapid requests should definitely trigger a 429 limit.
            for (let i = 0; i < 10; i++) {
                requests.push(
                    request(GATEWAY_URL)
                        .post('/api/v1/auth/login')
                        .send({ admissionNo: 'TEST', password: 'test' })
                );
            }

            const responses = await Promise.all(requests);

            for (const res of responses) {
                if (res.status === 429) {
                    status429Count++;
                }
            }

            // We expect at least one request to be rejected, typically after the 3rd or 4th burst slot.
            expect(status429Count).toBeGreaterThan(0);
        });

        // Nginx configuration: limit_req_zone $binary_remote_addr zone=api_general:10m rate=30r/m; burst=10 nodelay;
        it('should trigger 429 Too Many Requests on general /api/ burst threshold', async () => {
            if (!isGatewayReachable) return;

            let status429Count = 0;
            const requests = [];

            // Burst is 10, rate is 30/min. Sending 25 rapid requests should trigger a 429 limit.
            for (let i = 0; i < 25; i++) {
                requests.push(
                    request(GATEWAY_URL)
                        .get('/api/v1/school-policy')
                );
            }

            const responses = await Promise.all(requests);

            for (const res of responses) {
                if (res.status === 429) {
                    status429Count++;
                }
            }

            expect(status429Count).toBeGreaterThan(0);
        });
    });
});
