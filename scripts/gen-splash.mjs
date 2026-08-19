// Generates iOS PWA startup images (apple-touch-startup-image) into
// public/splash/: solid theme background + centred app icon, one per common
// iPhone viewport, in light and dark. Without these, iOS paints a plain
// (often white) fill while the standalone app launches. Rerun after changing
// the icon or theme colours:  node scripts/gen-splash.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";

// [CSS width, CSS height, devicePixelRatio] — keep in sync with the
// startupImage list in app/layout.tsx.
const VIEWPORTS = [
  [375, 667, 2], // iPhone SE/8
  [414, 896, 2], // iPhone XR/11
  [375, 812, 3], // iPhone X/XS/11 Pro/12-13 mini
  [390, 844, 3], // iPhone 12/13/14
  [393, 852, 3], // iPhone 14 Pro/15/16
  [402, 874, 3], // iPhone 16 Pro
  [428, 926, 3], // iPhone 12/13 Pro Max/14 Plus
  [430, 932, 3], // iPhone 14 Pro Max/15 Plus/16 Plus
  [440, 956, 3], // iPhone 16 Pro Max
];

const THEMES = {
  light: "#ede9e1",
  dark: "#16140f",
};

mkdirSync("public/splash", { recursive: true });

for (const [w, h, r] of VIEWPORTS) {
  const width = w * r;
  const height = h * r;
  const iconSize = Math.round(width * 0.28);
  const icon = await sharp("public/icons/icon-192.png")
    .resize(iconSize, iconSize)
    .toBuffer();
  for (const [name, background] of Object.entries(THEMES)) {
    await sharp({
      create: { width, height, channels: 3, background },
    })
      .composite([{ input: icon, gravity: "center" }])
      .png({ palette: true })
      .toFile(`public/splash/splash-${width}x${height}-${name}.png`);
  }
}
console.log("splash images written to public/splash/");
