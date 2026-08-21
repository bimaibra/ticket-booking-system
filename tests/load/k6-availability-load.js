import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '1m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TICKET_ID = __ENV.TICKET_ID || 1;
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  // 1. Availability check
  const availRes = http.get(`${BASE_URL}/events/1/availability`);
  check(availRes, {
    'availability status is 200': (r) => r.status === 200,
    'has tickets array': (r) => JSON.parse(r.body).tickets !== undefined,
  });

  // 2. Hold creation if token available
  if (AUTH_TOKEN) {
    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    };

    const holdPayload = JSON.stringify({
      ticket_id: Number(TICKET_ID),
      quantity: 1,
    });

    const holdRes = http.post(`${BASE_URL}/holds`, holdPayload, params);
    const holdSuccess = check(holdRes, {
      'hold status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    });

    if (holdSuccess && holdRes.status === 201) {
      const holdId = JSON.parse(holdRes.body).id;

      // 3. Booking from hold with Idempotency Key
      const uuidStr = '10000000-0000-4000-8000-' + String(Math.floor(Math.random() * 1000000000000)).padStart(12, '0');
      const orderParams = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Idempotency-Key': uuidStr,
        },
      };

      const orderPayload = JSON.stringify({
        hold_ids: [holdId],
      });

      const orderRes = http.post(`${BASE_URL}/orders`, orderPayload, orderParams);
      check(orderRes, {
        'order status is 201, 409, or 410': (r) => [201, 409, 410].includes(r.status),
      });
    }
  }

  sleep(0.1);
}
