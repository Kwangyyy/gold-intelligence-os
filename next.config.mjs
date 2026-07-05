/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Google account avatars (next/image in AuthButton) are served from
    // lh3/lh4/lh5.googleusercontent.com after Google OAuth sign-in.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
