---
id: typescript
title: "TypeScript"
group: languages-frontend
tags: [language, type-system]
level: Senior
estimatedMinutes: 75
related: [javascript, reactjs, nodejs]
lastReviewed: 2026-11-19
status: draft
---

## TL;DR

- TypeScript is a **compile-time** tool: types are erased, so every trust boundary (HTTP, queues, storage, `JSON.parse`) still needs runtime validation.
- The type system is **structural**, not nominal. Two types with the same shape are interchangeable, which is convenient until an `OrderId` is accepted where a `UserId` was expected; use branded types for identifiers.
- The highest-leverage features are **discriminated unions + exhaustive checks**, `unknown` at boundaries, and `strict` mode. Clever conditional types are rarely where the value is.
- At scale, TypeScript is a **build-performance and module-boundary** problem: project references, `isolatedDeclarations`, and keeping type-only imports cheap.
- The toolchain is shifting: TypeScript 7 is a native (Go) port of the compiler, and Node.js can now run `.ts` files by stripping types. Both reward "erasable-only" syntax (no `enum`, no `namespace`).

## Core Concepts

### Structural typing and its escape hatches

A value is assignable to a type if it has *at least* the required members. That makes mocking and adapters easy, but it means the compiler cannot tell two semantically different strings apart.

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };
type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

const asUserId = (raw: string): UserId => raw as UserId; // the only place a cast is allowed

function cancelOrder(id: OrderId) { /* ... */ }
cancelOrder(asUserId('u_123')); // ✖ compile error: UserId is not assignable to OrderId
```

Excess-property checks are the one place TypeScript behaves "nominally-ish": object **literals** with unknown keys are rejected, but the same object passed through a variable is not.

### `any`, `unknown` and `never`

- `any` switches the checker off *and spreads*: anything derived from `any` is `any`.
- `unknown` is the type-safe top type. You must narrow it before use, so it is the right type for data you don't control.
- `never` is the empty type. It is what's left after you've handled every case, which is why it powers exhaustiveness checks.

### Discriminated unions and exhaustiveness

Model states so illegal combinations cannot be represented, then let the compiler prove every state is handled.

```ts
type Payment =
  | { status: 'pending'; createdAt: Date }
  | { status: 'settled'; settledAt: Date; reference: string }
  | { status: 'failed'; reason: 'card_declined' | 'fraud' | 'timeout' };

function describe(p: Payment): string {
  switch (p.status) {
    case 'pending': return `Pending since ${p.createdAt.toISOString()}`;
    case 'settled': return `Settled (${p.reference})`;
    case 'failed':  return `Failed: ${p.reason}`;
    default: {
      const unreachable: never = p; // adding a new status breaks the build here
      return unreachable;
    }
  }
}
```

### Validate at the boundary, infer inside

Types describe what you *believe*; a schema library checks what you *receive*. Derive the type from the schema so the two cannot drift.

```ts
import { z } from 'zod';

const OrderEvent = z.object({
  orderId: z.string().min(1),
  total: z.number().nonnegative(),
  currency: z.enum(['GBP', 'EUR', 'USD']),
});
type OrderEvent = z.infer<typeof OrderEvent>;

export function parseOrderEvent(body: unknown): OrderEvent {
  return OrderEvent.parse(body); // throws with a precise path on bad input
}
```

### Generics, constraints and inference

Good generics *relate* inputs to outputs. If a type parameter appears only once, it is usually not needed.

```ts
// The key type K links the argument to the return type.
function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map((i) => i[key]);
}

// `satisfies` checks a value against a type without widening it.
const routes = {
  home: '/',
  topic: '/topics/:id',
} satisfies Record<string, `/${string}`>;
type RouteName = keyof typeof routes; // 'home' | 'topic', not string
```

### Erasable syntax and the changing toolchain

Node.js can execute TypeScript directly by **stripping** type annotations. VERIFY: type stripping is enabled by default from Node.js 23.6 and was backported to 22.18. Stripping cannot handle syntax that generates runtime code: `enum`, `namespace` with values, and constructor parameter properties. TypeScript 5.8 added `--erasableSyntaxOnly` to forbid those constructs. Prefer union literal types or `as const` objects over `enum`.

TypeScript 7 is the native port of the compiler and language service, giving large speed-ups on big codebases. VERIFY: TypeScript 7 removes several long-deprecated options (for example `target: ES5` and `moduleResolution: node10`). Check your `tsconfig` against the release notes before upgrading.

## How It Works

The compiler parses, binds symbols, type-checks, then emits. Type information is used only up to the checker; everything after that is plain JavaScript.

```mermaid
flowchart LR
  src[".ts / .tsx source"] --> parse[Parser → AST]
  parse --> bind[Binder: symbols & scopes]
  bind --> check[Checker: types, inference, errors]
  check --> emit[Emitter: .js + .d.ts + source maps]
  src -. "type stripping (Node, esbuild, swc)" .-> js[".js at runtime"]
  emit --> js
  check -. "editor: language service" .-> ide[IDE feedback]
```

Bundlers (esbuild, swc, Vite) usually only *strip* types per file for speed and run `tsc --noEmit` separately for checking. That is why `isolatedModules` matters: each file must be transpilable without whole-program type information.

## When to Use / Trade-offs

| Technique | Use when | Avoid when | Cost |
|---|---|---|---|
| `strict: true` | Always on new code | — | Migration effort on legacy code |
| Branded types | IDs, money, units, sanitised strings | Values with no mix-up risk | Constructor/cast functions at the boundary |
| Runtime schemas (Zod, Valibot) | Any untrusted input | Purely internal calls | Bundle size, small runtime cost |
| Conditional / mapped types | Library-level APIs, deriving types from config | App code where a plain type is clearer | Readability, slower type-checking |
| `enum` | Rarely; legacy code | Code run via type stripping | Runtime object, not erasable |
| Project references | Monorepos, more than ~100k LOC | Small single packages | Build configuration complexity |

## Common Pitfalls & Anti-patterns

- **Casting instead of validating** — `as User` on `await res.json()` lies to the compiler; the bug surfaces far from the cause.
- **`any` leakage** — one `any` in a shared util silently disables checking for every caller. Lint with `no-explicit-any` and `no-unsafe-*`.
- **Optional-everything types** — `{ a?: X; b?: Y }` instead of a union of valid states. The code then fills with defensive checks.
- **Type-level over-engineering** — 40-line conditional types that only one person understands; they also slow down the editor for everyone.
- **Trusting `strictNullChecks` with arrays** — `arr[0]` is typed `T`, not `T | undefined`, unless `noUncheckedIndexedAccess` is on.
- **Barrel files everywhere** — `index.ts` re-exports defeat tree-shaking in some setups and cause slow type-checking and circular imports.

## Real-world Scenario

**Context:** A payments platform team (12 engineers, ~300k LOC TypeScript) had repeated production incidents where webhook payloads from a provider changed shape. Types said `amount: number`; the provider started sending strings for some currencies.

**Decision:** Every inbound adapter got a Zod schema as the single source of truth, with the TS type inferred from it. Parsing failures went to a dead-letter queue with the schema error path attached. Money became a branded `Minor<'GBP'>` integer type.

**Outcome:** The next provider change produced 40 DLQ messages with exact error paths instead of corrupted ledger entries. Type-check time grew ~8%, offset by moving to project references.

**What I'd do differently:** Generate the schemas from the provider's OpenAPI spec and run a contract test nightly, so drift is found before production does.

## Interview Questions

### What is the difference between `any`, `unknown` and `never`, and when do you use each? {#unknown-any-never}

**Level:** Foundation

**Model answer:**
`any` opts out of type checking and is contagious: results of operations on `any` are also `any`. `unknown` is the safe top type: anything is assignable to it, but you must narrow it (`typeof`, `instanceof`, a schema parse) before using it. `never` is the bottom type with no values. It appears after exhaustive narrowing, as the return type of functions that throw or never return, and in conditional types to filter members out.

Use `unknown` for untrusted input (`catch (e)`, `JSON.parse`, API bodies), `never` for exhaustiveness checks, and `any` only as a temporary migration aid behind a lint rule.

**What the interviewer is looking for:**
That `unknown` is the default for the edges of a system and `any` is a deliberate, tracked exception. Strong candidates mention `useUnknownInCatchVariables` (on under `strict`).

**Follow-ups:**
- How would you find and reduce `any` usage across a large codebase?
- Why does `catch (e)` give you `unknown` under `strict`?

**Red flags:**
- "`unknown` and `any` are basically the same."
- Using `any` to "fix" a compile error without explaining the risk.

### How do discriminated unions help model domain state, and how do you guarantee every case is handled? {#discriminated-unions}

**Level:** Senior

**Model answer:**
A discriminated union is a union of object types sharing a literal property (the discriminant, e.g. `status`). Narrowing on that property gives access to the fields valid only in that state, so illegal combinations (a `failed` payment with a `settledAt`) cannot be represented.

To guarantee exhaustiveness, assign the value to a `never` variable in the `default` branch, or use a helper `assertNever(x: never)`. Adding a new variant then fails compilation everywhere it isn't handled. The compiler does the impact analysis for you.

**What the interviewer is looking for:**
"Make illegal states unrepresentable" as a design principle, not just syntax. Bonus: the same idea applied to API responses and reducer actions, and the caveat that the data must still be validated at runtime to actually be in one of those states.

**Follow-ups:**
- How would you serialise and validate a discriminated union arriving over HTTP?
- When does a union become unwieldy and a class hierarchy or state machine library is better?

**Red flags:**
- Modelling state with several optional booleans (`isLoading`, `isError`, `isDone`).
- Not knowing how to make the compiler flag unhandled cases.

### TypeScript is structurally typed. Where does that bite you, and what do you do about it? {#branded-types}

**Level:** Senior

**Model answer:**
Any two types with compatible shapes are interchangeable, so `UserId` and `OrderId` (both `string`) can be swapped silently, as can `Celsius` and `Fahrenheit` numbers. Branded (or "opaque") types intersect the primitive with a unique phantom property, so values must come through a constructor function that validates or at least marks them.

Other structural surprises: methods are checked bivariantly (unless `strictFunctionTypes` applies to function *properties*), and excess-property checks only apply to fresh object literals.

**What the interviewer is looking for:**
Concrete examples of mix-up bugs, a branding technique, and keeping the cast in exactly one place.

**Follow-ups:**
- How do brands interact with JSON serialisation and schema libraries?
- Would you brand every string in the domain? Where do you stop?

**Red flags:**
- Believing TypeScript is nominal like Java or C#.
- Branding by sprinkling `as` casts throughout the codebase.

### Your service's types say a field is always present, yet production crashes reading it. How did that happen and how do you prevent it? {#runtime-validation}

**Level:** Senior

**Model answer:**
Types are erased at runtime. Somewhere data crossed a boundary (HTTP response, message, DB row, `localStorage`, a third-party SDK typed with `any`) and was *asserted* to have a type with `as` or an untyped return, never *checked*.

Prevention:
1. Treat every boundary as `unknown` and parse with a schema (Zod, Valibot, or generated validators from OpenAPI/JSON Schema).
2. Infer the TS type from the schema so there is one source of truth.
3. Fail loudly at the edge (reject the request, dead-letter the message) with the error path.
4. Lint against unsafe `any` flows (`@typescript-eslint/no-unsafe-*`), and enable `noUncheckedIndexedAccess`.

**What the interviewer is looking for:**
A clear mental model that TS is compile-time only, plus a systematic boundary strategy rather than "add more null checks".

**Follow-ups:**
- What is the performance cost of validating every message, and when would you skip it?
- How do you keep schemas in sync with another team's API?

**Red flags:**
- "Add optional chaining everywhere."
- Not realising `res.json()` returns `any`.

### You inherit a 500k-line JavaScript codebase with weak tests. How would you migrate it to strict TypeScript without freezing feature work? {#large-migration}

**Level:** Architect

**Model answer:**
Treat it as an incremental, measurable programme, not a big-bang rewrite:

1. **Enable TS with `allowJs` + `checkJs: false`** so the build accepts both; ship nothing new in JS (lint rule).
2. **Convert leaves first.** Utilities and domain models have the most dependants and the fewest dependencies, so types propagate upward.
3. **Strictness ratchet.** Turn on `strict` per directory using separate `tsconfig`s or project references, or use a tool that tracks error counts and only allows them to go down in CI.
4. **Boundaries early.** Add runtime schemas for API and DB edges first; that's where the real bugs are.
5. **Track it.** Count files converted, `any` and `@ts-expect-error` totals, and type-check time on a dashboard; review monthly.
6. **Codemods** for mechanical work (e.g. `ts-migrate`, or AI-assisted conversion reviewed by humans), and humans for domain modelling.

Expect type-checking to surface real latent bugs. Budget time to fix them and test around them.

**What the interviewer is looking for:**
Sequencing, risk management, measurable progress, and not stopping delivery. Architect-level answers talk about ownership (who converts what), CI enforcement, and communication of value to non-engineers.

**Follow-ups:**
- How would you prioritise which modules to convert first?
- How do you stop the `any` count from creeping back up?
- What would make you abandon or pause the migration?

**Red flags:**
- "Freeze features and rewrite it."
- Turning on `strict` globally on day one and littering `// @ts-ignore`.

### Type-checking in your monorepo takes 9 minutes in CI and editors are sluggish. What do you do? {#monorepo-build-performance}

**Level:** Architect

**Model answer:**
First measure: `tsc --extendedDiagnostics` and `--generateTrace` show which files and types dominate.

Then:
- **Project references** (`composite: true`) so packages build incrementally and editors load only what they need.
- **`isolatedDeclarations`** (TS 5.5+) so `.d.ts` files can be emitted per file by fast tools, without whole-program inference.
- **Explicit return types on exported functions** to stop expensive inference chains.
- **Simplify hot types**: huge unions, deep conditional types, and generic-heavy libraries (some ORMs and form libs) often dominate check time.
- **Remove barrel files** that force loading entire packages.
- **Cache** `tsbuildinfo` in CI.
- **Evaluate the TypeScript 7 native compiler.** VERIFY: Microsoft reports roughly 10x faster full builds on large projects.

**What the interviewer is looking for:**
Measure before optimising; knowing the levers at the architecture level (package boundaries) rather than only compiler flags.

**Follow-ups:**
- What trade-offs do project references introduce for developers?
- How would you prevent regressions in type-check time?

**Red flags:**
- "Turn off type checking in CI and rely on the editor."
- Jumping straight to a new tool without profiling.

## Cheat Sheet

### Types

- **`unknown` vs `any`** — `unknown` must be narrowed before use; `any` disables checking and spreads.
- **`never`** — the empty type; use for exhaustiveness checks via `const x: never = value`.
- **Discriminated union** — a union with a shared literal field; narrowing on it unlocks state-specific fields.
- **Branded type** — `T & { __brand: 'X' }` to make structurally identical types incompatible.
- **`satisfies`** — checks a value against a type but keeps the narrower inferred type.

### Configuration

- **`strict`** — turns on the strict family, including `strictNullChecks` and `useUnknownInCatchVariables`.
- **`noUncheckedIndexedAccess`** — index access returns `T | undefined`; catches off-by-one and missing-key bugs.
- **`isolatedModules`** — every file must be transpilable on its own; required by esbuild/swc/Vite.
- **`erasableSyntaxOnly`** — bans `enum`, value `namespace` and parameter properties so type stripping works.
- **Project references** — split a large codebase into incrementally built projects with `composite: true`.

### Runtime

- **Types are erased** — validate all untrusted input with a schema and infer the type from it.

## Further Reading

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) — the official language guide.
- [TSConfig reference](https://www.typescriptlang.org/tsconfig/) — every compiler option, with explanations.
- [TypeScript release notes](https://www.typescriptlang.org/docs/handbook/release-notes/overview.html) — what changed and what was deprecated, version by version.
- [Node.js: running TypeScript natively](https://nodejs.org/api/typescript.html) — type stripping and its limits.
- [Zod documentation](https://zod.dev/) — schema-first runtime validation with inferred types.
