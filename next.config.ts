import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  // Allow external tunnel origins in development so client scripts hydrate correctly.
  allowedDevOrigins: ["bribe-clubhouse-gusto.ngrok-free.dev"],
};

export default nextConfig;
