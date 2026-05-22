import { put, list } from '@vercel/blob';

// Menggunakan Vercel Blob sebagai database JSON sederhana
// Karena Edge Config read-only via SDK, dan KV mungkin berbayar di akun tertentu.
export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      const keysStr = request.query.keys;
      
      let data = {};
      try {
        const { blobs } = await list({ prefix: 'db.json' });
        if (blobs.length > 0) {
          const res = await fetch(blobs[0].url);
          data = await res.json();
        }
      } catch (e) {
        // Jika file belum ada, biarkan kosong
        console.log("No existing db.json found");
      }

      if (keysStr) {
        const keys = keysStr.split(',');
        const result = {};
        for (const k of keys) {
          result[k] = data[k] || null;
        }
        return response.status(200).json(result);
      }
      return response.status(200).json(data);
      
    } else if (request.method === 'POST') {
      const { key, value } = request.body;
      
      let data = {};
      try {
        const { blobs } = await list({ prefix: 'db.json' });
        if (blobs.length > 0) {
          const res = await fetch(blobs[0].url);
          data = await res.json();
        }
      } catch (e) {
        // File belum ada
      }
      
      // Update data
      data[key] = value;
      
      // Timpa db.json di Vercel Blob
      await put('db.json', JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json'
      });
      
      return response.status(200).json({ success: true });
    }
    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error("Blob DB Error:", error);
    return response.status(500).json({ error: error.message });
  }
}
