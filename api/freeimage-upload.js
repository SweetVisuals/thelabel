// FreeImage.host upload proxy to handle CORS issues
// This server-side function proxies image uploads to FreeImage.host API

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const FREEIMAGE_API_KEY = '6d207e02198a847aa98d0a2a901485a5';
const FREEIMAGE_UPLOAD_URL = 'https://freeimage.host/api/1/upload';

export async function OPTIONS(request) {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request) {
  console.log('📤 FreeImage upload proxy: Starting upload request');

  try {
    // Get the form data from the request
    const formData = await request.formData();
    const file = formData.get('source');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Validate file type
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Invalid file format' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Validate file size (25MB limit)
    if (file.size > 25 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (max 25MB)' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Unsupported file type' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📤 Uploading to FreeImage.host via proxy: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB, ${file.type})`);

    // Create new FormData for FreeImage.host API
    const freeImageFormData = new FormData();
    freeImageFormData.append('key', FREEIMAGE_API_KEY);
    freeImageFormData.append('action', 'upload');
    freeImageFormData.append('source', file);
    freeImageFormData.append('format', 'json');

    // Forward the request to FreeImage.host
    const response = await fetch(FREEIMAGE_UPLOAD_URL, {
      method: 'POST',
      body: freeImageFormData,
    });

    console.log(`📊 FreeImage.host Response Status: ${response.status} ${response.statusText}`);

    // Get the response text
    const responseText = await response.text();

    if (!response.ok) {
      console.error(`❌ FreeImage.host Error Response: ${response.status} ${response.statusText}`);
      console.error(`❌ Error Body: ${responseText}`);

      return new Response(JSON.stringify({
        error: `FreeImage.host upload failed: ${response.status} ${response.statusText}`,
        details: responseText
      }), {
        status: response.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Parse and validate the response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse FreeImage.host response:', responseText);
      return new Response(JSON.stringify({
        error: 'Invalid response from FreeImage.host',
        details: responseText
      }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (data.status_code !== 200 || !data.success) {
      console.error('❌ FreeImage.host API returned error:', data);
      return new Response(JSON.stringify({
        error: 'FreeImage.host upload was not successful',
        details: data
      }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    if (!data.image || !data.image.url) {
      console.error('❌ FreeImage.host response missing image data:', data);
      return new Response(JSON.stringify({
        error: 'FreeImage.host upload incomplete - missing image data',
        details: data
      }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ FreeImage.host upload successful via proxy:`, data.image.url);

    // Return the successful response with CORS headers
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ FreeImage upload proxy error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to upload image',
      details: error.message
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}