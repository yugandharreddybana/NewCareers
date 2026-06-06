import axios from 'axios';
import crypto from 'crypto';

const secret = process.env.APP_INTERNAL_SECRET;
const base = 'http://localhost:8080/api';
const path = '/account/delete';
const body = JSON.stringify({ password: 'Test@1234' });
const timestamp = String(Date.now());
const payload = `${timestamp}POST${path}${body}`;
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

const res = await axios.request({
  method: 'POST',
  url: `${base}${path}`,
  data: body,
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-User-Id': '00000000-0000-0000-0000-000000000002',
    'X-Timestamp': timestamp,
    'X-Signature': signature,
  },
  validateStatus: () => true,
});
console.log(res.status, res.data);
