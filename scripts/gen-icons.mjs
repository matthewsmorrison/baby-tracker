import sharp from "sharp";

const flame = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#F6E3C6"/>
  <g transform="translate(256 261) scale(${scale}) translate(-12 -12)">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
      fill="none" stroke="#E9A23B" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const out = "public/icons";
await sharp(Buffer.from(flame(13))).resize(512, 512).png().toFile(`${out}/icon-512.png`);
await sharp(Buffer.from(flame(13))).resize(192, 192).png().toFile(`${out}/icon-192.png`);
await sharp(Buffer.from(flame(10))).resize(512, 512).png().toFile(`${out}/maskable-512.png`);
await sharp(Buffer.from(flame(13))).resize(180, 180).png().toFile(`${out}/apple-touch-icon.png`);
console.log("icons written");
