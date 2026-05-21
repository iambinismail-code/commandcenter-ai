// Image Generation via Pollinations.ai — 100% free, no API key needed
const https = require('https');
const fs = require('fs');
const path = require('path');

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

/**
 * Generate an image from a text prompt using Pollinations.ai
 * Returns a Buffer of the image data
 * 
 * @param {string} prompt - Text description of the image
 * @param {Object} options - Generation options
 * @param {number} options.width - Image width (default 1024)
 * @param {number} options.height - Image height (default 1024)
 * @returns {Promise<{buffer: Buffer, url: string}>}
 */
async function generateImage(prompt, options = {}) {
  const width = options.width || 1024;
  const height = options.height || 1024;
  const seed = options.seed || Math.floor(Math.random() * 999999);

  // Build the URL
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `${POLLINATIONS_BASE}/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 60000 }, (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        https.get(response.headers.location, { timeout: 60000 }, (redirectRes) => {
          collectResponse(redirectRes, url, resolve, reject);
        }).on('error', reject);
        return;
      }

      collectResponse(response, url, resolve, reject);
    });

    request.on('error', (err) => reject(new Error(`Image generation failed: ${err.message}`)));
    request.on('timeout', () => { request.destroy(); reject(new Error('Image generation timed out (60s)')); });
  });
}

function collectResponse(response, url, resolve, reject) {
  if (response.statusCode !== 200) {
    reject(new Error(`Image API returned status ${response.statusCode}`));
    return;
  }

  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => {
    const buffer = Buffer.concat(chunks);
    if (buffer.length < 1000) {
      reject(new Error('Generated image too small — may have failed'));
      return;
    }
    resolve({ buffer, url });
  });
  response.on('error', reject);
}

/**
 * Generate and save image to a temp file, return the file path
 */
async function generateAndSave(prompt, options = {}) {
  const { buffer, url } = await generateImage(prompt, options);

  // Save to temp directory
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const filename = `img_${Date.now()}.png`;
  const filepath = path.join(dataDir, filename);
  fs.writeFileSync(filepath, buffer);

  return { filepath, url, size: buffer.length };
}

module.exports = { generateImage, generateAndSave };
