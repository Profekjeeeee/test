import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/main", destination: "/screens/03_Main", permanent: false },
      { source: "/admin", destination: "/screens/admin/dashboard", permanent: false },
      { source: "/admin/feed", destination: "/screens/admin/feed", permanent: false },
      { source: "/admin/doctors", destination: "/screens/admin/doctors", permanent: false },
      { source: "/admin/price", destination: "/screens/admin/price", permanent: false },
    ];
  },
};

export default nextConfig;
