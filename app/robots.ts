import type { MetadataRoute } from "next";
import { WEBSITE } from "@/lib/legal";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // App areas sit behind auth and hold personal data — keep crawlers out.
      disallow: [
        "/api/",
        "/today",
        "/profile",
        "/onboarding",
        "/report",
        "/friends",
        "/invite",
      ],
    },
    sitemap: `https://${WEBSITE}/sitemap.xml`,
  };
}
