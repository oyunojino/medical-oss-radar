/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
  // lib/sbom.ts and lib/osv.ts list/read sboms/ and vulns/ at runtime via
  // fs.readdir + dynamic filenames, which Next's build-time file tracing can't
  // follow statically — without this, those directories get dropped from the
  // serverless function bundle and every page would 404 on Vercel.
  experimental: {
    outputFileTracingIncludes: {
      "/sbom": ["./sboms/**/*"],
      "/sbom/**": ["./sboms/**/*"],
      "/vulnerabilities": ["./vulns/**/*"],
      "/vulnerabilities/**": ["./vulns/**/*"],
    },
  },
};

export default nextConfig;
