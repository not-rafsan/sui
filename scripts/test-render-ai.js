// Test script: calls the deployed research endpoint and shows the result
const API = 'https://sui-ypgl.onrender.com';

async function test() {
  console.log('1. Health check...');
  const health = await fetch(API + '/api/instagram/schedule-executor').then(r => r.status);
  console.log('   Status:', health);

  console.log('\n2. Creating carousel via AI...');
  const start = Date.now();
  const res = await fetch(API + '/api/carousel/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'AI powered dropshipping', chapterCount: 5 }),
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const data = await res.json();

  if (!res.ok) {
    console.log('   FAILED:', res.status, data.error || JSON.stringify(data));
    return;
  }

  console.log('   Success in', elapsed + 's!');
  console.log('   Title:', data.title);
  console.log('   Slides:', data.slides?.length);
  console.log('   Caption preview:', (data.caption || '').substring(0, 120) + '...');
  (data.slides || []).forEach(function(s, i) {
    console.log('   Slide ' + (i + 1) + ' [' + s.type + ']: ' + s.title);
  });
}

test().catch(e => console.error('Error:', e.message));