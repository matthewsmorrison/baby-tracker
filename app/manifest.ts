import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beanlo — newborn tracker",
    short_name: "Beanlo",
    description:
      "Track nappies, feeds and weight in the first days and weeks. A tracking aid, not medical advice.",
    start_url: "/today",
    display: "standalone",
    background_color: "#EDE9E1",
    theme_color: "#EDE9E1",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
