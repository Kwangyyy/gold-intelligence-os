// Generates a simple SVG icon for PWA, served as image/svg+xml.
// For production you'd replace with proper PNG files in /public.
// Referenced in manifest.json — browsers accept SVG icons for PWA.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildSvg(size: number): string {
  const r = size / 2;
  const inner = size * 0.3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1a2340"/>
      <stop offset="100%" stop-color="#06091a"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f5c451" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#f5c451" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="${r}" cy="${r}" r="${r}" fill="url(#bg)"/>
  <circle cx="${r}" cy="${r}" r="${inner * 1.6}" fill="url(#glow)"/>
  <text x="${r}" y="${r + inner * 0.38}" text-anchor="middle" font-family="Georgia,serif" font-size="${inner}" font-weight="bold" fill="#f5c451">Au</text>
  <circle cx="${r}" cy="${r}" r="${r - 2}" fill="none" stroke="#f5c451" stroke-width="${size * 0.025}" stroke-opacity="0.6"/>
</svg>`;
}

export async function GET(req: NextRequest) {
  const size = parseInt(new URL(req.url).searchParams.get("size") ?? "192");
  const clamp = Math.min(512, Math.max(16, size));
  return new NextResponse(buildSvg(clamp), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
