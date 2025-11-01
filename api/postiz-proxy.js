import { NextRequest, NextResponse } from 'next/server';

// Vercel Edge Function for Postiz API proxy
export const config = {
  runtime: 'edge',
};

const POSTIZ_API_BASE = 'https://api.postiz.com/public/v1';

export default async function handler(req) {
  // Handle CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const targetPath = url.searchParams.get('path') || 'posts';
    const targetUrl = `${POSTIZ_API_BASE}/${targetPath}`;
    
    // Get authorization from request headers
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    };

    let response;
    const requestBody = await req.text();

    switch (req.method) {
      case 'GET':
        response = await fetch(targetUrl, {
          method: 'GET',
          headers,
        });
        break;
        
      case 'POST':
        response = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: requestBody,
        });
        break;
        
      case 'DELETE':
        const deletePath = url.searchParams.get('id');
        const deleteUrl = `${POSTIZ_API_BASE}/posts/${deletePath}`;
        response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers,
        });
        break;
        
      default:
        return NextResponse.json(
          { error: 'Method not allowed' },
          { status: 405, headers: corsHeaders }
        );
    }

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
    return NextResponse.json(
      { error: 'Proxy error', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}