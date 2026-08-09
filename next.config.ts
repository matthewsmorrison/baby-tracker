import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Client-cache page segments briefly so hopping between tabs is instant
    // instead of a fresh server round-trip every tap (and there's no long
    // in-flight navigation window for a second tap to get lost in).
    // Freshness is preserved elsewhere: logging calls router.refresh(),
    // server actions revalidate, and RefreshOnResume refetches on app resume.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
