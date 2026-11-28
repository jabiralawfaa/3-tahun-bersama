import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next 16 memblokir resource dev untuk host selain "localhost". Akibatnya,
  // saat halaman dibuka lewat 127.0.0.1 (atau IP LAN dari HP) React tidak
  // pernah ter-hidrasi: dashboard tampil tapi tombol/upload tidak berfungsi.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
