// Allow phones on the same LAN to use `next dev` during local mobile testing.
// Update these origins when the workstation IP changes, then restart the dev server.
const allowedDevOrigins = ['10.0.0.16']

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins,
}

module.exports = nextConfig
