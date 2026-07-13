import sharp from 'sharp';

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#080b19"/>
      <stop offset="0.52" stop-color="#13132f"/>
      <stop offset="1" stop-color="#21114a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#66d9ff"/>
      <stop offset="1" stop-color="#9b6cff"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="24"/></filter>
  </defs>
  <rect width="1200" height="630" rx="36" fill="url(#bg)"/>
  <circle cx="1040" cy="90" r="210" fill="#7552ff" opacity=".17" filter="url(#glow)"/>
  <circle cx="170" cy="600" r="250" fill="#32c7ff" opacity=".12" filter="url(#glow)"/>

  <g transform="translate(72 66)">
    <rect width="232" height="44" rx="22" fill="#171b36" stroke="#626b9c"/>
    <circle cx="27" cy="22" r="7" fill="#4df0b1"/>
    <text x="47" y="29" fill="#dce5ff" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2">LIVE DATA</text>
  </g>

  <text x="72" y="225" fill="#f6f7ff" font-family="Arial, sans-serif" font-size="74" font-weight="800" letter-spacing="-2">REAL ESTATE</text>
  <text x="72" y="303" fill="url(#accent)" font-family="Arial, sans-serif" font-size="74" font-weight="800" letter-spacing="3">ANALYTICS PRO</text>
  <text x="76" y="356" fill="#aeb9dd" font-family="Arial, sans-serif" font-size="26" font-weight="500" letter-spacing="2">8 PROPERTY TYPES · NATIONWIDE TRANSACTIONS</text>

  <g transform="translate(72 421)">
    <rect width="1056" height="145" rx="24" fill="#11152b" stroke="#353d69"/>
    <g fill="#2a3155">
      <rect x="38" y="71" width="43" height="44" rx="5"/>
      <rect x="98" y="47" width="43" height="68" rx="5"/>
      <rect x="158" y="59" width="43" height="56" rx="5"/>
      <rect x="218" y="26" width="43" height="89" rx="5"/>
      <rect x="278" y="43" width="43" height="72" rx="5"/>
    </g>
    <polyline points="380,96 470,75 555,82 650,48 742,58 850,28 972,39" fill="none" stroke="url(#accent)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="#8d77ff" stroke="#d7d0ff" stroke-width="3">
      <circle cx="380" cy="96" r="7"/><circle cx="470" cy="75" r="7"/><circle cx="555" cy="82" r="7"/>
      <circle cx="650" cy="48" r="7"/><circle cx="742" cy="58" r="7"/><circle cx="850" cy="28" r="7"/><circle cx="972" cy="39" r="7"/>
    </g>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile('site/real-estate-pro-og.png');
