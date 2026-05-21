# @iwantfyi/sdk

TypeScript SDK for [iwant.fyi](https://iwant.fyi) — the reference implementation of the [iwant.fyi demand-side protocol v1.0](https://iwant.fyi/protocol/v1).

> **iwant.fyi demand-side protocol** is an open standard for how AI agents express structured purchase intent on behalf of users, receive matched supply across multiple sources, and report outcomes back. iwant.fyi is the reference implementation.

## Install

```bash
npm install @iwantfyi/sdk
```

## Quick start

```typescript
import { IwantClient } from "@iwantfyi/sdk";

const client = new IwantClient({
  apiKey: process.env.IWANT_API_KEY!, // iwant_ak_...
});

const { want, matches } = await client.createWant({
  title: "Torque wrench, 1/4\" drive, 25-100 ft-lb",
  description: "Calibrated within last 2 years. Open to new or used.",
  price_cents: 15000,
  price_currency: "USD",
  category: "goods",
  vertical: "tools",
  mode: "any",
  location: { text: "Brooklyn, NY" },
  constraints: {
    rules: {
      price_max: 15000,
      condition_min: "good",
    },
  },
  origin: {
    agent_id: "your-agent-id",
    agent_name: "Your Agent",
  },
});

console.log(`Created want ${want.id} with ${matches.match_count} matches`);
for (const m of matches.matches) {
  console.log(`  ${m.title} -- $${m.price_cents / 100} -- ${m.url}`);
}
```

## Get an API key

1. Visit [iwant.fyi](https://iwant.fyi) and sign in
2. Register an agent at `POST /api/agents` (or via the UI when available)
3. Save the returned key (format: `iwant_ak_...`)

## Methods

All methods are async and typed against the iwant.fyi demand-side protocol v1.0 schema.

| Method | Spec | Description |
|---|---|---|
| `createWant(input)` | §8.1 | Create a Want and run matching |
| `search(input)` | §8.1 | Ephemeral matching, no persistence |
| `getWant(wantId)` | §8.1 | Retrieve a Want by ID |
| `recordOutcome(input)` | §8.1 | Report a viewed/clicked/purchased/etc. outcome |
| `listVerticals()` | §8.2 | Discover supported verticals |
| `listConstraints()` | §8.2 | Discover supported constraint vocabulary |
| `health()` | §8.2 | Liveness + readiness |
| `callTool(name, args)` | escape hatch | Call any MCP tool by name |

## Transport

By default, the SDK uses MCP over HTTP (JSON-RPC). Switch to the REST fallback by passing `transport: "http"`:

```typescript
const client = new IwantClient({
  apiKey: "iwant_ak_...",
  transport: "http",
});
```

Both transports support all `demand.*` tools. Legacy iwant.fyi tools (like `browse_wants`, `search_listings`) only work over MCP transport.

## Outcome events

Outcome events feed match-quality training and (eventually) revenue-share attribution back to the originating agent. They're optional but strongly recommended:

```typescript
// User clicked through to the merchant
await client.recordOutcome({
  want_id: want.id,
  match_id: chosenMatch.id,
  event: "clicked",
  match_source: chosenMatch.source,
});

// User completed a purchase
await client.recordOutcome({
  want_id: want.id,
  match_id: chosenMatch.id,
  event: "purchased",
  value_cents: 12500,
});
```

Events are idempotent on `(want_id, match_id, event, agent_id, timestamp)`. Replays are no-ops.

## Errors

The SDK throws typed errors with JSON-RPC error codes:

```typescript
import { IwantError, UnauthorizedError, ValidationError, RateLimitedError } from "@iwantfyi/sdk";

try {
  await client.createWant({ /* ... */ });
} catch (err) {
  if (err instanceof UnauthorizedError) { /* refresh key */ }
  else if (err instanceof ValidationError) { /* fix input */ }
  else if (err instanceof RateLimitedError) { /* back off */ }
  else if (err instanceof IwantError) { /* err.code, err.message */ }
}
```

## Specification

Full iwant.fyi demand-side protocol v1.0 specification: [iwant.fyi/protocol/v1](https://iwant.fyi/protocol/v1)

The protocol is published under Apache 2.0. iwant.fyi is the reference implementation; anyone may build their own.

## License

Apache 2.0
