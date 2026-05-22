import { put, list, del } from '@vercel/blob';

// Menggunakan Vercel Blob sebagai database JSON sederhana
export default async function handler(request, response) {
  // Prevent Vercel Edge Cache
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  
  try {
    if (request.method === 'GET') {
      const keysStr = request.query.keys;
      
      let data = {};
      try {
        const { blobs } = await list({ prefix: 'db' });
        if (blobs.length > 0) {
          // Sort descending by uploadedAt to get the LATEST file
          blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
          // Tambahkan cache busting pada URL
          const res = await fetch(blobs[0].url + '?t=' + Date.now(), { cache: 'no-store' });
          data = await res.json();
        }
      } catch (e) {
        console.log("No existing db found");
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
      const fullDb = request.body;
      
      // Upload file baru dengan suffix acak (agar terhindar dari CDN Cache Vercel)
      await put('db', JSON.stringify(fullDb), {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'application/json'
      });
      
      // Bersihkan file lama agar tidak menumpuk
      try {
        const { blobs } = await list({ prefix: 'db' });
        if (blobs.length > 1) {
          blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
          const urlsToDelete = blobs.slice(1).map(b => b.url);
          if (urlsToDelete.length > 0) {
            await del(urlsToDelete);
          }
        }
      } catch (e) {
        console.error("Cleanup failed", e);
      }
      
      return response.status(200).json({ success: true });
    }
    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error("Blob DB Error:", error);
    return response.status(500).json({ error: error.message });
  }
}
