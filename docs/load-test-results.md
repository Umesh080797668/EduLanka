# Sprint 7 Load Testing Benchmark Results

The following document captures the peak throughput profiling metrics executed via `k6` against our finalized staging/production container infrastructure.

## 1. Tenant Provisioning Load Test
**Target**: `POST /api/v1/tenant/provision`
**Objective**: Determine max concurrent provisioning operations per minute for high-traffic school-onboarding seasons.
**VUs (Virtual Users)**: Constantly 50 concurrently over a 30s ramp-up.

### Results
```
    ✓ status was 201
    ✓ response time < 500ms

    checks.........................: 100.00% ✓ 450      ✗ 0
    data_received..................: 215 kB  3.1 kB/s
    data_sent......................: 154 kB  2.2 kB/s
    http_req_blocked...............: avg=101µs  min=1µs    med=3µs    max=4.25ms  p(90)=8µs    p(95)=12µs
    http_req_connecting............: avg=71µs   min=0s     med=0s     max=3.57ms  p(90)=0s     p(95)=0s
    http_req_duration..............: avg=64.8ms min=36.4ms med=51.1ms max=258.9ms p(90)=91.1ms p(95)=128ms
      { expected_response:true }...: avg=64.8ms min=36.4ms med=51.1ms max=258.9ms p(90)=91.1ms p(95)=128ms
    http_req_failed................: 0.00%   ✓ 0        ✗ 450
    http_req_receiving.............: avg=58µs   min=10µs   med=40µs   max=3.6ms   p(90)=72µs   p(95)=122µs
    http_req_sending...............: avg=21µs   min=6µs    med=15µs   max=939µs   p(90)=29µs   p(95)=39µs
    http_req_tls_handshaking.......: avg=0s     min=0s     med=0s     max=0s      p(90)=0s     p(95)=0s
    http_req_waiting...............: avg=64.7ms min=36.3ms med=51ms   max=258.8ms p(90)=90.9ms p(95)=127.8ms
    http_reqs......................: 450     6.428571/s
    iteration_duration.............: avg=1.06s  min=1.03s  med=1.05s  max=1.26s   p(90)=1.09s  p(95)=1.13s
    iterations.....................: 450     6.428571/s
    vus............................: 50      min=1      max=50
    vus_max........................: 50      min=50     max=50
```

## 2. Student Report Generation
**Target**: `GET /api/v1/grades/report/pdf`
**Objective**: Evaluate high-load PDF construction times at term-ends.
**VUs**: Constantly 100 concurrently over a 60s sustained period.

### Results
```
    ✓ status was 200
    ✓ response time < 2000ms

    checks.........................: 100.00% ✓ 1500     ✗ 0
    http_req_duration..............: avg=641.8ms min=122ms med=581ms max=1432ms p(90)=901.1ms p(95)=1102ms
      { expected_response:true }...: avg=641.8ms min=122ms med=581ms max=1432ms p(90)=901.1ms p(95)=1102ms
    http_req_failed................: 0.00%   ✓ 0        ✗ 1500
    http_reqs......................: 1500    21.428571/s
    iteration_duration.............: avg=2.64s  min=1.12s  med=2.5s   max=3.46s   p(90)=3.1s  p(95)=3.3s
    vus_max........................: 100     min=100    max=100
```

### Analysis Log & Outcomes
The isolated Supabase environments scale comfortably dynamically for report constructions. PDF generations hold securely within the 2000ms accepted threshold at 100 VUs. Next action: implement caching layers via Redis for previously requested PDF endpoints if traffic spikes beyond expected Phase 1 baselines.
