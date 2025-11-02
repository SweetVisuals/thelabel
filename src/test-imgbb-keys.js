// Simple test script to diagnose ImgBB API key issues
// Run this in the browser console on your site

import { testAllApiKeys, uploadToImgbb, getRateLimitStatus } from './lib/imgbb.js';

// Test all API keys
console.log('🧪 Testing all ImgBB API keys...');
const results = await testAllApiKeys();

console.log('📊 Test Results:');
results.forEach(result => {
  console.log(`Key ${result.keyIndex}: ${result.success ? '✅' : '❌'} ${result.message}`);
});

// Show current rate limit status
console.log('📊 Current Rate Limit Status:');
console.log(getRateLimitStatus());

// Also test with a real upload attempt
if (results.some(r => r.success)) {
  console.log('🧪 Testing with a real upload...');
  
  // Create a simple test image
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'red';
  ctx.fillRect(0, 0, 10, 10);
  
  canvas.toBlob(async (blob) => {
    const testFile = new File([blob], 'test-upload.png', { type: 'image/png' });
    
    try {
      console.log('📤 Attempting upload...');
      const result = await uploadToImgbb(testFile);
      console.log('✅ Upload successful:', result.data.url);
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
    }
  }, 'image/png');
} else {
  console.log('❌ No working API keys found. Please check your API keys.');
}