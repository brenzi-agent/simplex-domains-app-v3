# Visual tests

Playwright specs drive the dApp through its flows on a local anvil chain and compare each step's element with a committed screenshot. A changed pixel fails the test; the run's artifact `visual-results` holds the `-actual`, `-expected` and `-diff` images and the HTML report.

## Files

| Path | Content |
|---|---|
| `chain/state.json.gz` | anvil state after `scripts/deploy-local.mjs` of simplex-namespace-contract for `.simplex` |
| `chain/addresses.json` | contract addresses of that state |
| `chain/terms/` | terms files that the name policy links to |
| `chain/dump-state.mjs` | regenerates the three above |
| `chain.ts` | chain reset and seeding through RPC |
| `fixtures.ts` | browser context, wallet, transaction dialogs |
| `*.spec.ts` | flows |
| `screenshots/` | baselines |
| `screenshot.css` | elements hidden in screenshots |

## Fixed inputs

| Input | Value |
|---|---|
| chain at each test's start | `chain/state.json.gz`, block time 2026-03-02 12:00:01 UTC |
| block time | previous block + 1 s |
| browser clock | fixed at the time of the latest block, set at each page load by the specs and after the commitment wait |
| `Math.random`, `crypto.getRandomValues`, `crypto.randomUUID` | seeded generators |
| network | the dApp and the node; terms files from `chain/terms/`; NXDOMAIN for DNS-over-HTTPS queries; other requests and WebSockets closed |
| browser | Chromium of `mcr.microsoft.com/playwright:v1.50.1-jammy`, 1280×1000 or 390×844, `en-US`, UTC, light, scale 1 |
| hidden in screenshots | `canvas` (confetti of the registration), transaction toasts (shown for 8 s) |
| pixel tolerance | Playwright `threshold` 0.01 (YIQ colour distance); the compositor's rounding, up to 2 per channel between runs on one machine, stays below it |

## Run

Requires anvil 1.5.1 (`foundryup --install v1.5.1`).

```sh
export NEXT_PUBLIC_CHAIN_NAME=localhost NEXT_PUBLIC_SIMPLEX_TLD=simplex
export NEXT_PUBLIC_PROVIDER=http://127.0.0.1:8545 E2E_PORT=3000
export NEXT_PUBLIC_DEPLOYMENT_ADDRESSES="$(cat e2e/visual/chain/addresses.json)"
pnpm build
pnpm exec playwright test -c e2e/visual/playwright.config.ts
```

The config starts anvil on the port of `NEXT_PUBLIC_PROVIDER` and the dApp on `E2E_PORT`. Screenshots taken outside the CI image differ from the baselines.

## Accept a changed screen

1. Run the workflow Visual on the branch with "Write the screenshots that differ as the new baselines".
2. Replace `e2e/visual/screenshots` with the run's artifact `visual-baselines` and commit it.

A new screenshot follows the same steps: its first run writes it and fails.

## Regenerate the chain state

When the contracts or `deploy-local.mjs` change, with anvil 1.5.1 and the compiled `ens-contracts` of simplex-namespace-contract:

```sh
node e2e/visual/chain/dump-state.mjs ../simplex-namespace-contract
```

Then accept the changed screens.
