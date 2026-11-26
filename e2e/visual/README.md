# Visual tests

Playwright specs drive the static export of the dApp through its flows on a local anvil chain and compare the viewport at each step with a committed screenshot. A screen whose pixels differ beyond the tolerance below fails the test; the run's artifact `visual-results` holds the `-actual`, `-expected` and `-diff` images and the HTML report. Each spec runs in three projects: `desktop`, `phone` and `dark`.

## Files

| Path | Content |
|---|---|
| `chain/state.json.gz` | anvil state after `scripts/deploy-local.mjs` of simplex-namespace-contract for `.simplex`, then the mainnet settings of `dump-state.mjs` |
| `chain/source.json` | the namespace commit, the ens-contracts commit and the anvil version of that state |
| `chain/addresses.json` | contract addresses of that state |
| `chain/terms/` | the terms files that the name policy links to |
| `chain/dump-state.mjs` | regenerates the four above |
| `chain.ts` | chain reset and seeding through RPC |
| `fixtures.ts` | browser context, wallet, screenshots, transaction dialogs |
| `pages-server.mjs` | serves `out/` as GitHub Pages does, with `.github/pages/404.html` for unknown paths |
| `*.spec.ts` | flows |
| `screenshots/<project>/` | baselines |
| `screenshot.css` | elements hidden in screenshots |

## Fixed inputs

| Input | Value |
|---|---|
| chain at each test's start | `chain/state.json.gz`, block time 2026-03-02 12:00:01 UTC, 1000 ETH at the zero address, the `from` of the access-list call in the dApp's fee estimate, as it holds ETH on mainnet |
| mainnet settings | ETH/USD 1696.64538978, public sales closed, the terms links of mainnet; a test opens sales when it needs them |
| block time | previous block + 1 s |
| browser clock | fixed at the time of the latest block, set at each page load, before a screen of the commitment wait and after the wait |
| registration secret | random; `owner-typed-data.json` holds `<random>` for its commitment, and the test reads the commitment on chain |
| pointer | at (0, 0) before each screenshot |
| network | the dApp and the node; terms files from `chain/terms/`; NXDOMAIN for DNS-over-HTTPS queries; other requests refused; WebSockets accepted and left unanswered |
| browser | Chromium of `mcr.microsoft.com/playwright:v1.50.1-jammy`, `en-US`, UTC, scale 1; `desktop` 1280×1000 light, `phone` 390×1400 light with touch, `dark` 1280×1000 dark |
| dialogs | compared at the top and, when their body scrolls, again scrolled to its end (`-end`); a desktop dialog is at most 576 px high at any viewport height, a phone dialog's body at most 60% of the viewport height |
| hidden in screenshots | `canvas` (confetti of the registration), transaction toasts (shown for 8 s) |
| pixel tolerance | Playwright `threshold` 0.02 (YIQ colour distance): a grey change of up to 5 per channel is accepted; the rendering of icon edges and gradients varies by up to 4 per channel between runs on one machine |
| masked | the countdown ring of the registration's second step: its progress dot is drawn while `commitComplete` is false, which the countdown's end sets only if the registration simulation has succeeded by then |

## Run

Requires anvil 1.5.1 (`foundryup --install v1.5.1`) and the ports 8545 and 3000.

```sh
export NEXT_PUBLIC_CHAIN_NAME=localhost NEXT_PUBLIC_SIMPLEX_TLD=simplex
export NEXT_PUBLIC_PROVIDER=http://127.0.0.1:8545 E2E_PORT=3000
export NEXT_PUBLIC_DEPLOYMENT_ADDRESSES="$(cat e2e/visual/chain/addresses.json)"
pnpm build
pnpm export
pnpm exec playwright test -c e2e/visual/playwright.config.ts
```

The config starts anvil on the port of `NEXT_PUBLIC_PROVIDER` and `pages-server.mjs` on `E2E_PORT`. Screenshots taken outside the CI image differ from the baselines.

## Accept a changed screen

1. Run the workflow Visual on the branch with "Write the screenshots that differ as the new baselines".
2. Replace `e2e/visual/screenshots` with the run's artifact `visual-baselines` and commit it.

A new screenshot follows the same steps: its first run writes it and fails.

## Regenerate the chain state

When the contracts, `deploy-local.mjs` or the mainnet settings change:

1. Clone simplex-namespace-contract, a private repository, beside this one with an account that can read it, and check out the commit to test.
2. In it, run `pnpm install` and `git submodule update --init ens-contracts`, then compile `ens-contracts` (`npx hardhat compile`, as `scripts/deploy-local.mjs` requires).
3. With anvil 1.5.1:

```sh
node e2e/visual/chain/dump-state.mjs ../simplex-namespace-contract
```

Then accept the changed screens.
