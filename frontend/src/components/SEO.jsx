import { Helmet } from "react-helmet-async";
import { useSite } from "../lib/site";

function absUrl(u) {
  if (!u) return u;
  if (u.startsWith("http")) return u;
  return `${process.env.REACT_APP_BACKEND_URL || ""}${u}`;
}

/**
 * Page-level SEO + social-share meta tags. Falls back to sitewide settings.
 * Props:
 *   - title  page title (will be combined with site name)
 *   - description meta description (160 char max recommended)
 *   - image  og:image / twitter:image (absolute or path)
 *   - url    canonical URL (defaults to current location)
 *   - type   og:type ("website" | "article" | "product")
 *   - noindex  true → adds <meta robots="noindex">
 */
export default function SEO({ title, description, image, url, type = "website", noindex = false }) {
  const site = useSite() || {};
  const siteName = site.site_name || "Myrtle and Ray";
  const fullTitle = title ? `${title} — ${siteName}` : (site.seo_title_default || `${siteName} · Catch the W.A.V.E. of Excitement`);
  const desc = description || site.meta_description_default || "Catch the W.A.V.E. of Excitement with Myrtle and Ray — a book about being brave on the first day of camp.";
  const img = absUrl(image || site.og_image_default || site.logo_url || "");
  const finalUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <link rel="canonical" href={finalUrl} />
      {/* Open Graph */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={finalUrl} />
      {img && <meta property="og:image" content={img} />}
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      {img && <meta name="twitter:image" content={img} />}
    </Helmet>
  );
}
