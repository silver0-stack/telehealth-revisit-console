# Decisions

Each entry: what we chose, why, and what we gave up. Newest at the bottom.

## D1. pnpm 10 via corepack, not pnpm 12 (2026-10-22)
pnpm 12 ships its entry point as `bin/pnpm.mjs`, but the corepack bundled with Node 24.11 (0.34.2)
still looks for `bin/pnpm.cjs` and crashes. `packageManager` pins `pnpm@10.34.7`, which corepack runs fine.
Revisit when Node ships a newer corepack.

## D2. TypeScript 6, not 7 (2026-10-22)
TypeScript 7 is the native (Go) compiler and has no JavaScript API. Next.js build-time type checking and
typescript-eslint (inside eslint-config-next) both load that API, so they break on 7. We use 6.0.x until
those tools support 7.

## D3. Seed script runs on Node's built-in TypeScript support (2026-10-22)
`pnpm seed` is `node scripts/seed.ts`. Node 24 strips types natively, so we avoid adding tsx/ts-node.
The cost: files the script imports use explicit `.ts` extensions, and `erasableSyntaxOnly` +
`verbatimModuleSyntax` in tsconfig forbid syntax Node cannot strip (enums, non-`type` type imports).

## D4. Visit dates are calendar dates, not timestamps (2026-10-22)
`Visit.date` is `yyyy-MM-dd` in Asia/Seoul. Eligibility is counted in days, and a timestamp would
make the boundary day depend on the server's timezone. Request times keep a full ISO string with `+09:00`.

## D5. Own seeded PRNG instead of a faker library (2026-10-22)
A 10-line mulberry32 function gives reproducible data. A faker library would add a dependency and
risk producing realistic-looking names, phone numbers or addresses, which hard rule 1 forbids.
