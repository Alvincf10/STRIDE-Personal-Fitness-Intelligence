import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/overview", destination: "/home", permanent: false },
      { source: "/running", destination: "/activities", permanent: false },
      {
        source: "/running/:id",
        destination: "/activities/:id",
        permanent: false,
      },
      {
        source: "/recommendations",
        destination: "/coach",
        permanent: false,
      },
      { source: "/history", destination: "/journey", permanent: false },
      { source: "/heart-rate", destination: "/recovery", permanent: false },
    ];
  },
};

export default nextConfig;
