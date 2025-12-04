// Vercel Edge Function for Postiz API proxy (Vite compatible)
// This replaces the CORS proxy to handle large payloads for slideshow posting
// Updated to support Postiz upload endpoints as documented in Discord

const POSTIZ_API_BASE = 'https://api.postiz.com/public/v1';

export async function OPTIONS(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };

  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET(request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  let targetPath = searchParams.get('path');

  // Handle both query parameter format and direct path format
  if (!targetPath) {
    // Extract path from URL path (e.g., /api/postiz-proxy/integrations)
    const pathSegments = url.pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 3 && pathSegments[0] === 'api' && pathSegments[1] === 'postiz-proxy') {
      targetPath = pathSegments.slice(2).join('/');
    } else {
      targetPath = 'posts'; // Default
    }
  }

  // Construct target URL with path
  let targetUrl = `${POSTIZ_API_BASE}/${targetPath}`;

  // Append all other query parameters to the target URL
  const targetUrlObj = new URL(targetUrl);
  searchParams.forEach((value, key) => {
    if (key !== 'path') {
      targetUrlObj.searchParams.append(key, value);
    }
  });
  targetUrl = targetUrlObj.toString();

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    };

    console.log(`🔄 Proxying GET to: ${targetUrl} (extracted path: ${targetPath})`);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}


export async function POST(request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  let targetPath = searchParams.get('path');

  // Handle both query parameter format and direct path format
  if (!targetPath) {
    // Extract path from URL path (e.g., /api/postiz-proxy/upload-from-url)
    const pathSegments = url.pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 3 && pathSegments[0] === 'api' && pathSegments[1] === 'postiz-proxy') {
      targetPath = pathSegments.slice(2).join('/');
    } else {
      targetPath = 'posts'; // Default
    }
  }

  const targetUrl = `${POSTIZ_API_BASE}/${targetPath}`;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle different content types
    const contentType = request.headers.get('content-type') || '';

    let headers = {
      'Authorization': authHeader,
    };

    let body;

    if (contentType.includes('multipart/form-data')) {
      // For file uploads, pass through the form data as-is
      headers['Content-Type'] = contentType;
      body = request.body;
    } else {
      // For JSON requests, parse and re-stringify
      headers['Content-Type'] = 'application/json';
      const requestBody = await request.text();

      if (targetPath === 'upload-from-url') {
        // Special handling for URL upload endpoint
        body = requestBody;
      } else {
        body = requestBody;
      }
    }

    console.log(`🔄 Proxying POST to: ${targetUrl} (extracted path: ${targetPath})`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path') || 'posts';
  const id = searchParams.get('id');

  let targetUrl;
  if (id) {
    targetUrl = `${POSTIZ_API_BASE}/posts/${id}`;
  } else {
    targetUrl = `${POSTIZ_API_BASE}/${targetPath}`;
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  };

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    };

    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers,
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}