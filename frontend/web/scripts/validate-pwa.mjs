import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import nextConfig from '../next.config.mjs';

const root = process.cwd();
const requiredManifest = {
  name: 'Planora - Plan, Track, Ship',
  short_name: 'Planora',
  start_url: '/?source=pwa',
  scope: '/',
  display: 'standalone',
};
const requiredIcons = [
  ['public/apple-touch-icon.png', 180, 180],
  ['public/icons/icon-192x192.png', 192, 192],
  ['public/icons/icon-512x512.png', 512, 512],
  ['public/icons/maskable-512x512.png', 512, 512],
];
const requiredMetadataTokens = [
  'application-name',
  'rel":"manifest',
  'apple-mobile-web-app-title',
  'apple-mobile-web-app-status-bar-style',
  'apple-touch-icon',
  'theme-color',
];
const requiredServiceWorkerSnippets = [
  'SKIP_WAITING',
  'navigationPreload',
  'MAX_STATIC_CACHE_ENTRIES',
  'startsWith(\'/api/\')',
];

function fail(message) {
  throw new Error(message);
}

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing ${relativePath}. Run npm run build before npm run pwa:check.`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function readText(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

async function validateManifest() {
  const manifest = readJson('.next/server/app/manifest.webmanifest.body');

  Object.entries(requiredManifest).forEach(([key, value]) => {
    if (manifest[key] !== value) {
      fail(`Manifest ${key} expected ${value}, received ${manifest[key]}`);
    }
  });

  const iconSources = new Set((manifest.icons || []).map((icon) => icon.src));
  ['/icons/icon-192x192.png', '/icons/icon-512x512.png', '/icons/maskable-512x512.png'].forEach((src) => {
    if (!iconSources.has(src)) {
      fail(`Manifest is missing icon ${src}`);
    }
  });
}

async function validateIcons() {
  await Promise.all(requiredIcons.map(async ([relativePath, width, height]) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      fail(`Missing icon ${relativePath}`);
    }

    const metadata = await sharp(absolutePath).metadata();
    if (metadata.width !== width || metadata.height !== height || metadata.format !== 'png') {
      fail(`${relativePath} expected ${width}x${height} png, received ${metadata.width}x${metadata.height} ${metadata.format}`);
    }
  }));
}

function validateServiceWorker() {
  const serviceWorker = readText('public/sw.js');
  requiredServiceWorkerSnippets.forEach((snippet) => {
    if (!serviceWorker.includes(snippet)) {
      fail(`Service worker is missing "${snippet}"`);
    }
  });
}

async function validateServiceWorkerHeaders() {
  const headers = await nextConfig.headers();
  const swRule = headers.find((rule) => rule.source === '/sw.js');
  if (!swRule) fail('next.config.mjs is missing a /sw.js headers rule');

  const headerMap = new Map(swRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
  const cacheControl = headerMap.get('cache-control') || '';
  const contentType = headerMap.get('content-type') || '';
  const csp = headerMap.get('content-security-policy') || '';
  const allowed = headerMap.get('service-worker-allowed') || '';

  if (!contentType.includes('application/javascript')) fail('/sw.js Content-Type must be application/javascript');
  if (!cacheControl.includes('no-cache') || !cacheControl.includes('no-store')) fail('/sw.js Cache-Control must include no-cache and no-store');
  if (allowed !== '/') fail('/sw.js Service-Worker-Allowed must be /');
  if (csp !== "default-src 'none'; script-src 'self'; connect-src 'self';") fail('/sw.js CSP is not the expected strict policy');
}

function validateMetadata() {
  const rootHead = readText('.next/server/app/index.segments/_head.segment.rsc');
  requiredMetadataTokens.forEach((token) => {
    if (!rootHead.includes(token)) {
      fail(`Built root metadata is missing "${token}"`);
    }
  });
}

async function main() {
  await validateManifest();
  await validateIcons();
  validateServiceWorker();
  await validateServiceWorkerHeaders();
  validateMetadata();
  console.log('PWA validation passed.');
}

main().catch((error) => {
  console.error(`PWA validation failed: ${error.message}`);
  process.exit(1);
});
