import { createServerFn } from "@tanstack/react-start";
import * as cheerio from "cheerio";
import { z } from "zod";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Status = "pass" | "warning" | "fail";

export interface Check {
  id: string;
  category: string;
  name: string;
  status: Status;
  severity: Severity;
  value?: string | number | null;
  why: string;
  fix: string;
  example?: string;
}

export interface SeoReport {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  statusCode: number;
  responseTimeMs: number;
  screenshotUrl: string;
  scores: {
    overall: number;
    seo: number;
    performance: number;
    accessibility: number;
    bestPractices: number;
    security: number;
  };
  categories: Record<string, Check[]>;
  headings: { level: number; text: string }[];
  headingCounts: Record<string, number>;
  images: {
    total: number;
    withAlt: number;
    missingAlt: number;
    emptyAlt: number;
    lazy: number;
    modernFormat: number;
    samples: { src: string; alt: string | null; loading: string | null }[];
  };
  links: {
    total: number;
    internal: number;
    external: number;
    nofollow: number;
    mailto: number;
    tel: number;
    samples: { href: string; text: string; type: string }[];
  };
  content: {
    wordCount: number;
    readingTimeMin: number;
    topKeywords: { word: string; count: number; density: number }[];
  };
  performance: {
    htmlSizeKb: number;
    cssRequests: number;
    jsRequests: number;
    imageRequests: number;
    totalRequests: number;
    domNodes: number;
  };
  openGraph: Record<string, string | null>;
  twitter: Record<string, string | null>;
  meta: Record<string, string | null>;
  recommendations: Check[];
}

const InputSchema = z.object({ url: z.string().min(3) });

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function severityScore(sev: Severity): number {
  return { critical: 15, high: 10, medium: 5, low: 2, info: 0 }[sev];
}

export const analyzeUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<SeoReport> => {
    const url = normalizeUrl(data.url);
    const parsed = new URL(url);
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LovableSEOBot/1.0; +https://lovable.dev)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (e) {
      throw new Error(`Could not fetch ${url}: ${(e as Error).message}`);
    }

    const html = await response.text();
    const responseTimeMs = Date.now() - startedAt;
    const $ = cheerio.load(html);

    const checks: Check[] = [];
    const add = (c: Check) => checks.push(c);

    // ---------- Basic SEO ----------
    const title = $("head > title").text().trim();
    add({
      id: "title",
      category: "Basic SEO",
      name: "Title Tag",
      value: title || null,
      status: !title ? "fail" : title.length < 30 || title.length > 65 ? "warning" : "pass",
      severity: !title ? "critical" : "medium",
      why: "The title appears in search results and browser tabs. It is one of the strongest on-page ranking signals.",
      fix: "Write a unique, keyword-rich title between 30 and 60 characters that describes the page.",
      example: `<title>Best Running Shoes for Beginners – Acme</title>`,
    });

    const desc = $('meta[name="description"]').attr("content")?.trim() || "";
    add({
      id: "description",
      category: "Basic SEO",
      name: "Meta Description",
      value: desc || null,
      status: !desc ? "fail" : desc.length < 70 || desc.length > 160 ? "warning" : "pass",
      severity: !desc ? "high" : "medium",
      why: "Meta descriptions are shown as the snippet in search results and drive click-through rate.",
      fix: "Write a compelling 70–160 character summary that includes your primary keyword.",
      example: `<meta name="description" content="Discover the top 10 running shoes for beginners in 2025." />`,
    });

    const keywords = $('meta[name="keywords"]').attr("content")?.trim() || "";
    add({
      id: "keywords",
      category: "Basic SEO",
      name: "Meta Keywords",
      value: keywords || null,
      status: keywords ? "pass" : "warning",
      severity: "low",
      why: "Most search engines ignore this tag, but some third-party crawlers still use it.",
      fix: "Optional. Include a short comma-separated list if targeting niche search engines.",
      example: `<meta name="keywords" content="running shoes, marathon, training" />`,
    });

    const canonical = $('link[rel="canonical"]').attr("href") || "";
    add({
      id: "canonical",
      category: "Basic SEO",
      name: "Canonical URL",
      value: canonical || null,
      status: canonical ? "pass" : "warning",
      severity: "medium",
      why: "Canonical URLs prevent duplicate content issues by pointing search engines at the preferred version.",
      fix: "Add a canonical link pointing to the definitive URL of the page.",
      example: `<link rel="canonical" href="https://example.com/page" />`,
    });

    const robotsMeta = $('meta[name="robots"]').attr("content") || "";
    add({
      id: "robots-meta",
      category: "Basic SEO",
      name: "Robots Meta Tag",
      value: robotsMeta || "index, follow (default)",
      status: /noindex/i.test(robotsMeta) ? "warning" : "pass",
      severity: /noindex/i.test(robotsMeta) ? "high" : "low",
      why: "Controls whether search engines index the page and follow its links.",
      fix: 'Use `index, follow` for public pages. Only use `noindex` when the page must not appear in search.',
      example: `<meta name="robots" content="index, follow" />`,
    });

    const charset = $("meta[charset]").attr("charset") || "";
    add({
      id: "charset",
      category: "Basic SEO",
      name: "Charset",
      value: charset || null,
      status: charset ? "pass" : "fail",
      severity: "medium",
      why: "Declaring the character set prevents rendering issues with special characters.",
      fix: "Add a charset meta tag as the first element in <head>.",
      example: `<meta charset="UTF-8" />`,
    });

    const lang = $("html").attr("lang") || "";
    add({
      id: "language",
      category: "Basic SEO",
      name: "Language",
      value: lang || null,
      status: lang ? "pass" : "fail",
      severity: "medium",
      why: "Declaring the language helps search engines serve your page to the right audience.",
      fix: "Add a lang attribute to the <html> element.",
      example: `<html lang="en">`,
    });

    const viewport = $('meta[name="viewport"]').attr("content") || "";
    add({
      id: "viewport",
      category: "Basic SEO",
      name: "Viewport",
      value: viewport || null,
      status: viewport ? "pass" : "fail",
      severity: "high",
      why: "A viewport tag is required for responsive rendering on mobile devices.",
      fix: "Add a viewport meta tag.",
      example: `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
    });

    const favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      "";
    add({
      id: "favicon",
      category: "Basic SEO",
      name: "Favicon",
      value: favicon || null,
      status: favicon ? "pass" : "warning",
      severity: "low",
      why: "Favicons appear in browser tabs and search results and reinforce brand identity.",
      fix: "Add a favicon link to <head>.",
      example: `<link rel="icon" href="/favicon.ico" />`,
    });

    // sitemap + robots.txt fetch
    const origin = `${parsed.protocol}//${parsed.host}`;
    const [sitemapRes, robotsRes] = await Promise.all([
      fetch(`${origin}/sitemap.xml`).catch(() => null),
      fetch(`${origin}/robots.txt`).catch(() => null),
    ]);
    const sitemapOk = !!sitemapRes && sitemapRes.ok;
    const robotsOk = !!robotsRes && robotsRes.ok;
    add({
      id: "sitemap",
      category: "Basic SEO",
      name: "sitemap.xml",
      value: sitemapOk ? `${origin}/sitemap.xml` : "Not found",
      status: sitemapOk ? "pass" : "fail",
      severity: "high",
      why: "Sitemaps help search engines discover and crawl every page of your site.",
      fix: "Generate and serve a sitemap.xml at the site root.",
      example: `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">…</urlset>`,
    });
    add({
      id: "robots-txt",
      category: "Basic SEO",
      name: "robots.txt",
      value: robotsOk ? `${origin}/robots.txt` : "Not found",
      status: robotsOk ? "pass" : "warning",
      severity: "medium",
      why: "robots.txt tells crawlers which parts of your site to index.",
      fix: "Serve a robots.txt file at the site root.",
      example: `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml`,
    });

    // ---------- Headings ----------
    const headings: { level: number; text: string }[] = [];
    const headingCounts: Record<string, number> = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
    for (const level of [1, 2, 3, 4, 5, 6]) {
      $(`h${level}`).each((_, el) => {
        headings.push({ level, text: $(el).text().trim() });
        headingCounts[`h${level}`]++;
      });
    }
    const h1Count = headingCounts.h1;
    add({
      id: "h1",
      category: "Headings",
      name: "H1 Tag",
      value: h1Count,
      status: h1Count === 1 ? "pass" : h1Count === 0 ? "fail" : "warning",
      severity: h1Count === 0 ? "critical" : h1Count > 1 ? "medium" : "low",
      why: "Each page should have exactly one H1 that clearly describes its topic.",
      fix: "Ensure exactly one <h1> per page containing your primary keyword.",
      example: `<h1>Best Running Shoes for Beginners</h1>`,
    });
    const emptyHeadings = headings.filter((h) => !h.text).length;
    add({
      id: "empty-headings",
      category: "Headings",
      name: "Empty Headings",
      value: emptyHeadings,
      status: emptyHeadings === 0 ? "pass" : "warning",
      severity: emptyHeadings ? "medium" : "low",
      why: "Empty headings confuse assistive technology and dilute content structure.",
      fix: "Remove empty heading tags or add meaningful text.",
    });

    // ---------- Images ----------
    const imgs = $("img").toArray();
    let withAlt = 0,
      emptyAlt = 0,
      lazy = 0,
      modern = 0;
    const imageSamples: { src: string; alt: string | null; loading: string | null }[] = [];
    for (const el of imgs) {
      const alt = $(el).attr("alt");
      const src = $(el).attr("src") || "";
      const loading = $(el).attr("loading") || null;
      if (alt !== undefined && alt.trim().length > 0) withAlt++;
      else if (alt === "") emptyAlt++;
      if (loading === "lazy") lazy++;
      if (/\.(webp|avif)(\?|$)/i.test(src)) modern++;
      if (imageSamples.length < 10) imageSamples.push({ src, alt: alt ?? null, loading });
    }
    const missingAlt = imgs.length - withAlt - emptyAlt;
    add({
      id: "img-alt",
      category: "Images",
      name: "Missing ALT Text",
      value: missingAlt,
      status: missingAlt === 0 ? "pass" : missingAlt < 3 ? "warning" : "fail",
      severity: missingAlt > 0 ? "high" : "low",
      why: "Alt text describes images to search engines and screen readers.",
      fix: "Add a descriptive alt attribute to every meaningful <img>.",
      example: `<img src="shoes.jpg" alt="Red running shoes on a track" />`,
    });
    add({
      id: "img-lazy",
      category: "Images",
      name: "Lazy Loading",
      value: `${lazy}/${imgs.length}`,
      status: imgs.length === 0 || lazy / Math.max(imgs.length, 1) > 0.5 ? "pass" : "warning",
      severity: "low",
      why: "Lazy-loading offscreen images improves page speed and Core Web Vitals.",
      fix: 'Add loading="lazy" to non-critical images.',
      example: `<img src="hero.jpg" alt="…" loading="lazy" />`,
    });
    add({
      id: "img-modern",
      category: "Images",
      name: "Modern Image Formats (WebP/AVIF)",
      value: `${modern}/${imgs.length}`,
      status: imgs.length === 0 || modern > 0 ? "pass" : "warning",
      severity: "medium",
      why: "WebP and AVIF are 25-50% smaller than JPEG/PNG at the same quality.",
      fix: "Convert images to WebP or AVIF.",
    });

    // ---------- Links ----------
    const linkEls = $("a[href]").toArray();
    let internal = 0,
      external = 0,
      nofollow = 0,
      mailto = 0,
      tel = 0;
    const linkSamples: { href: string; text: string; type: string }[] = [];
    for (const el of linkEls) {
      const href = $(el).attr("href") || "";
      const rel = $(el).attr("rel") || "";
      let type = "internal";
      if (href.startsWith("mailto:")) {
        mailto++;
        type = "mail";
      } else if (href.startsWith("tel:")) {
        tel++;
        type = "phone";
      } else if (/^https?:\/\//i.test(href)) {
        try {
          const u = new URL(href);
          if (u.host === parsed.host) {
            internal++;
            type = "internal";
          } else {
            external++;
            type = "external";
          }
        } catch {
          internal++;
        }
      } else {
        internal++;
      }
      if (/nofollow/i.test(rel)) nofollow++;
      if (linkSamples.length < 15)
        linkSamples.push({ href, text: $(el).text().trim().slice(0, 80), type });
    }
    add({
      id: "internal-links",
      category: "Links",
      name: "Internal Links",
      value: internal,
      status: internal >= 3 ? "pass" : "warning",
      severity: "medium",
      why: "Internal links spread PageRank and help crawlers discover more pages.",
      fix: "Link to related content from within the page.",
    });
    add({
      id: "external-links",
      category: "Links",
      name: "External Links",
      value: external,
      status: "pass",
      severity: "low",
      why: "External links to authoritative sources add credibility.",
      fix: "Use rel=noopener and consider rel=nofollow for untrusted sources.",
    });

    // ---------- Open Graph ----------
    const og: Record<string, string | null> = {};
    for (const k of ["title", "description", "image", "url", "type"]) {
      const v = $(`meta[property="og:${k}"]`).attr("content") || null;
      og[k] = v;
      add({
        id: `og-${k}`,
        category: "Open Graph",
        name: `og:${k}`,
        value: v,
        status: v ? "pass" : "warning",
        severity: k === "image" || k === "title" ? "medium" : "low",
        why: "Open Graph tags control how pages appear when shared on Facebook, LinkedIn, and other platforms.",
        fix: `Add <meta property="og:${k}" content="…" /> to <head>.`,
        example: `<meta property="og:${k}" content="…" />`,
      });
    }

    // ---------- Twitter ----------
    const tw: Record<string, string | null> = {};
    for (const k of ["card", "title", "description", "image"]) {
      const v = $(`meta[name="twitter:${k}"]`).attr("content") || null;
      tw[k] = v;
      add({
        id: `tw-${k}`,
        category: "Twitter",
        name: `twitter:${k}`,
        value: v,
        status: v ? "pass" : "warning",
        severity: "low",
        why: "Twitter Cards control how pages appear when shared on X/Twitter.",
        fix: `Add <meta name="twitter:${k}" content="…" /> to <head>.`,
      });
    }

    // ---------- Performance ----------
    const htmlSizeKb = Math.round((html.length / 1024) * 10) / 10;
    const cssRequests = $('link[rel="stylesheet"]').length;
    const jsRequests = $("script[src]").length;
    const imageRequests = imgs.length;
    const totalRequests = cssRequests + jsRequests + imageRequests + 1;
    const domNodes = $("*").length;
    add({
      id: "html-size",
      category: "Performance",
      name: "HTML Size",
      value: `${htmlSizeKb} KB`,
      status: htmlSizeKb < 100 ? "pass" : htmlSizeKb < 300 ? "warning" : "fail",
      severity: htmlSizeKb > 300 ? "high" : "medium",
      why: "Smaller HTML loads faster and improves Core Web Vitals.",
      fix: "Minify HTML and remove unused markup.",
    });
    add({
      id: "dom-size",
      category: "Performance",
      name: "DOM Nodes",
      value: domNodes,
      status: domNodes < 1500 ? "pass" : domNodes < 3000 ? "warning" : "fail",
      severity: domNodes > 3000 ? "high" : "medium",
      why: "A large DOM slows down rendering and JavaScript execution.",
      fix: "Simplify markup and lazy-render off-screen sections.",
    });
    add({
      id: "js-requests",
      category: "Performance",
      name: "JavaScript Requests",
      value: jsRequests,
      status: jsRequests < 15 ? "pass" : jsRequests < 30 ? "warning" : "fail",
      severity: jsRequests > 30 ? "high" : "medium",
      why: "Too many JS requests delay interactivity.",
      fix: "Bundle scripts and defer non-critical JavaScript.",
    });
    add({
      id: "css-requests",
      category: "Performance",
      name: "CSS Requests",
      value: cssRequests,
      status: cssRequests < 6 ? "pass" : "warning",
      severity: "low",
      why: "Extra stylesheets block first paint.",
      fix: "Combine and minify CSS.",
    });

    // ---------- Security ----------
    const https = parsed.protocol === "https:";
    add({
      id: "https",
      category: "Security",
      name: "HTTPS",
      value: parsed.protocol,
      status: https ? "pass" : "fail",
      severity: "critical",
      why: "HTTPS is required for user trust, SEO, and modern browser features.",
      fix: "Install an SSL certificate and redirect HTTP to HTTPS.",
    });
    const hsts = response.headers.get("strict-transport-security");
    add({
      id: "hsts",
      category: "Security",
      name: "HSTS Header",
      value: hsts || null,
      status: hsts ? "pass" : "warning",
      severity: "medium",
      why: "HSTS instructs browsers to only use HTTPS for your domain.",
      fix: "Send a Strict-Transport-Security header.",
      example: `Strict-Transport-Security: max-age=31536000; includeSubDomains`,
    });
    const csp = response.headers.get("content-security-policy");
    add({
      id: "csp",
      category: "Security",
      name: "Content Security Policy",
      value: csp ? "present" : null,
      status: csp ? "pass" : "warning",
      severity: "medium",
      why: "CSP mitigates XSS and data injection attacks.",
      fix: "Add a Content-Security-Policy header.",
    });
    const xfo = response.headers.get("x-frame-options");
    add({
      id: "x-frame-options",
      category: "Security",
      name: "X-Frame-Options",
      value: xfo,
      status: xfo ? "pass" : "warning",
      severity: "low",
      why: "Prevents click-jacking by forbidding your page from being framed.",
      fix: "Send X-Frame-Options: SAMEORIGIN.",
    });
    const mixed = https && /http:\/\//.test(html.replace(/http:\/\/(www\.)?w3\.org/g, ""));
    add({
      id: "mixed-content",
      category: "Security",
      name: "Mixed Content",
      value: mixed ? "Detected" : "None",
      status: mixed ? "warning" : "pass",
      severity: mixed ? "high" : "low",
      why: "Loading HTTP resources on HTTPS pages triggers browser warnings.",
      fix: "Serve all assets over HTTPS.",
    });

    // ---------- Accessibility ----------
    const buttonsMissing = $("button").filter((_, el) => !$(el).text().trim() && !$(el).attr("aria-label")).length;
    add({
      id: "button-labels",
      category: "Accessibility",
      name: "Button Labels",
      value: buttonsMissing,
      status: buttonsMissing === 0 ? "pass" : "warning",
      severity: buttonsMissing > 0 ? "medium" : "low",
      why: "Screen readers need accessible names for every interactive control.",
      fix: "Add visible text or aria-label to every <button>.",
    });
    const inputsMissing = $("input, textarea, select")
      .filter((_, el) => {
        const id = $(el).attr("id");
        const aria = $(el).attr("aria-label");
        if (aria) return false;
        if (id && $(`label[for="${id}"]`).length > 0) return false;
        return true;
      }).length;
    add({
      id: "form-labels",
      category: "Accessibility",
      name: "Form Labels",
      value: inputsMissing,
      status: inputsMissing === 0 ? "pass" : "warning",
      severity: inputsMissing > 0 ? "medium" : "low",
      why: "Every form control needs an associated label for accessibility.",
      fix: "Associate a <label for> or aria-label with every input.",
    });

    // ---------- Mobile ----------
    add({
      id: "responsive",
      category: "Mobile",
      name: "Responsive Viewport",
      value: viewport,
      status: /width=device-width/i.test(viewport) ? "pass" : "fail",
      severity: "high",
      why: "Without a responsive viewport, pages do not scale on mobile.",
      fix: 'Use <meta name="viewport" content="width=device-width, initial-scale=1" />.',
    });

    // ---------- Technical / Structured data ----------
    const jsonLd = $('script[type="application/ld+json"]').toArray();
    add({
      id: "structured-data",
      category: "Technical SEO",
      name: "Structured Data (JSON-LD)",
      value: jsonLd.length,
      status: jsonLd.length > 0 ? "pass" : "warning",
      severity: "medium",
      why: "Schema.org markup unlocks rich results in Google search.",
      fix: "Add JSON-LD structured data for your content type (Article, Product, FAQ, etc.).",
      example: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>`,
    });

    // ---------- Content ----------
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const words = bodyText.split(/\s+/).filter((w) => w.length > 2);
    const wordCount = words.length;
    const readingTimeMin = Math.max(1, Math.round(wordCount / 220));
    const stop = new Set(
      "the and for that with this from your you are but not have has was were will can our their them they what which when where why how all any also more than then into out over about very just like".split(
        " "
      )
    );
    const freq = new Map<string, number>();
    for (const w of words) {
      const k = w.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!k || k.length < 4 || stop.has(k)) continue;
      freq.set(k, (freq.get(k) || 0) + 1);
    }
    const topKeywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({
        word,
        count,
        density: Math.round((count / Math.max(wordCount, 1)) * 10000) / 100,
      }));
    add({
      id: "word-count",
      category: "Content",
      name: "Word Count",
      value: wordCount,
      status: wordCount > 300 ? "pass" : wordCount > 100 ? "warning" : "fail",
      severity: wordCount < 100 ? "high" : "medium",
      why: "Thin content ranks poorly. Long-form, useful content ranks best.",
      fix: "Aim for at least 600 words of substantive content on key pages.",
    });

    // Scores per category
    const categoryList = [
      "Basic SEO",
      "Headings",
      "Images",
      "Links",
      "Open Graph",
      "Twitter",
      "Performance",
      "Security",
      "Accessibility",
      "Mobile",
      "Technical SEO",
      "Content",
    ];
    const grouped: Record<string, Check[]> = {};
    for (const c of categoryList) grouped[c] = [];
    for (const c of checks) {
      grouped[c.category] = grouped[c.category] || [];
      grouped[c.category].push(c);
    }

    const scoreCategory = (arr: Check[]) => {
      if (!arr.length) return 100;
      let deduction = 0;
      for (const c of arr) {
        if (c.status === "fail") deduction += severityScore(c.severity);
        else if (c.status === "warning") deduction += Math.ceil(severityScore(c.severity) / 2);
      }
      return Math.max(0, Math.min(100, 100 - deduction));
    };

    const seoScore = scoreCategory([
      ...(grouped["Basic SEO"] || []),
      ...(grouped["Headings"] || []),
      ...(grouped["Open Graph"] || []),
      ...(grouped["Twitter"] || []),
      ...(grouped["Technical SEO"] || []),
      ...(grouped["Content"] || []),
    ]);
    const performanceScore = scoreCategory(grouped["Performance"] || []);
    const accessibilityScore = scoreCategory([
      ...(grouped["Accessibility"] || []),
      ...(grouped["Images"] || []),
    ]);
    const bestPracticesScore = scoreCategory([
      ...(grouped["Links"] || []),
      ...(grouped["Mobile"] || []),
    ]);
    const securityScore = scoreCategory(grouped["Security"] || []);
    const overall = Math.round(
      (seoScore + performanceScore + accessibilityScore + bestPracticesScore + securityScore) / 5
    );

    const recommendations = checks
      .filter((c) => c.status !== "pass")
      .sort((a, b) => severityScore(b.severity) - severityScore(a.severity));

    const meta: Record<string, string | null> = {
      title,
      description: desc,
      keywords,
      canonical,
      robots: robotsMeta,
      charset,
      lang,
      viewport,
      favicon,
    };

    const screenshotUrl = `https://image.thum.io/get/width/1200/crop/900/noanimate/${encodeURIComponent(url)}`;

    return {
      url,
      finalUrl: response.url || url,
      fetchedAt: new Date().toISOString(),
      statusCode: response.status,
      responseTimeMs,
      screenshotUrl,
      scores: {
        overall,
        seo: seoScore,
        performance: performanceScore,
        accessibility: accessibilityScore,
        bestPractices: bestPracticesScore,
        security: securityScore,
      },
      categories: grouped,
      headings,
      headingCounts,
      images: {
        total: imgs.length,
        withAlt,
        missingAlt,
        emptyAlt,
        lazy,
        modernFormat: modern,
        samples: imageSamples,
      },
      links: {
        total: linkEls.length,
        internal,
        external,
        nofollow,
        mailto,
        tel,
        samples: linkSamples,
      },
      content: { wordCount, readingTimeMin, topKeywords },
      performance: {
        htmlSizeKb,
        cssRequests,
        jsRequests,
        imageRequests,
        totalRequests,
        domNodes,
      },
      openGraph: og,
      twitter: tw,
      meta,
      recommendations,
    };
  });

const AiInput = z.object({
  url: z.string(),
  scores: z.record(z.string(), z.number()),
  issues: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      status: z.string(),
      severity: z.string(),
      value: z.union([z.string(), z.number(), z.null()]).optional(),
    })
  ),
});

export const aiRecommendations = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AiInput.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const prompt = `You are a senior SEO consultant. Analyze this SEO audit and produce prioritized, actionable recommendations.

URL: ${data.url}
Scores: ${JSON.stringify(data.scores)}
Top issues:
${data.issues
  .slice(0, 25)
  .map((i) => `- [${i.severity.toUpperCase()}] ${i.category} / ${i.name} (${i.status}) — value: ${i.value ?? "n/a"}`)
  .join("\n")}

Return a concise executive summary (2-3 sentences), then a prioritized list of the top 8 fixes. For each fix include: title, why it matters for SEO, exact step-by-step fix, an HTML code example, and estimated impact (low/medium/high). Use markdown.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert SEO consultant. Be direct, technical, and actionable." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI rate limit — please try again in a minute.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace billing.");
      throw new Error(`AI request failed [${res.status}]: ${body}`);
    }
    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "";
    return { content };
  });
