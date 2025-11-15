// IM.GE upload proxy to handle CORS issues
// This server-side function uploads images to IM.GE API

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const IMGE_API_KEY = 'imge_5Vvy_4378238aa286a4d62a6d663f395e5c680798e12d2c48ebb25d3da539cfc8b4992c6a7eac72327980c8b7c01fa9f0535f386e1d299de575fdd81230ef710801ea';
const IMGE_UPLOAD_URL = 'https://im.ge/api/1/upload';

export async function OPTIONS(request) {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    console.log('📤 IM.GE proxy: Starting upload');

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

    console.log(`📤 IM.GE proxy: Uploading ${imageFile.name} (${(imageFile.size / 1024 / 1024).toFixed(2)}MB, ${imageFile.type})`);

    // Create form data for IM.GE API
    const imgeFormData = new FormData();
    imgeFormData.append('source', imageFile);
    imgeFormData.append('format', 'json');

    // Upload to IM.GE
    const response = await fetch(IMGE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': IMGE_API_KEY,
      },
      body: imgeFormData,
    });

    console.log(`📊 IM.GE proxy: Response status ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ IM.GE proxy: Error response: ${response.status} ${response.statusText}`);
      console.error(`❌ Error body: ${errorText}`);

      return new Response(JSON.stringify({
        error: `IM.GE upload failed: ${response.status} ${response.statusText}`,
        details: errorText
      }), {
        status: response.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    console.log(`✅ IM.GE proxy: Upload success:`, data);

    if (data.status_code !== 200 || !data.image) {
      return new Response(JSON.stringify({
        error: 'IM.GE upload was not successful',
        details: data
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Convert IM.GE response to ImgBB-compatible format for consistency
    const imgbbCompatibleResponse = {
      data: {
        id: data.image.id_encoded || data.image.name,
        title: data.image.name,
        url_viewer: data.image.url_viewer,
        url: data.image.url,
        display_url: data.image.display_url || data.image.url,
        width: data.image.width,
        height: data.image.height,
        size: data.image.size,
        time: data.image.date,
        expiration: '0', // IM.GE images don't expire by default
        image: {
          filename: data.image.filename,
          name: data.image.name,
          mime: data.image.mime,
          extension: data.image.extension,
          url: data.image.url,
        },
        thumb: data.image.thumb ? {
          filename: data.image.thumb.filename,
          name: data.image.thumb.name,
          mime: data.image.thumb.mime,
          extension: data.image.thumb.extension,
          url: data.image.thumb.url,
        } : {
          filename: '',
          name: '',
          mime: 'image/jpeg',
          extension: 'jpg',
          url: data.image.url, // Fallback to main image
        },
        delete_url: '', // IM.GE doesn't provide delete URLs in basic response
      },
      success: true,
      status: data.status_code,
    };

    return new Response(JSON.stringify(imgbbCompatibleResponse), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      },
    });

  } catch (error) {
    console.error('❌ IM.GE proxy error:', error);
    return new Response(JSON.stringify({
      error: 'IM.GE proxy failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}