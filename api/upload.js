import { put } from '@vercel/blob';

export default async function handler(request, response) {
  try {
    const { searchParams } = new URL(request.url, `http://${request.headers.host}`);
    const filename = searchParams.get('filename');

    if (request.method === 'POST') {
      if (!filename) {
        return response.status(400).json({ error: 'Filename query parameter is required' });
      }
      
      const blob = await put(filename, request.body, {
        access: 'public',
      });

      return response.status(200).json(blob);
    }
    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error("Blob Error:", error);
    return response.status(500).json({ error: error.message });
  }
}
