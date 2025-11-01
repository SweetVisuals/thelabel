// Image proxy endpoint for downloading CORS-protected images
// This server-side function downloads images and returns them without CORS restrictions

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS(request) {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(request) {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('url');
  
  if (!imageUrl) {
    return new Response(JSON.stringify({ error: 'Missing image URL parameter' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  console.log(`📥 Downloading image via proxy: ${imageUrl}`);

  try {
    // Validate the URL
    let targetUrl;
    try {
      targetUrl = new URL(imageUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Security check: only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return new Response(JSON.stringify({ error: 'Only HTTP/HTTPS URLs are allowed' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Download the image
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to download image: ${response.status} ${response.statusText}`);
      return new Response(JSON.stringify({ 
        error: `Failed to download image: ${response.status} ${response.statusText}` 
      }), {
        status: response.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Check if the response is actually an image
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      console.error(`❌ Response is not an image: ${contentType}`);
      return new Response(JSON.stringify({ 
        error: `URL does not return an image (content-type: ${contentType})` 
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    // Get the image data as array buffer
    const imageBuffer = await response.arrayBuffer();
    
    console.log(`✅ Successfully downloaded image: ${imageBuffer.byteLength} bytes, type: ${contentType}`);

    // Return the image with proper CORS headers
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Content-Length': imageBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('❌ Image proxy error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to download image',
      details: error.message 
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}