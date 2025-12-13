const sharp = require('sharp');
const fs = require('fs');

// Phoenix-style gradient - fiery orange/red/purple
const size = 1024;
const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>
  <defs>
    <linearGradient id='phoenixGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' style='stop-color:#FF6B35'/>
      <stop offset='25%' style='stop-color:#F7931E'/>
      <stop offset='50%' style='stop-color:#FF4757'/>
      <stop offset='75%' style='stop-color:#C44569'/>
      <stop offset='100%' style='stop-color:#8B5CF6'/>
    </linearGradient>
    <linearGradient id='glowGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' style='stop-color:#FFD93D'/>
      <stop offset='100%' style='stop-color:#FF6B6B'/>
    </linearGradient>
    <filter id='glow'>
      <feGaussianBlur stdDeviation='15' result='coloredBlur'/>
      <feMerge>
        <feMergeNode in='coloredBlur'/>
        <feMergeNode in='SourceGraphic'/>
      </feMerge>
    </filter>
  </defs>
  <rect width='${size}' height='${size}' rx='220' fill='url(#phoenixGrad)'/>
  <text x='50%' y='58%' dominant-baseline='middle' text-anchor='middle' 
        font-family='Georgia, Times, serif' font-size='680' font-weight='bold' 
        font-style='italic' fill='white' filter='url(#glow)'>F</text>
</svg>`;

async function createIcons() {
  const svgBuffer = Buffer.from(svg);
  
  // Main icon (1024x1024)
  await sharp(svgBuffer).resize(1024, 1024).png().toFile('assets/icon.png');
  console.log('Created icon.png (1024x1024)');
  
  // Adaptive icon for Android (1024x1024)
  await sharp(svgBuffer).resize(1024, 1024).png().toFile('assets/adaptive-icon.png');
  console.log('Created adaptive-icon.png (1024x1024)');
  
  // Splash icon (512x512)
  await sharp(svgBuffer).resize(512, 512).png().toFile('assets/splash-icon.png');
  console.log('Created splash-icon.png (512x512)');
  
  // Favicon (48x48)
  await sharp(svgBuffer).resize(48, 48).png().toFile('assets/favicon.png');
  console.log('Created favicon.png (48x48)');
  
  console.log('\n✅ All Phoenix-style icons created successfully!');
}

createIcons().catch(console.error);
