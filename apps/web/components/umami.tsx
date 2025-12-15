import Script from "next/script";

export function Umami() {
  return (
    <Script
      src="/script.js"
      data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
      data-host-url={process.env.NEXT_PUBLIC_UMAMI_HOST_URL}
      data-exclude-hash="true"
    />
  );
}
