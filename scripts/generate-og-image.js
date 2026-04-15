// Generate OG Image for social media preview (1200x630)
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const width = 1200;
const height = 630;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Background gradient
const gradient = ctx.createLinearGradient(0, 0, width, height);
gradient.addColorStop(0, '#1e3a8a');
gradient.addColorStop(0.5, '#1e40af');
gradient.addColorStop(1, '#2563eb');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

// Subtle grid pattern
ctx.strokeStyle = 'rgba(255,255,255,0.04)';
ctx.lineWidth = 0.5;
for (let x = 0; x < width; x += 40) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}
for (let y = 0; y < height; y += 40) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}

// Decorative circles
ctx.fillStyle = 'rgba(255,255,255,0.03)';
ctx.beginPath();
ctx.arc(100, 80, 200, 0, Math.PI * 2);
ctx.fill();
ctx.beginPath();
ctx.arc(1100, 550, 250, 0, Math.PI * 2);
ctx.fill();

// ============ LEFT SIDE - Icon ============
ctx.save();
ctx.translate(100, 115);

// Icon background with rounded rect
roundRect(ctx, 0, 0, 400, 400, 80);
ctx.fillStyle = 'rgba(255,255,255,0.15)';
ctx.fill();
roundRect(ctx, 10, 10, 380, 380, 70);
ctx.fillStyle = 'rgba(255,255,255,0.1)';
ctx.fill();

// Document shape
ctx.save();
ctx.translate(80, 60);

// Main document body
roundRect(ctx, 0, 0, 240, 290, 16);
ctx.fillStyle = '#ffffff';
ctx.fill();

// Folded corner
ctx.beginPath();
ctx.moveTo(168, 0);
ctx.lineTo(240, 72);
ctx.lineTo(240, 0);
ctx.closePath();
ctx.fillStyle = '#e2e8f0';
ctx.fill();

// Document content
// Title bar
roundRect(ctx, 24, 40, 120, 14, 7);
ctx.fillStyle = '#1e40af';
ctx.fill();

// Subtitle lines
roundRect(ctx, 24, 70, 180, 8, 4);
ctx.fillStyle = '#94a3b8';
ctx.fill();
roundRect(ctx, 24, 86, 150, 8, 4);
ctx.fill();

// Divider line
ctx.strokeStyle = '#e2e8f0';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(24, 110);
ctx.lineTo(216, 110);
ctx.stroke();

// Item rows
roundRect(ctx, 24, 130, 180, 12, 6);
ctx.fillStyle = '#f1f5f9';
ctx.fill();
roundRect(ctx, 24, 155, 180, 12, 6);
ctx.fill();
roundRect(ctx, 24, 180, 140, 12, 6);
ctx.fill();

// Total section
roundRect(ctx, 24, 220, 180, 40, 12);
ctx.fillStyle = '#059669';
ctx.fill();

// Checkmark
ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 4;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
ctx.beginPath();
ctx.moveTo(150, 235);
ctx.lineTo(160, 245);
ctx.lineTo(180, 225);
ctx.stroke();

ctx.restore();
ctx.restore();

// ============ RIGHT SIDE - Text ============
// App name
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 72px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
ctx.textBaseline = 'top';
ctx.fillText('CotizaPro', 560, 130);

// Tagline
ctx.fillStyle = 'rgba(255,255,255,0.85)';
ctx.font = '28px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
ctx.fillText('Cotizaciones Profesionales en PDF', 560, 200);

// Divider line
ctx.fillStyle = 'rgba(255,255,255,0.3)';
ctx.fillRect(560, 250, 80, 4);

// Feature list
const features = [
  'Crea cotizaciones en segundos',
  'IGV automático configurable',
  '10 tipos de documentos',
  'Planes desde S/ 0/mes'
];

features.forEach((feature, i) => {
  const y = 290 + i * 55;
  
  // Circle background
  ctx.beginPath();
  ctx.arc(576, y + 16, 16, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fill();
  
  // Checkmark in circle
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(568, y + 16);
  ctx.lineTo(574, y + 22);
  ctx.lineTo(586, y + 10);
  ctx.stroke();
  
  // Feature text
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '22px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(feature, 608, y + 6);
});

// CTA Badge
const ctaX = 560;
const ctaY = 500;
const ctaW = 200;
const ctaH = 52;
roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 26);
ctx.fillStyle = '#ffffff';
ctx.fill();

ctx.fillStyle = '#1e40af';
ctx.font = 'bold 20px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
ctx.textAlign = 'center';
ctx.fillText('¡PRUEBA GRATIS!', ctaX + ctaW / 2, ctaY + 16);
ctx.textAlign = 'start';

// Bottom URL bar
ctx.fillStyle = 'rgba(255,255,255,0.1)';
roundRect(ctx, 100, 560, 350, 40, 20);
ctx.fill();

ctx.fillStyle = 'rgba(255,255,255,0.8)';
ctx.font = '16px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
ctx.fillText('cotizador-pro.pages.dev', 120, 574);

// Helper function for rounded rectangles
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Save to PNG
const outputPath = resolve(__dirname, '..', 'public', 'og-image.png');
const buffer = canvas.toBuffer('image/png');
writeFileSync(outputPath, buffer);
console.log(`✅ OG Image generated: ${outputPath}`);
console.log(`   Size: ${width}x${height}`);
