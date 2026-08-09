import type { MetadataRoute } from "next";
import { WEBSITE } from "@/lib/legal";
import { GUIDES } from "@/lib/guides";

const BASE = `https://${WEBSITE}`;
// Static publish date for the content set (kept out of render; sitemap is a
// build-time route). Bump when guides are substantially revised.
const PUBLISHED = "2026-07-12";

export default function sitemap(): MetadataRoute.Sitemap {
  const guides = GUIDES.map((g) => ({
    url: `${BASE}/guides/${g.slug}`,
    lastModified: PUBLISHED,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    { url: BASE, lastModified: PUBLISHED, changeFrequency: "weekly", priority: 1 },
    {
      url: `${BASE}/guides`,
      lastModified: PUBLISHED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...guides,
    { url: `${BASE}/privacy`, lastModified: PUBLISHED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: PUBLISHED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/cookies`, lastModified: PUBLISHED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/disclaimer`, lastModified: PUBLISHED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
