/**
 * Minimal example: create a Want, log matches, record an outcome.
 *
 * Run:
 *   IWANT_API_KEY=iwant_ak_... node --experimental-strip-types examples/basic.ts
 */

import { IwantClient } from "../dist/index.js";

const client = new IwantClient({
  apiKey: process.env.IWANT_API_KEY!,
});

const health = await client.health();
console.log(`Server: ${health.server} v${health.version} (protocol ${health.protocol_version})`);

const { want, matches } = await client.createWant({
  title: 'Torque wrench, 1/4" drive, 25-100 ft-lb',
  description: "Calibrated within last 2 years. Good condition acceptable.",
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
    negotiable: ["price_max"],
  },
  origin: {
    agent_id: "example-basic",
    agent_name: "Basic example",
  },
});

console.log(`\nCreated want ${want.id}`);
console.log(`Found ${matches.match_count} matches:`);
for (const m of matches.matches.slice(0, 5)) {
  console.log(`  - ${m.title} (score: ${m.score})`);
}

if (matches.matches[0]) {
  await client.recordOutcome({
    want_id: want.id,
    match_id: matches.matches[0].id,
    event: "viewed",
  });
  console.log(`\nReported "viewed" event for match ${matches.matches[0].id}`);
}
