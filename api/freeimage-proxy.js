// Freeimage.host upload proxy to handle CORS issues
// This server-side function uploads images to Freeimage.host API

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
  try {
    console.log('📤 Freeimage.host proxy: Starting upload');

    // Get the form data from the request
    const formData = await request.formData();
    const imageFile = formData.get('source');

    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image file provided' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Validate file size (25MB limit)
    if (imageFile.size > 25 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (max 25MB)' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(imageFile.type)) {
      console.warn(`⚠️ Unexpected MIME type: ${imageFile.type}, attempting upload anyway`);
    }

    console.log(`📤 Freeimage.host proxy: Uploading ${imageFile.name} (${(imageFile.size / 1024 / 1024).toFixed(2)}MB, ${imageFile.type})`);

    // Create form data for Freeimage.host API
    const freeimageFormData = new FormData();
    freeimageFormData.append('key', FREEIMAGE_API_KEY);
    freeimageFormData.append('action', 'upload');
    freeimageFormData.append('source', imageFile);
    freeimageFormData.append('format', 'json');

    // Upload to Freeimage.host
    const response = await fetch(FREEIMAGE_UPLOAD_URL, {
      method: 'POST',
      body: freeimageFormData,
    });

    console.log(`📊 Freeimage.host proxy: Response status ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Freeimage.host proxy: Error response: ${response.status} ${response.statusText}`);
      console.error(`❌ Error body: ${errorText}`);

      return new Response(JSON.stringify({
        error: `Freeimage.host upload failed: ${response.status} ${response.statusText}`,
        details: errorText
      }), {
        status: response.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    console.log(`✅ Freeimage.host proxy: Upload success:`, data);

    if (data.status_code !== 200 || !data.image) {
      return new Response(JSON.stringify({
        error: 'Freeimage.host upload was not successful',
        details: data
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Convert Freeimage.host response to ImgBB-compatible format for consistency
    const imgbbCompatibleResponse = {
      data: {
        id: data.image.id.toString(),
        title: data.image.name,
        url_viewer: data.image.url_viewer,
        url: data.image.url,
        display_url: data.image.url,
        width: data.image.width,
        height: data.image.height,
        size: imageFile.size,
        time: data.image.date,
        expiration: '0', // Freeimage.host images don't expire
        image: {
          filename: data.image.name,
          name: data.image.name,
          mime: imageFile.type,
          extension: data.image.extension,
          url: data.image.url,
        },
        thumb: {
          filename: data.image.thumb.filename,
          name: data.image.thumb.name,
          mime: 'image/jpeg',
          extension: 'jpg',
          url: data.image.thumb.url,
        },
        delete_url: '', // Freeimage.host doesn't provide delete URLs
      },
      success: true,
      status: 200,
    };

    return new Response(JSON.stringify(imgbbCompatibleResponse), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      },
    });

  } catch (error) {
    console.error('❌ Freeimage.host proxy error:', error);
    return new Response(JSON.stringify({
      error: 'Freeimage.host proxy failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}