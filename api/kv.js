import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      const keysStr = request.query.keys;
      if (keysStr) {
        const keys = keysStr.split(',');
        const result = {};
        for (const k of keys) {
          result[k] = await kv.get(k);
        }
        return response.status(200).json(result);
      }
      return response.status(400).json({ error: 'No keys provided' });
    } else if (request.method === 'POST') {
      const { key, value } = request.body;
      await kv.set(key, value);
      return response.status(200).json({ success: true });
    }
    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error("KV Error:", error);
    return response.status(500).json({ error: error.message });
  }
}
