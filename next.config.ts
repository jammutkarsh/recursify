/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // App pages render from client state (AppData), so their server payload never changes.
  // Keep it in the router cache so switching tabs doesn't wait on the Worker.
  experimental: { staleTimes: { dynamic: 300, static: 300 } },
};

export default nextConfig;
