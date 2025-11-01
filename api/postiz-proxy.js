// Vercel Edge Function for Postiz API proxy (Vite compatible)
// This replaces the CORS proxy to handle large payloads for slideshow posting

const POSTIZ_API_BASE = 'https://api.postiz.com/public/v1';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path') || 'posts';
  const targetUrl = `${POSTIZ_API_BASE}/${targetPath}`;
  
  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Get authorization from request headers
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
  const { searchParams } = new URL(request.url);
  const targetPath = searchParams.get('path') || 'posts';
  const targetUrl = `${POSTIZ_API_BASE}/${targetPath}`;
  
  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Get authorization from request headers
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

    const requestBody = await request.text();

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: requestBody,
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
  
  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Get authorization from request headers
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