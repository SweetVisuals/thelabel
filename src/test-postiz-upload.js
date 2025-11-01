// Test script to verify Postiz upload functionality
// Run this in the browser console to test upload endpoints

console.log('🧪 Testing Postiz Upload Functionality...');

// Test the upload-from-url endpoint
async function testUploadFromUrl() {
  console.log('📤 Testing upload-from-url endpoint...');
  
  const testImageUrl = 'https://via.placeholder.com/500x500/FF0000/FFFFFF?text=TEST';
  
  try {
    const response = await fetch('/api/postiz-proxy?path=upload-from-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('postiz_api_key') || 'YOUR_API_KEY_HERE'
      },
      body: JSON.stringify({ url: testImageUrl })
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Upload from URL successful:', result);
      return { success: true, result };
    } else {
      const errorText = await response.text();
      console.error('❌ Upload from URL failed:', response.status, errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error('❌ Upload from URL error:', error);
    return { success: false, error: error.message };
  }
}

// Test the multipart upload endpoint
async function testMultipartUpload() {
  console.log('📤 Testing multipart upload endpoint...');
  
  try {
    // Create a test image blob
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, 0, 500, 500);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TEST', 250, 250);
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const formData = new FormData();
    formData.append('file', blob, 'test-image.png');

    const response = await fetch('/api/postiz-proxy?path=upload', {
      method: 'POST',
      headers: {
        'Authorization': localStorage.getItem('postiz_api_key') || 'YOUR_API_KEY_HERE'
      },
      body: formData
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Multipart upload successful:', result);
      return { success: true, result };
    } else {
      const errorText = await response.text();
      console.error('❌ Multipart upload failed:', response.status, errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error('❌ Multipart upload error:', error);
    return { success: false, error: error.message };
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Postiz upload tests...');
  
  const apiKey = localStorage.getItem('postiz_api_key');
  if (!apiKey) {
    console.warn('⚠️ No Postiz API key found in localStorage. Please set one first.');
    console.log('💡 Set your API key with: localStorage.setItem("postiz_api_key", "your-api-key")');
    return;
  }
  
  const urlTest = await testUploadFromUrl();
  const multipartTest = await testMultipartUpload();
  
  console.log('📊 Test Results:');
  console.log('Upload from URL:', urlTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('Multipart Upload:', multipartTest.success ? '✅ PASSED' : '❌ FAILED');
  
  if (urlTest.success && multipartTest.success) {
    console.log('🎉 All tests passed! Postiz upload functionality is working.');
  } else {
    console.log('⚠️ Some tests failed. Check the error messages above.');
  }
}

// Export for manual testing
window.testPostizUpload = {
  testUploadFromUrl,
  testMultipartUpload,
  runTests
};

console.log('✅ Test script loaded. Run testPostizUpload.runTests() to test upload functionality.');