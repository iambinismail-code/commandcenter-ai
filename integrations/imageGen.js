// Image Generation — Multi-Provider Router with Auto-Fallback
// Priority: 1. Stability AI → 2. fal.ai → 3. Pollinations.ai (always free, no key)
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('../server/config/env');

// ──────────────────────────────────────────────────────────
// Provider 1: Stability AI (api.stability.ai)
// Sign up free at https://platform.stability.ai to get key
// ──────────────────────────────────────────────────────────
async function generateWithStability(prompt, options = {}) {
  const apiKey = config.stabilityAi?.apiKey || process.env.STABILITY_API_KEY;
  if (!apiKey) throw new Error('STABILITY_API_KEY not configured');

  const width = options.width || 1024;
  const height = options.height || 1024;

  return new Promise((resolve, reject) => {
    const formData = [
      `--boundary\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${prompt}`,
      `--boundary\r\nContent-Disposition: form-data; name="output_format"\r\n\r\npng`,
      `--boundary\r\nContent-Disposition: form-data; name="aspect_ratio"\r\n\r\n1:1`,
      '--boundary--'
    ].join('\r\n');

    const body = Buffer.from(formData, 'utf8');

    const reqOptions = {
      hostname: 'api.stability.ai',
      path: '/v2beta/stable-image/generate/core',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*',
        'Content-Type': 'multipart/form-data; boundary=boundary',
        'Content-Length': body.length,
      },
      timeout: 60000,
    };

    const req = https.request(reqOptions, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', d => errBody += d);
        res.on('end', () => reject(new Error(`Stability AI: ${res.statusCode} — ${errBody}`)));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 1000) return reject(new Error('Stability AI returned empty image'));
        resolve({ buffer, provider: 'stability' });
      });
    });

    req.on('error', err => reject(new Error(`Stability AI request failed: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Stability AI timed out')); });
    req.write(body);
    req.end();
  });
}

// ──────────────────────────────────────────────────────────
// Provider 2: fal.ai (REST polling API, no npm needed)
// Sign up free at https://fal.ai to get key
// ──────────────────────────────────────────────────────────
async function generateWithFal(prompt, options = {}) {
  const apiKey = config.falAi?.apiKey || process.env.FAL_API_KEY;
  if (!apiKey) throw new Error('FAL_API_KEY not configured');

  // Submit job
  const submitResult = await falRequest('POST', '/fal-ai/fast-sdxl', {
    prompt,
    image_size: 'square_hd',
    num_inference_steps: 4,
    num_images: 1,
  }, apiKey);

  if (!submitResult.request_id) throw new Error('fal.ai: No request_id returned');

  // Poll for result (max 60s)
  const requestId = submitResult.request_id;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const statusResult = await falRequest('GET', `/fal-ai/fast-sdxl/requests/${requestId}/status`, null, apiKey);
    if (statusResult.status === 'COMPLETED') {
      const resultData = await falRequest('GET', `/fal-ai/fast-sdxl/requests/${requestId}`, null, apiKey);
      const imageUrl = resultData?.images?.[0]?.url;
      if (!imageUrl) throw new Error('fal.ai: No image URL in result');
      const buffer = await downloadImageBuffer(imageUrl);
      return { buffer, provider: 'fal' };
    }
    if (statusResult.status === 'FAILED') throw new Error('fal.ai: Job failed');
  }
  throw new Error('fal.ai: Timed out waiting for image');
}

function falRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const reqOptions = {
      hostname: 'queue.fal.run',
      path,
      method,
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 30000,
    };
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`fal.ai parse error: ${data}`)); }
      });
    });
    req.on('error', err => reject(new Error(`fal.ai: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('fal.ai request timed out')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ──────────────────────────────────────────────────────────
// Provider 3: Pollinations.ai (100% free, no key ever)
// Strategy: fully download the image first (warms Pollinations'
// cache), then return BOTH buffer + URL. The bot sends the URL
// to Telegram — Telegram fetches the cached version instantly.
// If URL send fails, bot falls back to uploading the buffer.
// ──────────────────────────────────────────────────────────
async function generateWithPollinations(prompt, options = {}) {
  const seed = Math.floor(Math.random() * 999999);
  const encodedPrompt = encodeURIComponent(prompt);
  // Use 512px — smaller file = faster download on mobile + faster Telegram upload fallback
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&seed=${seed}&nologo=true&enhance=true`;

  // Fully download image — this forces Pollinations to generate + cache it
  console.log('[imageGen] Pollinations: downloading to warm cache...');
  const buffer = await downloadImageBuffer(imageUrl);
  if (buffer.length < 1000) throw new Error('Pollinations returned empty image');
  console.log(`[imageGen] Pollinations: cached! (${Math.round(buffer.length / 1024)}KB)`);
  
  // Return both — bot tries URL first (Telegram fetches cached), falls back to buffer
  return { buffer, imageUrl, provider: 'pollinations' };
}

// ──────────────────────────────────────────────────────────
// Download image buffer from any URL (handles redirects)
// ──────────────────────────────────────────────────────────
function downloadImageBuffer(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImageBuffer(res.headers.location, redirectCount + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timed out')); });
  });
}

// ──────────────────────────────────────────────────────────
// Verify image URL is reachable (follows redirects, checks status)
// ──────────────────────────────────────────────────────────
function verifyImageUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.destroy();
        return verifyImageUrl(res.headers.location, redirectCount + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.destroy();
        return reject(new Error(`Image URL returned ${res.statusCode}`));
      }
      // Image is valid — destroy connection (we don't need to download it)
      res.destroy();
      resolve();
    });
    req.on('error', err => reject(new Error(`Image URL check failed: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Image URL verification timed out')); });
  });
}

// ──────────────────────────────────────────────────────────
// MAIN: Multi-provider router with automatic fallback
// Returns { buffer, imageUrl, provider }
//   - buffer: image data (for providers that return data)
//   - imageUrl: direct URL (for Pollinations — Telegram downloads it)
// ──────────────────────────────────────────────────────────
async function generateImage(prompt, options = {}) {
  const providers = [
    { name: 'Stability AI', fn: () => generateWithStability(prompt, options) },
    { name: 'fal.ai',       fn: () => generateWithFal(prompt, options) },
    { name: 'Pollinations', fn: () => generateWithPollinations(prompt, options) },
  ];

  let lastError = null;
  for (const provider of providers) {
    try {
      console.log(`🎨 [imageGen] Trying ${provider.name}...`);
      const result = await provider.fn();
      const sizeInfo = result.buffer ? `${Math.round(result.buffer.length / 1024)}KB` : 'URL-mode';
      console.log(`✅ [imageGen] Success via ${provider.name} (${sizeInfo})`);
      return result;
    } catch (err) {
      console.warn(`⚠️  [imageGen] ${provider.name} failed: ${err.message}`);
      lastError = err;
    }
  }
  throw new Error(`All image providers failed. Last error: ${lastError?.message}`);
}

// ──────────────────────────────────────────────────────────
// Save generated image to disk and return path
// ──────────────────────────────────────────────────────────
async function generateAndSave(prompt, options = {}) {
  const { buffer, provider } = await generateImage(prompt, options);

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const filename = `img_${Date.now()}.png`;
  const filepath = path.join(dataDir, filename);
  fs.writeFileSync(filepath, buffer);

  return { filepath, provider, size: buffer.length };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { generateImage, generateAndSave };
