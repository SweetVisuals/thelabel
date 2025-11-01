// Simple test to verify Postiz API connection
// Run this in the browser console after the changes are deployed

console.log('🧪 Testing Postiz API Connection...');

async function testPostizConnection() {
  const apiKey = localStorage.getItem('postiz_api_key');
  if (!apiKey) {
    console.warn('⚠️ No Postiz API key found in localStorage.');
    console.log('💡 Set your API key with: localStorage.setItem("postiz_api_key", "your-api-key")');
    return;
  }

  console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');
  
  try {
    // Test the proxy endpoint
    console.log('📤 Testing proxy endpoint...');
    const proxyUrl = '/api/postiz-proxy/integrations';
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS! Proxy is working. Data:', data);
      
      if (Array.isArray(data) && data.length > 0) {
        console.log('✅ Found', data.length, 'connected accounts');
      } else {
        console.log('⚠️ No accounts found or unexpected response format');
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Proxy test failed:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    console.log('💡 This might be expected if the API key is invalid');
  }
}

// Export for manual testing
window.testPostizConnection = testPostizConnection;

console.log('✅ Test loaded. Run testPostizConnection() to test the connection.');