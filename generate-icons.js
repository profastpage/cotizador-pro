const fs = require('fs');
const { createCanvas } = require('canvas');

// Icon sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create icons directory if it doesn't exist
if (!fs.existsSync('./icons')) {
  fs.mkdirSync('./icons', { recursive: true });
}

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  const radius = size * 0.125;
  ctx.fillStyle = '#1e40af';
  roundRect(ctx, 0, 0, size, size, radius);
  ctx.fill();
  
  // Document
  const docMargin = size * 0.1875;
  const docWidth = size * 0.625;
  const docHeight = size * 0.5;
  const docRadius = size * 0.03125;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  roundRect(ctx, docMargin, docMargin, docWidth, docHeight, docRadius);
  ctx.fill();
  
  // Document lines
  ctx.fillStyle = '#1e40af';
  roundRect(ctx, docMargin + size * 0.0625, docMargin + size * 0.0625, size * 0.234, size * 0.023, size * 0.012);
  ctx.fill();
  
  ctx.fillStyle = '#94a3b8';
  roundRect(ctx, docMargin + size * 0.0625, docMargin + size * 0.109, size * 0.156, size * 0.016, size * 0.008);
  ctx.fill();
  
  ctx.fillStyle = '#e2e8f0';
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, docMargin + size * 0.0625, docMargin + size * 0.172 + (i * size * 0.047), size * (0.4 - i * 0.04), size * 0.008, size * 0.004);
    ctx.fill();
  }
  
  // Total box
  ctx.fillStyle = '#059669';
  const boxSize = size * 0.125;
  roundRect(ctx, docMargin + size * 0.39, docMargin + size * 0.344, boxSize, boxSize * 0.375, boxSize * 0.1875);
  ctx.fill();
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`./icons/icon-${size}x${size}.png`, buffer);
  console.log(`Created icon-${size}x${size}.png`);
});

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

console.log('Icons generated successfully!');
