---
id: reactjs
title: "React"
group: languages-frontend
tags: [frontend, ui, rendering]
level: Senior
estimatedMinutes: 75
related: [state-management, web-performance, typescript]
lastReviewed: 2026-11-26
status: complete
---

## TL;DR

- React builds UIs from **components**: functions that take **props** and return UI, re-rendering when **state** changes. UI is a function of state.
- **Hooks** (`useState`, `useEffect`, `useMemo`, `useRef`, `useContext`…) must be called unconditionally at the top level; effects are for **synchronising with external systems**, not for deriving data.
- React renders, diffs (reconciliation) and commits changes; **keys** identify list items; re-renders are usually cheap — measure before memoising (the React Compiler can automate memoisation).
- Modern React (18/19) adds **concurrent rendering** (transitions, Suspense), **Server Components**, **Actions** and form helpers (`useActionState`, `useOptimistic`) — mostly used through frameworks such as Next.js or React Router.
- Architecture at scale: clear separation of **server state** (data fetching libraries) and **client state**, a design system, colocated state, code splitting and good testing with Testing Library.

## Core Concepts

### Components, props and state

```tsx
type Props = { product: Product; onAdd: (id: string, qty: number) => void };

export function ProductCard({ product, onAdd }: Props) {
  const [qty, setQty] = useState(1);                 // local state
  const total = product.priceMinor * qty;            // derived during render — no effect needed
  return (
    <article>
      <h3>{product.name}</h3>
      <label>
        Quantity
        <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
      </label>
      <p>{formatMoney(total, product.currency)}</p>
      <button onClick={() => onAdd(product.id, qty)}>Add to basket</button>
    </article>
  );
}
```

- **Props** flow down and are read-only; **state** is owned by a component and updated via setters (asynchronously batched).
- **Lift state up** to the closest common parent when siblings need it; **colocate** state as low as possible otherwise.
- **Derive, don't duplicate:** compute values from props/state during render instead of storing copies.

### Rendering model

1. **Trigger:** initial render or a state/prop/context change.
2. **Render:** React calls components to produce a new element tree (must be pure — no side effects).
3. **Reconcile:** compare with the previous tree; **keys** identify list items; element type changes remount subtrees.
4. **Commit:** apply DOM changes, run layout effects, then (after paint) passive effects.

A parent re-render re-renders its children by default; usually fine. Optimise with `React.memo`, `useMemo`, `useCallback` only where profiling shows cost — or let the **React Compiler** memoise automatically (stable since React Compiler 1.0 in October 2025, and it can be adopted incrementally).

### Worked example: why the wrong row kept its quantity

A basket renders each line with its own quantity input, which holds local state, and uses the **array index as the key**:

```tsx
{lines.map((line, i) => <BasketLine key={i} line={line} />)}   // BasketLine has its own useState(qty)
```

The user sets quantities, then removes Apples:

| Position (key) | Before: item and its state | After removing Apples, with `key={i}` | After, with `key={line.id}` |
|---|---|---|---|
| 0 | Apples, qty **3** | **Bananas, qty 3** (wrong) | Bananas, qty 1 |
| 1 | Bananas, qty **1** | **Cherries, qty 1** (wrong) | Cherries, qty 5 |
| 2 | Cherries, qty **5** | Removed. Cherries' state is lost | — |

**Why:** React matches old and new children **by key**. With index keys, key 0 still exists after the removal, so React keeps component 0 and its state (qty 3), and only changes its `line` prop to Bananas. The state stays attached to the *position*, not the *item*. The component that actually unmounts is the last one, so Cherries' state is lost.

**With stable ids as keys**, React sees that `apples` disappeared, unmounts that component, and keeps the Bananas and Cherries components, with their state, at their new positions.

Rules that follow:
- Use a **stable, unique id from the data** as the key. Index keys are only safe for lists that never reorder, filter or insert, and whose items hold no state.
- Never use random keys (`Math.random()`): every render then remounts every item, losing state and wasting work.
- The same mechanism is useful on purpose. Changing a component's `key` (`<Profile key={userId} />`) resets its state, which is cleaner than an effect that resets fields when a prop changes.

### Hooks rules and essentials

- Call hooks **at the top level** of components or custom hooks — never in conditions, loops or after early returns — so React can match hook state by call order.
- `useEffect` synchronises with **external systems** (subscriptions, timers, imperative widgets, non-React code); return a cleanup function. Dependencies must list every reactive value used.
- `useRef` holds mutable values that don't trigger renders (DOM nodes, timers).
- `useMemo`/`useCallback` cache expensive computations and stable references.
- **Custom hooks** extract reusable stateful logic (`useOnlineStatus`, `useDebouncedValue`).

### You might not need an effect

Effects are often misused. Don't use them to:
- Derive state from props/state → compute during render (or `useMemo`).
- Respond to user events → do it in the event handler.
- Reset state when a prop changes → use a `key` on the component.
- Fetch data in large apps → use a data-fetching library or framework loaders (effects cause waterfalls, race conditions and no caching).

### Concurrent features

- **Transitions** (`startTransition`, `useTransition`) mark updates as non-urgent so typing stays responsive while a heavy list re-renders.
- **`useDeferredValue`** renders a lagging version of a value.
- **Suspense** shows fallbacks while components wait for code or data (with Suspense-enabled data sources), and enables streaming server rendering.

### React 19 additions (high level)

- **Actions:** async functions passed to forms/transitions with pending and error handling; `useActionState`, `useFormStatus`, `useOptimistic` for optimistic UI.
- **`use()`** to read promises and context during render (with Suspense).
- **Server Components and Server Functions** (via frameworks): components that run on the server, send serialised UI to the client and never ship their code to the browser.
- `ref` as a regular prop for function components; improved hydration error messages; document metadata support.
- **React 19.2** (October 2025): `<Activity>` hides part of the UI while keeping its state (with effects cleaned up while hidden), and `useEffectEvent` became stable for event-like logic inside effects.
- **Security note:** in December 2025 a critical remote code execution vulnerability in Server Components handling (CVE-2025-55182) and follow-up issues were fixed. Safe versions are 19.0.3, 19.1.4, 19.2.3 or later, plus the matching framework releases.

### Rendering strategies

| Strategy | How | Strengths | Costs |
|---|---|---|---|
| CSR (client-side) | Browser downloads JS, renders everything | Simple hosting, rich interactivity | Slow first load, SEO limits, big bundles |
| SSR (server-side) | Server renders HTML per request, client hydrates | Fast first paint, SEO | Server cost, hydration cost, complexity |
| SSG / ISR | Pre-render at build or revalidate periodically | Very fast, cacheable on CDN | Stale data, build times |
| Streaming SSR + Server Components | Stream HTML progressively; server-only components | Less client JS, data fetching close to data | Framework coupling, new mental model |

## How It Works

```mermaid
sequenceDiagram
  participant U as User
  participant H as Event handler
  participant R as React
  participant C as Components
  participant D as DOM

  %% step: The user clicks "Add to basket". The browser fires the event, and React calls the handler.
  %% step: The handler calls a state setter with the new basket. Nothing renders yet: React records the update.
  %% step: React batches it with any other updates from the same event, and schedules a render, urgent here, or lower priority if wrapped in a transition.
  %% step: React calls the affected components. Rendering must be pure: no side effects, just computing what the UI should look like.
  %% step: The components return a new element tree.
  %% step: React reconciles it with the previous tree, using element types and keys to work out what actually changed.
  %% step: In the commit phase, React applies only the minimal DOM changes, such as a new line in the basket and a new total.
  %% step: Layout effects run synchronously after the DOM changes. Passive effects (useEffect) run after the browser has painted.
  %% step: The user sees the updated basket. Most of this took a few milliseconds, which is why re-renders are usually cheap.
  U->>H: click "Add to basket"
  H->>R: setState(newBasket)
  R->>R: batch updates, schedule render (urgent or transition)
  R->>C: call components (pure render)
  C-->>R: new element tree
  R->>R: reconcile with previous tree (keys, types)
  R->>D: commit minimal DOM changes
  R->>R: run layout effects, then passive effects after paint
  D-->>U: updated UI
```

## When to Use / Trade-offs

| Choice | Use when | Avoid when | Trade-off |
|---|---|---|---|
| Plain React SPA (Vite) | Internal tools, apps behind login, simple hosting | SEO-critical public content, slow devices with heavy pages | Simplicity vs first-load performance |
| Framework (Next.js, React Router framework mode, Remix-style) | Public sites, SEO, SSR/streaming, Server Components | Tiny widgets, teams wanting minimal tooling | Capabilities vs framework coupling |
| Server Components | Data-heavy pages, reducing client JS | Highly interactive client-only apps | Less JS vs new architecture constraints |
| Local state | UI state used by one component subtree | Widely shared data | Simplicity vs prop drilling |
| Context | Low-frequency global values (theme, auth, locale) | High-frequency updates to many consumers | Convenience vs re-render cost |
| Memoisation | Measured expensive renders, stable references for memoised children | Everything by default | Fewer renders vs complexity |

## Common Pitfalls & Anti-patterns

- **Effects for derived state** — extra renders and stale data.
- **Missing or wrong effect dependencies** — stale closures, infinite loops; don't silence the lint rule.
- **Fetching in effects without cancellation** — race conditions, waterfalls, no caching.
- **Index as key** in reorderable lists — state attached to the wrong items.
- **Mutating state** (`state.items.push`) — React doesn't see the change.
- **Giant contexts** that re-render the whole app on every change.
- **Premature memoisation everywhere** — complexity without measurable benefit.
- **Huge components** mixing data fetching, business logic and presentation.
- **`dangerouslySetInnerHTML` with untrusted HTML** — XSS.
- **Hydration mismatches** — rendering differently on server and client (dates, random values, `window` checks).

## Real-world Scenario

**Context:** A React SPA for a retailer had a 1.8 MB JavaScript bundle, LCP around 4.5 s on mobile and typing lag in the product filter. Data fetching happened in `useEffect` across nested components, causing request waterfalls and occasional stale results.

**Decision:** Migrated public pages to a framework with server rendering and Server Components for product listing and detail pages (product data rendered on the server; only the interactive filter, basket and gallery as client components); route-level code splitting; replaced effect-based fetching with framework loaders and a data-fetching library for client interactions; used `useTransition` for filter updates; virtualised long lists; fixed index keys and derived-state effects found by profiling.

**Outcome:** Client JS on product pages dropped by ~60%; mobile LCP improved to ~2.2 s; INP dropped below 200 ms; stale-result bugs disappeared.

**What I'd do differently:** Establish clear server/client component boundaries and a data-fetching standard before migrating — early pages mixed patterns and needed rework.

## Interview Questions

### What are components, props and state in React? {#components-props-state}

**Level:** Foundation

**Model answer:**
- **Components** are functions that return UI (JSX) describing what should be on screen for given inputs. They compose into trees.
- **Props** are inputs passed from parent to child — read-only from the child's perspective; changing them means the parent re-renders with new values.
- **State** is data owned by a component that changes over time (form input, toggles), managed via `useState`/`useReducer`. Updating state schedules a re-render.

Principles: UI = f(state); keep components pure during render; lift state to the nearest common ancestor when shared; derive values instead of duplicating state; data flows down, events flow up via callbacks.

**What the interviewer is looking for:**
Clear definitions, unidirectional data flow and derived state.

**Follow-ups:**
- When would you use `useReducer` over `useState`?
- What happens when you call a state setter twice in one handler?

**Red flags:**
- Mutating props or state directly.

### What are the rules of hooks, and why do they exist? {#rules-of-hooks}

**Level:** Foundation

**Model answer:**
1. **Only call hooks at the top level** of a function component or custom hook — not inside conditions, loops, nested functions or after early returns.
2. **Only call hooks from React functions** (components or custom hooks), not regular JavaScript functions.

Why: React associates hook state with components **by call order**. If the order changes between renders (a hook called conditionally), React would mismatch state to the wrong hook. The ESLint plugin (`eslint-plugin-react-hooks`) enforces the rules and checks effect dependencies.

Custom hooks (named `useSomething`) let you extract and reuse stateful logic while following the same rules. (The `use()` API in React 19 is an exception: it can be called inside conditions and loops, but still only from a component or hook, and not inside a try/catch block.)

**What the interviewer is looking for:**
Both rules and the call-order rationale; lint enforcement.

**Follow-ups:**
- How would you conditionally run an effect?
- What makes a function a custom hook?

**Red flags:**
- Calling hooks inside `if` statements.

### Why do keys matter when rendering lists? {#keys}

**Level:** Foundation

**Model answer:**
Keys tell React which list item is which between renders during reconciliation. With stable keys (e.g. database ids), React can reorder, insert and remove items efficiently and keep each item's **state and DOM** attached to the right item.

Using the **array index** as a key breaks when items are reordered, inserted or removed: React reuses components by position, so input values, focus or component state end up attached to the wrong item, and more DOM work is done.

Keys must be **stable, unique among siblings and predictable** — not random values generated on each render (that remounts everything). Keys can also be used deliberately to **reset** a component's state (`<Editor key={documentId} />`).

**What the interviewer is looking for:**
Reconciliation role, index-key bug, stability, and key-based resets.

**Follow-ups:**
- When is index as a key acceptable?
- How would you reset a form when the selected user changes?

**Red flags:**
- `key={Math.random()}`.

### What's the difference between controlled and uncontrolled form inputs? {#controlled-uncontrolled}

**Level:** Foundation

**Model answer:**
- **Controlled:** React state is the source of truth; the input's `value` comes from state and `onChange` updates it. Enables instant validation, conditional UI and formatting, at the cost of a re-render per keystroke (usually fine).
- **Uncontrolled:** the DOM holds the value; you read it when needed via refs or `FormData` on submit (`defaultValue` sets the initial value). Less code and fewer renders; well-suited to simple forms and React 19 form Actions that receive `FormData`.

Form libraries (React Hook Form uses uncontrolled inputs with refs; others use controlled state) combine the approaches with validation schemas (Zod). Choose based on interactivity needs; avoid switching a single input between controlled and uncontrolled (React warns).

**What the interviewer is looking for:**
Definitions, trade-offs and modern form handling.

**Follow-ups:**
- How do React 19 Actions change form handling?
- How would you validate a large form efficiently?

**Red flags:**
- Not knowing what `defaultValue` vs `value` does.

### When should you use useEffect, and when don't you need it? {#effects}

**Level:** Senior

**Model answer:**
`useEffect` is for **synchronising a component with an external system** after render: subscriptions (WebSocket, event listeners), timers, imperative third-party widgets, analytics, and — in simple apps — data fetching with cleanup. Always return a cleanup and list all reactive dependencies.

You usually **don't** need an effect to:
- **Derive data** from props/state — compute during render (`const total = items.reduce(...)`), with `useMemo` if expensive.
- **Handle user events** — do it in the event handler (e.g. send the POST in `onSubmit`, not in an effect watching a flag).
- **Reset state when a prop changes** — use a `key`.
- **Sync two pieces of state** — restructure so one is derived.
- **Fetch data at scale** — use framework loaders or a data library (caching, deduplication, cancellation, no waterfalls).

Bugs from misuse: extra renders, flicker, stale data, infinite loops, race conditions. In Strict Mode, React mounts components twice in development to surface missing cleanups.

**What the interviewer is looking for:**
Correct purpose of effects, concrete alternatives and awareness of Strict Mode double-invocation.

**Follow-ups:**
- Why does my effect run twice in development?
- How do you avoid race conditions when fetching in an effect?

**Red flags:**
- Effects chains that set state based on other state.

### How do you identify and reduce unnecessary re-renders? {#rerenders}

**Level:** Senior

**Model answer:**
First **measure**: React DevTools Profiler (which components render, why, how long), Performance panel for long tasks and INP. Many re-renders are cheap; optimise only measured hotspots.

Techniques:
- **Colocate state** lower so updates affect smaller subtrees; split components so frequently changing parts are isolated.
- **Pass children/JSX as props** ("lifting content up") so a stateful wrapper doesn't re-render static children.
- **`React.memo`** for expensive child components with stable props; **`useMemo`/`useCallback`** to keep props referentially stable or cache expensive computations.
- **Split contexts** by update frequency; use selectors (external stores with `useSyncExternalStore`, or libraries like Zustand) to subscribe to slices.
- **Virtualise** long lists.
- **Transitions/`useDeferredValue`** to keep input responsive during heavy renders.
- **React Compiler** can automatically memoise components and values, reducing manual `useMemo`/`useCallback` (stable since 1.0 in October 2025).

**What the interviewer is looking for:**
Measurement first, structural fixes before memoisation, context strategies and modern tools.

**Follow-ups:**
- Why might `React.memo` not prevent a re-render?
- When is `useCallback` pointless?

**Red flags:**
- Wrapping everything in `useMemo` without profiling.

### What are the performance implications of React Context, and how do you manage them? {#context}

**Level:** Senior

**Model answer:**
When a context provider's `value` changes (by reference), **every consumer re-renders**, regardless of which part of the value it uses. Passing a new object each render (`value={{ user, setUser }}`) triggers re-renders even if contents didn't change.

Management:
- Use context for **low-frequency, widely needed values**: theme, locale, authenticated user, feature flags.
- **Memoise the value** (`useMemo`) and split state and dispatch into separate contexts.
- **Split contexts** by concern and update frequency.
- For **high-frequency or large shared state**, use an external store with selector subscriptions (`useSyncExternalStore`, Zustand, Redux Toolkit, Jotai) so components re-render only when their slice changes.
- Keep providers as low in the tree as practical.

**What the interviewer is looking for:**
Re-render behaviour, memoisation, splitting and when to choose stores with selectors.

**Follow-ups:**
- How does `useSyncExternalStore` help?
- Is Context a state management solution?

**Red flags:**
- A single giant context for all app state updated frequently.

### What do Suspense and transitions do? {#concurrent-rendering}

**Level:** Senior

**Model answer:**
React 18+ can prepare renders in the background and interrupt them (concurrent rendering):
- **Transitions** (`startTransition`, `useTransition`) mark state updates as **non-urgent**. Urgent updates (typing, clicks) render first; transition renders can be interrupted and restarted, keeping input responsive. `isPending` lets you show subtle loading indicators while the old UI stays visible.
- **`useDeferredValue`** gives you a lagging copy of a value so expensive children render with the old value while the input updates immediately.
- **Suspense** lets components "wait" for something — lazy-loaded code (`React.lazy`), or data from Suspense-enabled sources (framework loaders, libraries, `use(promise)`) — showing a fallback for that boundary. On the server, Suspense enables **streaming SSR**: sending HTML for ready parts first and streaming the rest.

Design: place Suspense boundaries around meaningful UI regions; avoid fallbacks flashing for fast loads (transitions keep old UI); combine with error boundaries.

**What the interviewer is looking for:**
Urgent vs non-urgent updates, deferred values, Suspense for code/data and streaming.

**Follow-ups:**
- How do transitions improve INP?
- Where would you place Suspense boundaries on a dashboard?

**Red flags:**
- Thinking Suspense fetches data by itself.

### What data-fetching patterns do you recommend in React apps? {#data-fetching}

**Level:** Senior

**Model answer:**
- **Server state is different from UI state:** it's owned remotely, can be stale, needs caching, revalidation, deduplication and error/loading handling.
- **Framework loaders/Server Components:** fetch on the server or at the route level in parallel, avoiding client waterfalls; stream with Suspense.
- **Client data libraries** (TanStack Query, SWR, RTK Query, Apollo/Relay for GraphQL): caching by key, background refetching, deduplication, retries, pagination, optimistic updates, cancellation, devtools.
- **Avoid hand-rolled `useEffect` fetching** in large apps — it causes waterfalls (child fetches after parent), race conditions and no caching.
- **Mutations:** invalidate or update affected queries; optimistic UI with rollback (`useOptimistic` or library support).
- **Prefetch** on hover/route transitions; **parallelise** independent requests.
- **Error and loading states** designed per region (Suspense + error boundaries).

**What the interviewer is looking for:**
Server state concept, loaders/RSC, client libraries' capabilities, avoiding effect-based fetching and mutation handling.

**Follow-ups:**
- How do you prevent request waterfalls?
- How would you implement optimistic "like" buttons?

**Red flags:**
- Storing all fetched data in a global Redux store manually.

### How do you test React components effectively? {#testing-react}

**Level:** Senior

**Model answer:**
- **React Testing Library** with Vitest/Jest: render components and interact like a user — query by role and accessible name (`getByRole('button', { name: 'Save' })`), use `user-event` for realistic interactions, assert on visible output and behaviour, not internal state or implementation details.
- **Mock at the network boundary** with MSW so data fetching code runs for real; cover loading, empty and error states.
- **Test custom hooks** through components or `renderHook` for complex logic; test pure logic (reducers, formatters) as plain functions.
- **Accessibility checks** (axe) in component tests.
- **End-to-end tests** (Playwright) for a few critical journeys.
- **Visual regression** for design-system components (Storybook + visual diff).
- Avoid shallow rendering and large snapshots.

**What the interviewer is looking for:**
User-centric testing, network mocking, appropriate levels and accessibility.

**Follow-ups:**
- How do you test a component using React Query?
- Why query by role rather than test ids?

**Red flags:**
- Tests asserting on state variables or CSS classes.

### Compare CSR, SSR, SSG and React Server Components. {#rendering-strategies}

**Level:** Architect

**Model answer:**
- **CSR:** the browser downloads JS and renders everything. Simple hosting, good for authenticated apps; slower first load, weaker SEO, larger bundles.
- **SSR:** the server renders HTML per request; the client **hydrates** (attaches event handlers by re-running components). Better first paint and SEO; costs server compute and hydration time (the page may look ready but not respond).
- **SSG/ISR:** pre-render at build time or periodically revalidate; served from CDN — excellent performance for content that doesn't change per request.
- **Streaming SSR with Suspense:** send HTML progressively as data resolves; improves time to first byte and LCP.
- **React Server Components (RSC):** components that run only on the server, can access data directly, and send a serialised UI description to the client — their code isn't shipped to the browser. Client components handle interactivity. Reduces client JS and moves data fetching next to data sources; requires framework support and a new mental model (serialisation boundaries, `'use client'`).

Choose per route: marketing and product pages (SSG/ISR/RSC), personalised dashboards (SSR/RSC with streaming), highly interactive tools behind login (CSR or RSC with heavy client components).

**What the interviewer is looking for:**
Clear trade-offs, hydration costs, RSC's distinctive benefit and per-route decisions.

**Follow-ups:**
- What causes hydration mismatches?
- What is partial/selective hydration?

**Red flags:**
- "SSR is always better."

### How do React Server Components change application architecture? {#server-components}

**Level:** Architect

**Model answer:**
- **Component boundaries become network boundaries:** Server Components run on the server (can query databases, call internal services, use secrets) and stream serialised output; Client Components (`'use client'`) run in the browser for interactivity. Props passed from server to client must be serialisable.
- **Less client JavaScript:** server-only code (formatting libraries, data access) never ships to the browser.
- **Data fetching moves into components on the server** — close to data, parallelised, with Suspense streaming; reduces client waterfalls and API surface.
- **Server Functions/Actions** let clients call server-side mutations directly (with framework-provided endpoints) — they are **public endpoints**: validate input and authorise every call.
- **Caching and revalidation** become central framework concerns (per request, per data source, on mutation).
- **Security:** avoid leaking secrets in props passed to client components; use server-only modules; treat serialised data as public.
- **Team implications:** frontend engineers own more server-side logic; observability and performance budgets span server and client.

Adopt incrementally: start with read-heavy routes, keep interactive islands as client components, define conventions for data access and caching.

**What the interviewer is looking for:**
Server/client boundary, serialisation, data fetching, Actions as endpoints, caching and security implications.

**Follow-ups:**
- How do you authorise a Server Action?
- When would you not use Server Components?

**Red flags:**
- Passing secrets or full database records as props to client components.

### How would you architect a large React application used by many teams? {#app-architecture}

**Level:** Architect

**Model answer:**
- **Framework and routing** chosen deliberately (SSR/RSC needs, deployment), with **route-based code splitting**.
- **Feature-based structure:** organise by domain/feature (`features/checkout`) rather than technical type; clear public APIs per feature; dependency rules enforced by lint (e.g. features can't import each other's internals).
- **Design system:** shared, accessible components and tokens (theming), documented in Storybook, versioned; enforces consistency and accessibility.
- **State strategy:** server state via a data-fetching library or framework loaders; local UI state colocated; minimal global client state for truly global concerns.
- **Type safety end to end:** TypeScript strict, API clients generated from contracts, runtime validation at boundaries.
- **Quality gates:** testing standards, accessibility checks, performance budgets (bundle size, Core Web Vitals in CI and RUM).
- **Ownership:** CODEOWNERS per feature; monorepo tooling (Nx/Turborepo) for builds and affected tests; micro-frontends only if team autonomy demands independent deployment.
- **Observability:** error tracking, RUM, feature flags.

**What the interviewer is looking for:**
Feature-based modularity, design system, state strategy, type safety, quality gates and ownership model.

**Follow-ups:**
- How do you prevent the design system becoming a bottleneck?
- Monorepo or micro-frontends?

**Red flags:**
- `components/`, `hooks/`, `utils/` folders shared by 20 teams with no boundaries.

### How do you keep a large React application fast over time? {#react-performance-at-scale}

**Level:** Architect

**Model answer:**
- **Budgets and monitoring:** per-route JS budgets in CI, Core Web Vitals from real users (RUM) segmented by route and device, alerts on regressions.
- **Ship less JS:** route and component-level splitting, lazy-loading heavy widgets (charts, editors, maps), Server Components/SSR where appropriate, removing unused dependencies, analysing bundles on every PR.
- **Render efficiently:** colocated state, selector-based stores, virtualisation, transitions for heavy updates, profiling hot paths, React Compiler adoption.
- **Data:** parallel fetching, caching, prefetching, avoiding waterfalls; streaming with Suspense.
- **Assets:** image optimisation (responsive sizes, modern formats, lazy loading, priority for LCP image), font loading strategies.
- **Third-party scripts** governed and measured.
- **Culture:** performance is part of the definition of done; dashboards visible to teams; performance reviews for new features.

**What the interviewer is looking for:**
Budgets, field measurement, less JS, rendering techniques, data patterns, assets, third parties and culture.

**Follow-ups:**
- How do you attribute a performance regression to a specific PR?
- What's your approach to third-party tag managers?

**Red flags:**
- Performance work only when users complain.

### How would you modernise a legacy React codebase? {#react-migration}

**Level:** Architect

**Model answer:**
Typical legacy: class components, Create React App or old webpack config, Redux for everything including server data, old React version, little TypeScript, enzyme tests.

Plan (incremental, measured):
1. **Tooling first:** move the build to Vite or a framework; upgrade React (follow upgrade guides, codemods), enable Strict Mode to surface issues.
2. **TypeScript adoption** incrementally (`allowJs`, strictness ratchets).
3. **Tests:** migrate from enzyme to Testing Library as components are touched; add characterisation tests for critical flows.
4. **Data fetching:** replace Redux-managed server data with a data-fetching library, shrinking Redux to genuine client state (or removing it).
5. **Components:** convert class components to function components with hooks when they change ("boy scout"), not in a big bang; codemods for mechanical parts.
6. **Routing/rendering:** adopt a modern router or framework; consider SSR/RSC for public pages where it pays off.
7. **Design system** consolidation and accessibility fixes.

Measure progress (percent TS, bundle size, test coverage of critical flows, Web Vitals) and keep feature delivery going throughout.

**What the interviewer is looking for:**
Incremental sequencing, tooling and upgrades, testing migration, server-state extraction and metrics.

**Follow-ups:**
- Would you rewrite in a new framework instead?
- How do you upgrade across multiple React majors safely?

**Red flags:**
- Freezing features for a six-month rewrite.

### When would you use `useRef` instead of `useState`? {#useref-vs-usestate}

**Level:** Foundation

**Model answer:**
Both persist a value across renders. The difference is whether changing it should **update what's on screen**.

| | `useState` | `useRef` |
|---|---|---|
| Changing it triggers a re-render | Yes | No |
| How you change it | The setter function | Assign to `ref.current` directly |
| Value during render | A snapshot for that render | Whatever `current` holds now |
| Use for | Anything shown in the UI | Values the UI doesn't depend on |

Use **`useRef`** for:
- **DOM elements**: focusing an input, measuring size, integrating a non-React widget (`<input ref={inputRef} />`).
- **Mutable instance values** that don't affect rendering: timer and interval ids, an `AbortController`, the previous value of a prop, a flag such as "has this request been sent?".
- **Values read in callbacks** without wanting re-renders.

Use **`useState`** whenever the value appears in the UI or should cause the component to update. Storing displayed data in a ref means the screen won't update when it changes.

Two cautions:
- **Don't read or write `ref.current` during render** (except for lazy initialisation). It makes rendering impure and unpredictable.
- In React 19, `ref` is a regular prop for function components, so passing a ref to a child no longer needs `forwardRef`.

**What the interviewer is looking for:**
Re-render versus no re-render, DOM and instance-value uses, and not touching refs during render.

**Follow-ups:**
- How would you keep track of the previous value of a prop?
- Why might a value stored in a ref appear stale in the UI?

**Red flags:**
- Storing displayed data in a ref to "avoid re-renders".
- Using state for timer ids, causing pointless re-renders.

### What problems do `<Activity>` and `useEffectEvent` solve? {#activity-useeffectevent}

**Level:** Senior

**Model answer:**
Both arrived as stable features in **React 19.2** (October 2025).

**`<Activity>`** hides part of the UI **without unmounting it**:

```tsx
<Activity mode={tab === 'details' ? 'visible' : 'hidden'}>
  <DetailsPanel />
</Activity>
```

- Before, hiding meant conditional rendering (`{show && <Panel />}`), which **destroys state** (form inputs, scroll position, fetched data) and rebuilds it next time. Or CSS hiding, which keeps everything **running**: effects, subscriptions and re-renders.
- With `mode="hidden"`, React keeps the component's state and DOM, but **cleans up its effects** and gives its updates low priority. Returning to `visible` restores it instantly, with effects set up again.
- Uses: tabs and navigation where users return to the same place, and **pre-rendering** a likely next screen in the background.

**`useEffectEvent`** separates "event-like" logic from an effect's dependencies:

```tsx
const onConnected = useEffectEvent(() => showToast(`Connected to ${roomId}`, theme));

useEffect(() => {
  const conn = connect(roomId);
  conn.on('connected', onConnected);  // reads the latest theme
  return () => conn.disconnect();
}, [roomId]);                          // theme isn't a dependency: changing it doesn't reconnect
```

- Without it, using `theme` inside the effect forces it into the dependency list, so changing the theme would **reconnect** to the room. The usual workarounds were silencing the lint rule (risking stale values) or refs.
- An effect event always sees the **latest** props and state, but isn't reactive. Only call it from inside effects, never during render or as a prop.

**What the interviewer is looking for:**
Hiding while keeping state versus unmounting or CSS hiding, effects cleaned up while hidden, and separating non-reactive logic from effect dependencies.

**Follow-ups:**
- What happens to a hidden Activity's subscriptions?
- Why can't you pass an effect event to a child as a callback prop?

**Red flags:**
- Disabling the exhaustive-deps lint rule to avoid re-running effects.
- Keeping hidden tabs mounted with CSS, with all their effects still running.

### How do you build forms with React 19 Actions? {#react-actions-forms}

**Level:** Senior

**Model answer:**
**Actions** are async functions used for transitions, especially form submissions. React tracks their **pending state**, errors and results, so you don't hand-roll `isSubmitting` flags.

```tsx
async function saveProfile(prev: State, formData: FormData): Promise<State> {
  const result = await api.updateProfile({ name: String(formData.get('name')) });
  return result.ok ? { status: 'saved' } : { status: 'error', message: result.error };
}

function ProfileForm() {
  const [state, formAction, isPending] = useActionState(saveProfile, { status: 'idle' });
  return (
    <form action={formAction}>
      <input name="name" required />
      <SubmitButton />
      {state.status === 'error' && <p role="alert">{state.message}</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();          // reads the parent form's status
  return <button disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>;
}
```

The pieces:
- **`<form action={fn}>`**: React calls the action with the form's `FormData`, wraps it in a transition, and resets uncontrolled fields after success.
- **`useActionState`**: keeps the action's last result (success or error messages) and a pending flag.
- **`useFormStatus`**: lets a nested component such as the submit button read the form's pending state without prop drilling.
- **`useOptimistic`**: shows the expected result immediately ("comment posted"), reverting automatically if the action fails.

With a framework, actions can be **Server Functions**, so the form works even before JavaScript loads (progressive enhancement), and the function runs on the server.

**Keep the basics:** validate on the server whatever the client does, show errors next to fields and announce them to screen readers, and make submissions idempotent, because users double-click and networks retry.

**What the interviewer is looking for:**
What Actions are, `useActionState`, `useFormStatus` and `useOptimistic`, progressive enhancement with Server Functions, and server-side validation.

**Follow-ups:**
- When would you still use a form library such as React Hook Form?
- How do you show field-level errors returned from a Server Function?

**Red flags:**
- Manual loading flags and `preventDefault` boilerplate for every form.
- Trusting client-side validation alone.

### How do you secure applications that use React Server Components and Server Functions? {#rsc-security}

**Level:** Architect

**Model answer:**
Server Components and Server Functions blur the line between client and server code. That is convenient, and it creates **new server-side attack surface** that must be treated like any API.

**A real example:** in December 2025, a critical remote code execution vulnerability (**CVE-2025-55182**, rated 10.0) was disclosed in React's Server Components packages. Specially crafted requests to Server Function endpoints could run code on the server, affecting React 19.0 to 19.2 and frameworks built on them, such as the Next.js App Router. Follow-up advisories added denial-of-service and source-code exposure issues, and the first patches were incomplete, so safe versions became **19.0.3, 19.1.4, 19.2.3 or later**. Teams that couldn't upgrade quickly were exposed even if their own code was flawless.

**Treat every Server Function as a public HTTP endpoint:**
- Anyone can call it with any arguments, not just your UI. **Authenticate and authorise inside the function**, every time. Don't rely on the button only being shown to admins.
- **Validate inputs** with a schema, because the arguments come from the network, whatever TypeScript says.
- Apply **rate limiting**, CSRF protections (frameworks provide some by default, so understand which), and idempotency for side effects.

**Don't leak server data into the client:**
- Everything a Server Component passes as props to a Client Component is **serialised and sent to the browser**. Pass the minimal fields, not whole database records with internal or personal data.
- Keep secrets in server-only modules. Mark them with `server-only` imports (or the framework's equivalent), so an accidental import into client code fails the build.
- Use framework features for **tainting** sensitive values where available.

**Supply chain and patching:**
- React, the framework and the bundler integration are now part of your **server's attack surface**. Track their advisories, keep automated dependency updates flowing, and be able to deploy a framework patch the same day.
- A WAF can provide temporary protection for known exploit patterns while you patch, but it doesn't replace patching.

**What the interviewer is looking for:**
Server Functions as public endpoints with authorisation and validation, serialisation leaks across the boundary, server-only modules, and awareness of the 2025 RSC vulnerabilities and fast patching.

**Follow-ups:**
- How would you find every Server Function in a large codebase and check its authorisation?
- A Server Component passes a full user record to a client component. What's the risk?

**Red flags:**
- Assuming Server Functions are private because they aren't in an API route file.
- Months-old framework versions in production.

### How would you adopt the React Compiler in a large codebase? {#adopting-react-compiler}

**Level:** Architect

**Model answer:**
The **React Compiler** (stable since 1.0 in October 2025) analyses components and hooks at build time and inserts memoisation automatically, so manual `useMemo`, `useCallback` and `React.memo` are rarely needed. It only works correctly on code that follows the **Rules of React**: pure rendering, no mutation of props or state, hooks called unconditionally.

**1. Measure and prepare:**
- Record a baseline: interaction latency (INP), render counts and timings in key flows with the React Profiler, and bundle size.
- Turn on the **React Hooks ESLint plugin's compiler-related rules** first, and fix violations. They show where code breaks the rules the compiler relies on. These are often real bugs anyway.

**2. Roll out incrementally:**
- Enable the compiler for a **directory or package at a time** (it supports opt-in modes), starting with leaf UI components and well-tested areas.
- The compiler **skips components it can't safely optimise**, rather than breaking them. Its reports show which ones were skipped, and why.
- Use the `"use no memo"` directive as a temporary escape hatch for a component that misbehaves, with a ticket to fix it.

**3. Verify:**
- Run the full test suite and end-to-end tests. Watch for behaviour that depended on re-rendering, such as effects that silently relied on a new object identity each render.
- Compare the profiler numbers with the baseline. Expect fewer re-renders in typical apps. The gains are largest in apps with lots of context or prop changes.

**4. Clean up gradually:**
- Remove manual memoisation once the compiler covers an area, as normal refactoring rather than a big-bang change. Keep `useMemo` where it expresses something the compiler can't know, such as truly expensive computations with explicit caching intent.

**5. Make it the default:** new code is written for the compiler (pure, rules-compliant), with lint rules enforced in CI.

**What the interviewer is looking for:**
What the compiler does and its reliance on the Rules of React, lint-first preparation, incremental rollout with skip reports, verification against a baseline, and gradual clean-up.

**Follow-ups:**
- A component behaves differently once compiled. How do you investigate?
- Does the compiler remove the need to understand re-renders?

**Red flags:**
- Turning it on everywhere at once with no baseline.
- Disabling the lint rules that flag Rules of React violations.

## Cheat Sheet

### Fundamentals
- **UI = f(state)** — components render from props and state; data down, events up.
- **Derive, don't duplicate** — compute values during render instead of syncing state.
- **Rules of hooks** — top level only, from components or custom hooks; order must not change.
- **Keys** — stable ids, not indexes, for dynamic lists; change a key to reset state.
- **Controlled vs uncontrolled** — React state as source of truth vs DOM/FormData.

### Effects and rendering
- **useEffect** — synchronise with external systems; always clean up; list all dependencies.
- **You might not need an effect** — derived data, event handling and resets don't need effects.
- **Strict Mode double render** — development-only check for impure renders and missing cleanups.
- **Context re-renders** — every consumer re-renders when the value changes; split or use selectors.
- **Memoisation** — measure first; React Compiler can automate.
- **Transitions** — non-urgent updates that keep input responsive.
- **Suspense** — fallbacks while code or data loads; enables streaming SSR.

### Architecture
- **Server state vs client state** — use data libraries/loaders for server data.
- **Hydration** — attaching interactivity to server-rendered HTML; mismatches cause bugs.
- **Server Components** — run only on the server, ship no JS; Server Actions are public endpoints.

### Revisit

- **Index keys and state** — state follows the key, not the item. Removing the first row with index keys shifts quantities to the wrong items. Use stable ids.
- **Render cycle** — setState records an update, React batches and renders pure components, reconciles by type and key, commits minimal DOM changes, then runs effects after paint.
- **`useRef` vs `useState`** — refs persist without re-rendering (DOM nodes, timer ids, controllers). State is for anything shown on screen.
- **`<Activity>` (19.2)** — hides UI while keeping state, and cleans up effects while hidden. Good for tabs and pre-rendering.
- **`useEffectEvent` (19.2)** — non-reactive logic inside effects that reads the latest values without becoming a dependency.
- **Actions** — `<form action>`, `useActionState`, `useFormStatus` and `useOptimistic` replace hand-rolled pending and error state.
- **RSC security** — Server Functions are public endpoints: authorise and validate inside them, minimise serialised props, and patch fast (CVE-2025-55182).

## Further Reading

- [react.dev: Learn React](https://react.dev/learn) — the official documentation and mental model.
- [react.dev: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) — when effects are the wrong tool.
- [react.dev: React 19 release notes](https://react.dev/blog/2024/12/05/react-19) — Actions, `use`, Server Components and more.
- [React Compiler documentation](https://react.dev/learn/react-compiler) — automatic memoisation.
- [Testing Library: React](https://testing-library.com/docs/react-testing-library/intro/) — user-centric component testing.
- [TanStack Query documentation](https://tanstack.com/query/latest) — server-state management patterns.
