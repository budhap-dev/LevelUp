---
id: web-performance
title: "Web Performance"
group: languages-frontend
tags: [performance, core-web-vitals]
level: Senior
estimatedMinutes: 60
related: [reactjs, caching, observability-sre]
lastReviewed: 2026-11-27
status: complete
---

## TL;DR

- Web performance is about **user-perceived speed and responsiveness**, measured best by **Core Web Vitals** from real users: **LCP** (loading, ≤ 2.5 s), **INP** (responsiveness, ≤ 200 ms) and **CLS** (visual stability, ≤ 0.1), at the 75th percentile.
- The biggest levers: **send less** (JavaScript, images, fonts), **send it sooner** (server rendering, CDN, caching, priority hints), and **keep the main thread free** (no long tasks).
- Use **field data** (RUM, CrUX) to know where users suffer and **lab tools** (Lighthouse, DevTools, WebPageTest) to diagnose.
- Enforce **performance budgets** in CI and watch third-party scripts — performance regresses by default as features are added.
- Speed is a business metric: faster pages improve conversion, engagement and SEO; make that case with your own data.

## Core Concepts

### Core Web Vitals

| Metric | Measures | Good (p75) | Common causes of poor scores |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | When the main content (largest image/text block) renders | ≤ 2.5 s | Slow server response, render-blocking resources, late-discovered or unoptimised hero images, client-side rendering |
| **INP** (Interaction to Next Paint) | Latency from user input to the next frame, across the visit | ≤ 200 ms | Long tasks, heavy event handlers, large re-renders, third-party scripts |
| **CLS** (Cumulative Layout Shift) | Unexpected layout movement | ≤ 0.1 | Images/ads/embeds without dimensions, late-loading fonts, injected banners |

INP replaced First Input Delay as a Core Web Vital in March 2024. Since Safari 26.2 (December 2025), LCP and INP can be measured in every major browser engine. CLS is still only reported by Chromium browsers, and CrUX only contains Chrome data. Supporting metrics: **TTFB** (server and network), **FCP** (first paint), **TBT** (total blocking time in lab tests, a proxy for INP).

### The critical rendering path

The browser fetches HTML, discovers CSS and JS, builds the DOM and CSSOM, runs scripts, computes layout and paints. **Render-blocking** CSS and synchronous scripts in the `<head>` delay first paint.
- Inline or prioritise critical CSS; load the rest without blocking.
- Use `defer` (ordered, after parsing) or `async` (whenever loaded) for scripts; type `module` scripts are deferred by default.
- Make the LCP resource discoverable in the initial HTML; boost it with `fetchpriority="high"` and preload when needed.
- Preconnect to critical third-party origins.

```html
<link rel="preconnect" href="https://images.example-cdn.com" crossorigin>
<link rel="preload" as="image" href="/hero-1200.avif" imagesrcset="/hero-800.avif 800w, /hero-1200.avif 1200w" imagesizes="100vw" fetchpriority="high">
<script type="module" src="/app.js"></script>
<img src="/hero-1200.avif" srcset="/hero-800.avif 800w, /hero-1200.avif 1200w" sizes="100vw"
     width="1200" height="600" alt="Autumn collection" fetchpriority="high">
<img src="/card.webp" width="400" height="300" alt="" loading="lazy" decoding="async">
```

### Images

Usually the heaviest bytes: modern formats (AVIF, WebP), responsive `srcset`/`sizes`, correct dimensions (width/height to prevent CLS), compression, `loading="lazy"` for below-the-fold images (never for the LCP image), image CDNs for on-the-fly resizing.

### JavaScript

Every byte of JS costs download, parse, compile and execute time on the main thread. Reduce it with code splitting, tree shaking, removing unused dependencies, server rendering/Server Components, lazy-loading heavy widgets, and moving work to Web Workers. Break up long tasks (> 50 ms) by yielding to the main thread.

### Fonts

Subset and self-host or use a fast font CDN, use WOFF2, preload the critical font, `font-display: swap` or `optional`, and size-adjusted fallbacks (`size-adjust`, `ascent-override`) to reduce layout shift when fonts swap.

### Caching and delivery

- Static assets with **content-hashed filenames** cached for a year (`Cache-Control: public, max-age=31536000, immutable`); HTML cached briefly or revalidated.
- **CDN** at the edge for static and cacheable dynamic content; **HTTP/2 or HTTP/3**; **Brotli** compression.
- **Service workers** for offline and repeat-visit speed; the **back/forward cache** (avoid `unload` handlers, which block it; Chrome has admitted many `Cache-Control: no-store` pages since 2025, but other browsers may still refuse them).
- **Speculative loading** (prefetch/prerender, e.g. the Speculation Rules API in Chromium) for likely next navigations.

### Worked example: breaking a 4.2 s LCP into its parts

A retailer's home page has a mobile LCP of 4.2 s at p75. The LCP element is the first slide of a hero carousel. RUM attribution from the `web-vitals` library splits the time into four sub-parts:

| Sub-part | Measured | Healthy share of LCP | Cause found | Fix | After |
|---|---|---|---|---|---|
| TTFB | 1.1 s | ~40% | HTML rendered at the origin on every request | Cache the HTML at the CDN for 60 s with `stale-while-revalidate` | 0.4 s |
| Resource load delay | **1.6 s** | < 10% | The carousel script inserted the hero `<img>` after the JavaScript bundle loaded | Put the first slide's `<img>` in the server HTML with `fetchpriority="high"` | 0.1 s |
| Resource load duration | 1.2 s | ~40% | A 900 KB JPEG served to every screen size | AVIF with `srcset`: ~140 KB on a phone | 0.5 s |
| Element render delay | 0.3 s | < 10% | 180 KB of render-blocking CSS | Inline the critical CSS and load the rest asynchronously | 0.2 s |
| **LCP** | **4.2 s** | | | | **~1.2 s** |

What the breakdown showed:
- The team's first instinct was to compress the image. That would have saved at most part of the 1.2 s load duration. The **biggest problem was load delay**: the browser couldn't start fetching the image for 1.6 s because it didn't know it existed.
- **Fix in order of size:** discoverability first, then the server, then bytes. Each fix targets one sub-part, so you can predict its effect before shipping it.
- **p75 values don't add up exactly.** The 75th percentile of each sub-part comes from different visits. Treat the breakdown as a guide to where the time goes, and confirm the real LCP in field data afterwards.

## How It Works

```mermaid
flowchart LR
  REQ["Navigation"] --> TTFB["TTFB: DNS, TLS, server/CDN response"]
  TTFB --> PARSE["Parse HTML, discover resources"]
  PARSE --> BLOCK["Render-blocking CSS / sync JS"]
  BLOCK --> FCP["First Contentful Paint"]
  FCP --> LCP["LCP: hero image or main text rendered"]
  LCP --> HYD["JS executes / hydrates"]
  HYD --> INT["User interactions: INP depends on long tasks"]
  INT --> SHIFT["Late content without reserved space → CLS"]
  RUM["RUM / CrUX field data"] -.-> LCP
  RUM -.-> INT
  RUM -.-> SHIFT
```

Each stage has its own fixes: server/CDN for TTFB, resource discovery and priority for LCP, less JS and shorter tasks for INP, reserved space for CLS.

### One interaction, as INP measures it

```mermaid
sequenceDiagram
  participant U as User
  participant M as Main thread
  participant H as Event handlers
  participant R as Rendering
  %% step: The page is still hydrating. A 180 ms task, hydrating the reviews widget, is running on the main thread.
  %% step: The user taps "Add to basket" 60 ms into that task. The browser receives the input, but the main thread is busy, so the event has to wait. This wait is the input delay.
  %% step: The long task ends 120 ms after the tap. That's the input delay: time the user spent waiting before any of your code ran.
  %% step: The browser dispatches the events (pointerdown, pointerup, click) to the handlers.
  %% step: The handlers update the basket state and send an analytics request synchronously. This processing time takes 90 ms.
  %% step: When the handlers finish, the browser has to recalculate styles, lay out and paint the changes.
  %% step: The state change re-rendered the whole 2,000-node product grid, not just the basket badge. Style, layout and paint take 60 ms. This is the presentation delay.
  %% step: The next frame is painted 270 ms after the tap. That is this interaction's latency. INP reports roughly the slowest interaction of the visit, so a page full of interactions like this one scores "needs improvement" (over 200 ms).
  %% step: Each phase has its own fix. Yield during hydration to cut the input delay, defer the analytics call to cut processing, and update only the badge to cut presentation. Together they bring this interaction to about 80 ms.
  Note over M: 180 ms hydration task running
  U->>M: Taps "Add to basket"
  M->>M: Task ends: input delay 120 ms
  M->>H: Dispatch pointerdown, pointerup, click
  H->>H: Update state, send analytics: processing 90 ms
  H->>R: Request style, layout and paint
  R->>R: Re-render whole grid: presentation 60 ms
  R-->>U: Next frame painted at 270 ms
  Note over U,R: Yield, defer and narrow the update: about 80 ms
```

## When to Use / Trade-offs

| Technique | Use when | Avoid when | Trade-off |
|---|---|---|---|
| SSR / static generation | Content pages, SEO, slow devices | Highly interactive apps behind login (CSR may be fine) | Faster LCP vs server cost and hydration |
| Code splitting / lazy loading | Large apps, rarely used features | Critical above-the-fold UI (don't lazy-load the LCP) | Smaller initial JS vs extra requests later |
| Preload | The LCP resource or critical font isn't discoverable early | Many resources (preloading everything delays the important ones) | Earlier fetch vs bandwidth contention |
| Image CDN | Many images, many sizes | Very few static images | Automatic optimisation vs vendor cost |
| Service worker caching | Repeat visits, offline needs | Simple sites where complexity isn't justified | Speed and offline vs update complexity |
| Prerender/speculation | Predictable next navigation | Expensive pages, analytics side effects | Instant navigation vs wasted resources |
| Web Workers | CPU-heavy client work | Small tasks | Responsiveness vs complexity |

## Common Pitfalls & Anti-patterns

- **Optimising lab scores only** — Lighthouse 100 on a fast laptop while real mobile users suffer.
- **Lazy-loading the LCP image** or hiding it behind client-side rendering.
- **Shipping huge JavaScript bundles** for mostly static content.
- **Unbounded third-party tags** — analytics, chat widgets and A/B testing scripts dominating main-thread time.
- **Images without dimensions** — layout shifts.
- **Preloading too much** — the important resources wait.
- **Blocking the bfcache** with `unload` listeners.
- **Averages instead of percentiles** — slow users hidden.
- **No budgets** — gradual regression with every feature.

## Real-world Scenario

**Context:** An e-commerce site saw mobile conversion lag desktop significantly. Field data (CrUX) showed mobile LCP p75 of 4.1 s, INP p75 of 380 ms and CLS of 0.22. The product page shipped 1.2 MB of JS, the hero image was a 900 KB JPEG discovered late via JavaScript, and 14 third-party scripts loaded synchronously.

**Decision:** Server-rendered product pages with the hero image in the initial HTML (AVIF/WebP, responsive sizes, `fetchpriority="high"`); route-level code splitting and removal of two heavy libraries; deferred non-essential third parties and moved some to a tag manager with consent gating and loading after interaction; reserved space for images, reviews widget and promo banner; font preload with size-adjusted fallback; RUM monitoring with per-template dashboards and CI budgets.

**Outcome:** Mobile LCP p75 dropped to 2.1 s, INP to 160 ms, CLS to 0.04. An A/B test on a subset of traffic showed a meaningful conversion uplift for the faster variant, which secured ongoing investment.

**What I'd do differently:** Establish third-party governance earlier — marketing re-added scripts within months until a review process and budget per script existed.

## Interview Questions

### What are the Core Web Vitals, and what do they measure? {#core-web-vitals}

**Level:** Foundation

**Model answer:**
Google's user-centric metrics, assessed at the **75th percentile** of real-user visits:
- **Largest Contentful Paint (LCP):** time until the largest visible content element (hero image, heading block) renders — perceived load speed. Good ≤ 2.5 s.
- **Interaction to Next Paint (INP):** responsiveness — the latency from user interactions (clicks, taps, key presses) to the next frame, considering interactions throughout the visit. Good ≤ 200 ms. It replaced First Input Delay in March 2024.
- **Cumulative Layout Shift (CLS):** visual stability — how much visible content moves unexpectedly. Good ≤ 0.1.

They matter for user experience, conversion and search ranking signals. Measure them with real-user data (CrUX, RUM libraries like `web-vitals`) and diagnose with lab tools.

**What the interviewer is looking for:**
Accurate definitions, thresholds, p75, INP replacing FID and field measurement.

**Follow-ups:**
- Why the 75th percentile?
- What's TTFB's relationship to LCP?

**Red flags:**
- Still citing FID as a Core Web Vital.

### Explain the critical rendering path and how to optimise it. {#critical-rendering-path}

**Level:** Foundation

**Model answer:**
To render, the browser: downloads HTML → parses it into the DOM, discovering CSS, JS, images and fonts → downloads CSS and builds the CSSOM (CSS is **render-blocking**) → executes scripts (synchronous scripts block parsing) → combines DOM and CSSOM into a render tree → computes layout → paints and composites.

Optimisations:
- **Fast TTFB:** CDN, caching, efficient server rendering.
- **Minimise render-blocking resources:** inline critical CSS, load non-critical CSS asynchronously, `defer`/`async`/`module` scripts.
- **Early discovery of key resources:** LCP image and fonts referenced in HTML; `preload` and `fetchpriority` where needed; `preconnect` to critical origins.
- **Reduce bytes:** compression (Brotli), minification, smaller images.
- **Avoid long main-thread work** before first render.

**What the interviewer is looking for:**
The pipeline, render-blocking behaviour and specific optimisations.

**Follow-ups:**
- Difference between `async` and `defer`?
- When would you inline CSS?

**Red flags:**
- Unaware that CSS blocks rendering.

### What's the difference between lab and field performance data? {#lab-vs-field}

**Level:** Foundation

**Model answer:**
- **Lab data:** measurements in a controlled environment (Lighthouse, WebPageTest, DevTools) with fixed device, network and location. Reproducible and great for **diagnosis** and CI regression checks, but it doesn't reflect real users' devices, networks, caches or interactions (INP can't really be measured in lab; TBT is a proxy).
- **Field data (RUM):** measurements from real users — Chrome UX Report (CrUX) for public data, or your own RUM via the `web-vitals` library or monitoring tools. Shows the **actual distribution** across devices, regions and pages; essential for priorities and for INP.

Use field data to decide what to fix and confirm impact; use lab data to understand why and to prevent regressions. Segment field data by page template, device class, country, connection and browser.

CrUX only covers Chrome users, so it misses Safari-heavy audiences such as iPhone users. Your own RUM can now collect LCP and INP from Safari too, since Safari 26.2 (December 2025), though not CLS.

**What the interviewer is looking for:**
Clear roles of each and how they complement.

**Follow-ups:**
- Your Lighthouse score is 98 but CrUX says LCP is poor. Why?
- How would you collect RUM data?

**Red flags:**
- Treating a Lighthouse score as the goal.

### How do you optimise images for the web? {#image-optimisation}

**Level:** Foundation

**Model answer:**
- **Right format:** AVIF or WebP for photos (with fallbacks if needed), SVG for icons/illustrations, PNG only where necessary.
- **Right size:** responsive images with `srcset` and `sizes` so devices download appropriately sized files; don't serve 3000 px images to 400 px slots.
- **Compression** tuned for quality vs size; strip metadata.
- **Dimensions:** always set `width`/`height` (or `aspect-ratio`) to reserve space and prevent CLS.
- **Loading strategy:** `loading="lazy"` for below-the-fold images; **never lazy-load the LCP image** — give it `fetchpriority="high"` and make it discoverable in HTML.
- **`decoding="async"`** for non-critical images.
- **Image CDNs** for automatic resizing and format negotiation; long-lived caching with hashed URLs.
- **CSS backgrounds** are discovered late — avoid them for LCP images.

**What the interviewer is looking for:**
Formats, responsive sizing, dimensions for CLS, lazy loading rules and LCP prioritisation.

**Follow-ups:**
- How does `sizes` affect which image is chosen?
- Why are CSS background images bad for LCP?

**Red flags:**
- Lazy-loading every image including the hero.

### How do you improve a poor LCP? {#improving-lcp}

**Level:** Senior

**Model answer:**
Break LCP into sub-parts (from field data or DevTools): **TTFB**, **resource load delay** (time until the LCP resource starts loading), **resource load duration** and **element render delay**.

- **TTFB:** CDN caching, edge rendering, faster server/database, fewer redirects, cache HTML where possible.
- **Load delay:** make the LCP image discoverable in the initial HTML (not injected by JS or CSS backgrounds), `fetchpriority="high"`, `preload` if needed, avoid lazy-loading it, preconnect to its origin.
- **Load duration:** smaller image (AVIF/WebP, right size), image CDN, HTTP/2/3, compression.
- **Render delay:** remove render-blocking CSS/JS, avoid client-side rendering for main content (SSR/SSG), reduce main-thread work before paint, ensure fonts don't block text rendering (`font-display`).

Validate with field data after deployment; segment by page template and device.

**What the interviewer is looking for:**
Sub-part breakdown and targeted fixes for each.

**Follow-ups:**
- The LCP element is text, not an image. What do you check?
- How does SSR affect LCP?

**Red flags:**
- Generic "make it faster" without diagnosis.

### How do you improve INP? {#improving-inp}

**Level:** Senior

**Model answer:**
INP is driven by **main-thread availability** and how much work interactions trigger:
1. **Find slow interactions** from field data (RUM attribution: which element, which event, input delay vs processing time vs presentation delay).
2. **Reduce input delay:** break up long tasks running when users interact — hydration, third-party scripts, timers; yield to the main thread (`scheduler.yield()` where supported, `setTimeout`), defer non-critical work.
3. **Reduce processing time:** make event handlers do less synchronously — update the UI first, defer analytics and heavy work; debounce; use transitions in React for non-urgent updates; avoid large synchronous re-renders (colocate state, memoise, virtualise lists).
4. **Reduce presentation delay:** keep DOM size reasonable, avoid layout thrashing, minimise expensive style recalculations.
5. **Move heavy computation to Web Workers.**
6. **Govern third-party scripts.**

**What the interviewer is looking for:**
Field attribution, the three phases of interaction latency and concrete techniques.

**Follow-ups:**
- What's a long task, and how do you find them?
- How does hydration affect INP?

**Red flags:**
- Focusing only on network speed for INP.

### How do you find and fix layout shifts? {#fixing-cls}

**Level:** Senior

**Model answer:**
**Find:** field data with attribution (which element shifted, on which page), DevTools Performance panel layout shift regions, the Layout Instability API.

**Common causes and fixes:**
- **Images/videos/iframes without dimensions** → set `width`/`height` or `aspect-ratio`.
- **Ads, embeds and banners injected late** → reserve space (min-height placeholders); avoid inserting content above existing content unless in response to user interaction.
- **Web fonts swapping** → preload critical fonts, `font-display: optional` or size-adjusted fallbacks to match metrics.
- **Dynamic content loading** (reviews, recommendations) → skeletons with the final size.
- **Animations** that change layout properties → animate `transform`/`opacity` instead.
- **Cookie banners** → overlay rather than pushing content.

Shifts within 500 ms after user input are excluded from CLS, so expanding sections on click is fine.

**What the interviewer is looking for:**
Detection tools, common causes with fixes and the user-input exclusion.

**Follow-ups:**
- How do size-adjusted font fallbacks work?
- Why animate transform instead of top/left?

**Red flags:**
- Ignoring third-party embeds as CLS sources.

### Describe an effective caching strategy for web assets. {#asset-caching}

**Level:** Senior

**Model answer:**
- **Hashed static assets** (JS, CSS, images, fonts with content hashes in filenames): `Cache-Control: public, max-age=31536000, immutable` — cache forever; a new deploy produces new URLs.
- **HTML documents:** short caching with revalidation (`no-cache` meaning revalidate, or short `max-age` plus `stale-while-revalidate` at the CDN) so users get new deploys quickly.
- **CDN caching** close to users, with cache keys designed carefully (vary only on what matters), and purging on deploys if HTML is cached.
- **API responses:** cache where possible (public data) with `ETag`/`Last-Modified` and appropriate `max-age`/`s-maxage`; never cache personalised data in shared caches without the right `Vary`/`private` directives.
- **Service workers** for repeat visits and offline (precache app shell, runtime caching strategies), with careful update flows.
- **Back/forward cache** eligibility for instant back navigation.
- **Compression** (Brotli/gzip) at the edge.

**What the interviewer is looking for:**
Immutable hashed assets, HTML revalidation, CDN keys, API caching safety, service workers and bfcache.

**Follow-ups:**
- What does `immutable` change?
- How do you avoid users getting a stale HTML file pointing to deleted assets?

**Red flags:**
- Long caching on HTML without versioning.

### How do you load web fonts without hurting performance? {#font-loading}

**Level:** Senior

**Model answer:**
- **Use fewer fonts and weights**; consider variable fonts to replace multiple files.
- **WOFF2** format, **subsetting** to needed character sets (e.g. Latin only).
- **Self-host or use a fast CDN** on the same connection; `preconnect` if third-party.
- **Preload** the one or two fonts used above the fold.
- **`font-display`:** `swap` shows fallback text immediately then swaps (risk of shift); `optional` uses the font only if it loads very quickly (best for CLS); avoid invisible text periods.
- **Size-adjusted fallback fonts** (`size-adjust`, `ascent-override`, `descent-override`) to match metrics and minimise layout shift on swap.
- **Cache** long-term with hashed URLs.
- Consider **system fonts** for UI text where branding allows.

**What the interviewer is looking for:**
Reducing font bytes, early loading, font-display trade-offs and metric-matched fallbacks.

**Follow-ups:**
- When would you choose `optional` over `swap`?
- How do variable fonts help?

**Red flags:**
- Loading eight font weights from a third-party CSS file synchronously.

### How do you reduce JavaScript bundle size? {#bundle-optimisation}

**Level:** Senior

**Model answer:**
- **Measure:** bundle analysers (rollup/webpack visualisers, source-map-explorer), per-route budgets in CI, coverage tool in DevTools for unused code.
- **Code splitting:** by route and by interaction (load the editor, charting or map only when needed) with dynamic `import()`.
- **Tree shaking:** ESM dependencies, avoid side-effectful imports, import specific functions (`lodash-es` per function or native equivalents).
- **Remove or replace heavy dependencies:** moment.js → native `Intl`/date-fns/Temporal polyfill as needed; large UI kits → targeted components; check bundlephobia-style cost before adding.
- **Modern output:** target modern browsers (no unnecessary polyfills/transpilation), differential builds only if needed.
- **Server rendering and Server Components** to move code off the client.
- **Avoid duplicate dependencies** (multiple versions of the same library).
- **Third-party scripts** count too.

**What the interviewer is looking for:**
Measurement, splitting, tree shaking, dependency hygiene, modern targets and server-side rendering.

**Follow-ups:**
- How would you enforce a 170 KB JS budget per route?
- What prevents tree shaking from working?

**Red flags:**
- Not knowing what's in the bundle.

### How do you set up performance budgets and governance across teams? {#performance-budgets}

**Level:** Architect

**Model answer:**
- **Define budgets per page template** tied to user outcomes: e.g. JS ≤ 170 KB compressed on product pages, LCP p75 ≤ 2.5 s, INP p75 ≤ 200 ms, CLS ≤ 0.1, third-party JS ≤ X KB.
- **Automate in CI:** bundle size checks per PR (fail or warn on increases), Lighthouse CI or WebPageTest runs on key templates with thresholds; comment results on PRs.
- **Monitor in production:** RUM dashboards per template/device/region with alerts on regressions; deploy markers to correlate releases.
- **Ownership:** each page template has an owning team accountable for its budget; a performance champion network or platform team supports.
- **Process:** performance considered in design reviews; exceptions require justification and a plan; quarterly reviews of trends.
- **Third-party governance** with per-script budgets and approval.
- **Make it visible:** share wins and the business impact.

**What the interviewer is looking for:**
Concrete budgets, CI automation, RUM alerts, ownership and process.

**Follow-ups:**
- A feature can't ship without exceeding the budget. What happens?
- How do you attribute regressions to releases?

**Red flags:**
- Budgets that exist only in a document.

### How do you govern third-party scripts? {#third-party-scripts}

**Level:** Architect

**Model answer:**
Third parties (analytics, ads, A/B testing, chat, tag managers) often dominate main-thread time and add security and privacy risk.
- **Inventory and ownership:** list every script, its owner, purpose, cost (bytes, main-thread time, requests) and data collected.
- **Approval process:** new scripts need a business case, performance and security review, consent integration, and a budget.
- **Loading strategy:** load after main content and interaction where possible (defer, `requestIdleCallback`, on user action — e.g. load chat widget on click via a facade), avoid synchronous scripts, use `async`, and consider moving to Web Workers (e.g. Partytown, which is still beta and can break scripts that need synchronous DOM access) or server-side tagging.
- **Facades:** lightweight placeholders for heavy embeds (video players, maps, chat) that load the real thing on interaction.
- **Security:** CSP allow-lists, Subresource Integrity where versions are fixed, sandboxed iframes, minimal data sharing.
- **Measure continuously** with RUM attribution and periodic audits; remove unused scripts.

**What the interviewer is looking for:**
Inventory, approval and budgets, loading strategies, facades, security and continuous measurement.

**Follow-ups:**
- Marketing wants a new A/B testing tool that blocks rendering. How do you respond?
- What's server-side tagging?

**Red flags:**
- Tag managers where anyone can add scripts to production.

### How do you optimise performance for a global audience? {#global-performance}

**Level:** Architect

**Model answer:**
- **CDN and edge:** cache static assets and cacheable HTML at edge locations worldwide; use edge rendering/functions for personalisation close to users.
- **Reduce round trips:** HTTP/2 or HTTP/3 (QUIC, faster connection setup and better on lossy mobile networks), TLS 1.3, connection reuse, fewer origins, preconnect.
- **Regional backends** or read replicas for dynamic data where latency matters; avoid cross-ocean API calls on the critical path.
- **Optimise for low-end devices and slow networks:** many users are on mid-range Android devices — less JS, server rendering, smaller images, testing with throttling and real devices.
- **Adaptive loading:** respond to `Save-Data`, network quality hints, and device memory where appropriate.
- **Localisation assets:** subset fonts per script/language; avoid shipping all locales' bundles.
- **Measure by region and device** in RUM; set targets per market.

**What the interviewer is looking for:**
Edge delivery, protocol improvements, regional data, low-end device focus, adaptive loading and segmented measurement.

**Follow-ups:**
- How does HTTP/3 help mobile users?
- What should run at the edge vs origin?

**Red flags:**
- Testing only on fast laptops in one region.

### How do you make the business case for web performance work? {#performance-business-case}

**Level:** Architect

**Model answer:**
- **Correlate performance with outcomes in your own data:** conversion, bounce rate, engagement, revenue per session segmented by LCP/INP buckets. Public case studies help, but your data persuades most.
- **Run experiments:** A/B test performance improvements (or artificial delays on a small cohort, carefully) to show causal impact.
- **Quantify:** "Improving mobile LCP from 4 s to 2.5 s on product pages is associated with X% more conversions → £Y per month."
- **Include SEO:** Core Web Vitals are part of search page experience signals; organic traffic matters for many businesses.
- **Cost savings:** less bandwidth and compute, fewer support issues.
- **Frame performance as a feature** in roadmaps with owners and success metrics, plus ongoing budgets to prevent regression.

**What the interviewer is looking for:**
Data-driven, experiment-backed, business-language case with ongoing governance.

**Follow-ups:**
- How would you design an experiment to prove performance impact?
- What if the data shows weak correlation?

**Red flags:**
- Arguing from Lighthouse scores alone.

### Field data shows LCP regressed by 800 ms last week. How do you investigate? {#diagnosing-regression}

**Level:** Architect

**Model answer:**
1. **Scope it:** which pages/templates, devices, browsers, regions? Is it all traffic or a segment (a market, a campaign landing page, a new browser version)?
2. **Correlate with changes:** deploys (deploy markers), feature flags, third-party script changes, CDN/config changes, content changes (a new huge hero image), traffic mix changes (a campaign bringing slower devices).
3. **Break down LCP sub-parts** from RUM attribution: TTFB (server/CDN), load delay, load duration, render delay — this narrows the cause.
4. **Reproduce in the lab** with the same conditions (device, network, region); compare before/after builds with WebPageTest/Lighthouse and DevTools traces.
5. **Fix and verify:** roll back or fix the cause; confirm in field data over following days (CrUX lags; your RUM is faster).
6. **Prevent recurrence:** add a CI check, budget or alert that would have caught it; document in a short postmortem.

**What the interviewer is looking for:**
Segmentation, change correlation, sub-part analysis, lab reproduction, verification and prevention.

**Follow-ups:**
- The regression is only on Safari. What next?
- TTFB increased but the code didn't change. What could it be?

**Red flags:**
- Guessing fixes without segmenting data.

### What do `preconnect`, `preload`, `prefetch` and `fetchpriority` do? {#resource-hints}

**Level:** Foundation

**Model answer:**
They're hints that change **when** and **how urgently** the browser fetches things. Each one solves a different problem:

| Hint | What it does | Use for | Cost of overuse |
|---|---|---|---|
| `dns-prefetch` | Resolves a domain's DNS early | Many third-party origins, cheaply | Very little |
| `preconnect` | DNS, TCP and TLS to an origin early | 1–3 critical origins such as an image CDN or font host | Idle connections; each one competes for bandwidth |
| `preload` | Fetches a resource **for this page** at high priority, before the parser finds it | Late-discovered critical resources: the LCP image in CSS or JS, critical fonts | Everything preloaded competes with everything else, so the important resources slow down |
| `modulepreload` | Fetches and parses a JavaScript module and its dependencies early | Critical modules deep in an import graph | Same as `preload` |
| `prefetch` | Fetches a resource at low priority **for a likely next page** | The next step's bundle | Wasted bytes if the user doesn't go there |
| `fetchpriority` | Raises or lowers a fetch's priority relative to its type's default | `high` on the LCP image; `low` on hidden carousel slides | Marking everything high means nothing is |

```html
<link rel="preconnect" href="https://img.example-cdn.com">
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<img src="/hero.avif" fetchpriority="high" width="1200" height="600" alt="…">
```

Rules of thumb:
- **The best fix is discoverability.** A plain `<img>` in the HTML beats a preload for an image that JavaScript inserts later. Use preload only when you can't move the reference.
- **Fonts need `crossorigin`** on the preload, even from your own origin, or the browser downloads them twice.
- **Server help:** a `103 Early Hints` response lets the server send preconnect and preload headers while it's still generating the HTML.
- **Check that it worked:** the DevTools Network panel shows each request's priority and when it started. Lighthouse warns about preloads the page never used.

**What the interviewer is looking for:**
The distinct purpose of each hint, this page versus the next page, the cost of overuse, and a preference for making resources discoverable.

**Follow-ups:**
- Why does preloading a font without `crossorigin` cause a double download?
- How do Early Hints help when the server is slow to generate HTML?

**Red flags:**
- Preloading ten resources "to be safe".
- Confusing `preload` with `prefetch`.

### How can you make navigations to the next page feel instant? {#speculation-rules}

**Level:** Senior

**Model answer:**
Fetch or even render the next page **before the user clicks**. Modern Chromium browsers support this declaratively with the **Speculation Rules API**:

```html
<script type="speculationrules">
{
  "prerender": [{
    "where": { "and": [
      { "href_matches": "/products/*" },
      { "not": { "selector_matches": ".no-prerender" } }
    ]},
    "eagerness": "moderate"
  }]
}
</script>
```

- **`prefetch`** downloads the next page's HTML. The navigation skips the network wait, but still has to parse and render.
- **`prerender`** loads and renders the whole page in a hidden tab, including its scripts. Activation is close to instant, and LCP for that navigation can be close to zero.
- **Eagerness** controls when it fires. `immediate` fires as soon as the rule matches, `eager` and `moderate` on signals such as a hover or (on mobile) a link sitting in the viewport, and `conservative` on pointer-down or touch-start. Chrome caps how many speculations each level can hold at once, and Chrome has tuned the triggers several times since 2025, so check the current documentation.

Guard against the side effects:
- **Analytics and state changes:** a prerendered page runs its JavaScript. Check `document.prerendering` and wait for the `prerenderingchange` event before counting a page view, starting a video or showing a time-limited offer.
- **Server load and cost:** every speculation is a real request. Exclude pages that are expensive to render or that change state, such as logout, add-to-basket links or anything with a GET side effect. Servers can recognise speculations from the `Sec-Purpose` request header.
- **Personalised pages** may go stale between prerender and click. Prefer prefetch, or keep the eagerness low for them.

Other browsers ignore the rules, so it's a **progressive enhancement**. Where it isn't supported, a `<link rel="prefetch">` or a framework's own link prefetching gives part of the benefit. Measure the effect with RUM: navigations that used a prerender can be identified from the navigation's `activationStart` timing.

**What the interviewer is looking for:**
Prefetch versus prerender, eagerness and its cost, handling analytics and side effects in prerendered pages, server impact, and progressive enhancement.

**Follow-ups:**
- How would you stop prerendering from inflating page-view counts?
- Which pages would you never prerender?

**Red flags:**
- Prerendering every link with `immediate` eagerness.
- Not considering pages whose GET requests change state.

### What is the back/forward cache, and how do you keep pages eligible for it? {#bfcache}

**Level:** Senior

**Model answer:**
The **back/forward cache (bfcache)** keeps a complete snapshot of a page in memory, with its JavaScript heap paused, when the user navigates away. If they press Back or Forward, the browser restores it **instantly**, with no network requests and no re-rendering. Back and forward navigations are a large share of all navigations, especially on mobile, so eligibility is one of the cheapest wins available.

Common reasons a page isn't eligible:
- **`unload` event handlers**, including ones in third-party scripts. Chrome is deprecating `unload`. Use `pagehide` or `visibilitychange` instead, and set `Permissions-Policy: unload=()` to stop any script on the page adding one.
- **`Cache-Control: no-store`** on the HTML. Since 2025, Chrome allows many of these pages into the bfcache with safeguards: it evicts them when cookies change, and keeps them for only 3 minutes. Other browsers may still refuse them, so use `no-store` only for genuinely sensitive pages.
- **Open connections** at the moment of navigation, such as an unfinished `fetch`, or a WebSocket or WebRTC connection in some browsers. Close them on `pagehide` and reopen on `pageshow`.
- **`window.opener` references** and some other APIs in use.

Handling restores correctly:
```js
window.addEventListener('pageshow', (event) => {
  if (event.persisted) refreshBasketCount();   // restored from bfcache: data may be stale
});
```

**Finding out why:** the DevTools Application panel has a back/forward cache test that lists blocking reasons, and in Chromium the `notRestoredReasons` property of the navigation timing entry reports them from real users, so RUM can count which reasons are most common.

**What the interviewer is looking for:**
What the bfcache is, the main blockers (`unload`, `no-store`, open connections), Chrome's 2025 `no-store` change, `pageshow` with `persisted`, and how to diagnose eligibility.

**Follow-ups:**
- A third-party script adds an `unload` listener. What can you do?
- Why might a page restored from the bfcache show the wrong basket count?

**Red flags:**
- Adding `unload` handlers to send analytics.
- Never having checked bfcache eligibility on a high-traffic site.

### Design real-user performance monitoring for a large site. {#rum-pipeline}

**Level:** Architect

**Model answer:**
**1. Collect in the browser:**
- Use the `web-vitals` library's **attribution build**: LCP, INP and CLS, plus TTFB and FCP, with the element, sub-parts and the interaction that caused each value.
- Add **Long Animation Frames** (LoAF) data for slow interactions. It names the scripts, by URL and function, that were running, which separates your code from third parties.
- Add **custom metrics** for what users care about on your site: time until search results render, time to the first chat message, using `performance.mark()` and the Element Timing API.
- **Single-page apps:** route changes are soft navigations, which classic LCP doesn't measure. Chrome 151 shipped the Soft Navigations API in 2026, and CrUX has published experimental soft-navigation metrics since October 2026. Until tools have caught up, record your own route-change timings.
- **Send** with `navigator.sendBeacon()` on `visibilitychange` to hidden, so the final values aren't lost when the tab closes.

**2. Tag every record** with page template (not the raw URL), device class, browser, country, connection type, logged-in state, app release and active experiments. Without these, you can't find which users suffer or tie a regression to a release.

**3. Store and aggregate** as histograms or sketches, so percentiles stay correct at scale. Sample high-traffic templates, but keep everything for low-traffic ones.

**4. Know the gaps in each source:**
- **CrUX** is public and is what Google search uses, but it only covers Chrome users who opted in, is aggregated over 28 days, and lags.
- **Browser support:** since Safari 26.2 (December 2025), LCP and INP can be measured in every major engine. CLS still comes only from Chromium browsers. Compare browsers separately rather than mixing them.

**5. Act on it:**
- Dashboards per template showing p75 of each vital against its budget, with deploy markers.
- **Alerts** on sustained changes in p75, not on single spikes, routed to the team that owns the template.
- Weekly review of the worst templates and the scripts LoAF most often blames.

**6. Privacy:** respect consent, strip query strings and personal data from URLs and element selectors, and keep retention short.

**What the interviewer is looking for:**
Attribution, custom and SPA metrics, reliable beaconing, the tagging needed for segmentation, correct percentile aggregation, knowing CrUX's and each browser's limits, alerting tied to owners, and privacy.

**Follow-ups:**
- How would you attribute an INP regression to a specific third-party script?
- Why aggregate with histograms rather than storing averages?

**Red flags:**
- Treating CrUX as the whole picture.
- Dashboards of averages per URL with no owner.

### A content-heavy site built as a client-rendered SPA has poor LCP and INP on mobile. What architectural options do you have? {#rendering-architecture-performance}

**Level:** Architect

**Model answer:**
**Diagnose first.** In a client-rendered SPA, the HTML is an empty shell. The browser downloads, parses and runs the whole bundle, fetches data, then renders. That causes a late LCP, and the big bundle's long tasks block early interactions. Confirm this with the LCP sub-parts (long render delay, late discovery) and LoAF (bundle evaluation and rendering during interactions).

**The options, from least to most change:**

| Option | What changes | Helps | Costs |
|---|---|---|---|
| Pre-render the shell and critical content (SSG) at build time | Static HTML for pages that are the same for everyone | LCP, cheap to serve from a CDN | Build times; stale content between builds without revalidation |
| Server-side rendering with **streaming** | HTML per request, sent in chunks as data arrives | LCP; slow data doesn't block the rest | Server cost and operational work |
| **Selective or progressive hydration** | Hydrate visible or interacted parts first | INP during load | Framework support; complexity |
| **Islands** (Astro and similar) | The page is static HTML; only the interactive widgets ship JavaScript | Much less JavaScript on content pages | Sharing state across islands is harder |
| **React Server Components** | Components that only render on the server ship no JavaScript | Bundle size and INP | Learning curve; a new server attack surface to secure |
| **Resumability** (Qwik) | No hydration: the page resumes from serialised state and loads code on interaction | Very little start-up JavaScript | Smaller ecosystem; a different mental model |

**How I'd decide:**
- **Match the architecture to the page type.** Content and landing pages suit SSG, islands or server components. An app screen behind a login, with heavy interaction, may be fine client-rendered if its bundle is split and cached.
- **Migrate incrementally, by route.** Start with the templates that bring the most traffic and revenue, often product or article pages, behind a router that can serve old and new versions. Compare field data for each route before moving on.
- **Don't expect architecture alone to fix INP.** Server rendering can make INP worse during load if hydration is a big long task. Pair it with less client JavaScript and smaller, yielding tasks.
- **Count the organisational cost.** Server rendering means the frontend team now runs servers, or edge functions, with on-call responsibilities, caching and security work.

**What the interviewer is looking for:**
Diagnosis before prescription, the spectrum of rendering options and their trade-offs, matching to page types, incremental migration with field validation, hydration's effect on INP, and operational cost.

**Follow-ups:**
- Why can moving to SSR make INP worse?
- How would you run the old and new rendering side by side during migration?

**Red flags:**
- "Rewrite it in framework X" without diagnosing.
- Assuming SSR fixes every metric.

## Cheat Sheet

### Metrics
- **LCP** — main content render; good ≤ 2.5 s at p75.
- **INP** — interaction to next paint; good ≤ 200 ms; replaced FID in March 2024.
- **CLS** — unexpected layout shift; good ≤ 0.1.
- **TTFB** — server and network time; foundation of LCP.
- **Lab vs field** — Lighthouse diagnoses; RUM/CrUX decides priorities.

### Techniques
- **LCP image** — in initial HTML, `fetchpriority="high"`, never lazy-loaded.
- **Responsive images** — `srcset`/`sizes`, AVIF/WebP, explicit dimensions.
- **Render-blocking** — CSS and sync scripts in head; use `defer`/`async`/module scripts.
- **Long task** — > 50 ms on the main thread; break up and yield.
- **Immutable caching** — hashed assets with one-year `immutable`; revalidate HTML.
- **Fonts** — WOFF2 subsets, preload critical font, size-adjusted fallbacks.
- **bfcache** — avoid `unload` handlers (and `no-store` outside Chrome) to keep instant back navigation.

### Governance
- **Performance budget** — per-template limits enforced in CI and monitored in RUM.
- **Third-party governance** — inventory, approval, budgets, facades, deferred loading.
- **Business case** — correlate vitals with conversion in your own data; run experiments.

### Revisit

- **LCP sub-parts** — TTFB, resource load delay, load duration and render delay. Healthy pages spend most time in TTFB and load duration; a large load delay means the resource was discovered late.
- **INP phases** — input delay (main thread busy), processing time (handlers) and presentation delay (style, layout, paint) up to the next frame.
- **`preload` vs `prefetch`** — preload is for this page at high priority; prefetch is for a likely next page at low priority.
- **Speculation Rules** — declarative prefetch or prerender of likely next pages in Chromium browsers; delay analytics until `prerenderingchange`.
- **bfcache blockers** — `unload` handlers, open connections, and `no-store` outside Chrome. Use `pagehide` and check `event.persisted` on `pageshow`.
- **Cross-browser vitals** — LCP and INP are measurable in every major engine since Safari 26.2 (December 2025); CLS is still Chromium-only.
- **Soft navigations** — SPA route changes; measurable with Chrome's Soft Navigations API (Chrome 151) and experimental in CrUX since October 2026.

## Further Reading

- [web.dev: Web Vitals](https://web.dev/articles/vitals) — definitions and thresholds of Core Web Vitals.
- [web.dev: Optimize LCP](https://web.dev/articles/optimize-lcp) — sub-part breakdown and fixes.
- [web.dev: Optimize INP](https://web.dev/articles/optimize-inp) — diagnosing and improving responsiveness.
- [MDN: Web performance](https://developer.mozilla.org/en-US/docs/Web/Performance) — fundamentals of the critical rendering path, caching and loading.
- [web-vitals library](https://github.com/GoogleChrome/web-vitals) — collecting field metrics with attribution.
- [Chrome UX Report (CrUX)](https://developer.chrome.com/docs/crux) — public field data for real-world performance.
- [Chrome for Developers: Prerender pages](https://developer.chrome.com/docs/web-platform/prerender-pages) — the Speculation Rules API, eagerness and side effects.
- [web.dev: Back/forward cache](https://web.dev/articles/bfcache) — how the bfcache works and how to keep pages eligible.
- [Chrome for Developers: Measuring soft navigations](https://developer.chrome.com/docs/web-platform/soft-navigations) — Core Web Vitals for single-page app route changes.
