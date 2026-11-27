# Visual tests

Playwright specs drive the static export of the dApp, built for mainnet as the Pages deploy builds it, through its flows on a local anvil chain with chain id 1, and compare each step with a committed screenshot: a page as a whole, a dialog as the viewport. A screen whose pixels differ beyond the tolerance below fails the test; the run's artifact `visual-results` holds the `-actual`, `-expected` and `-diff` images and the HTML report. Each spec is run in two projects, `desktop` and `phone`; the tests of `/admin`, a desktop-only page, are skipped in `phone`.

The workflow Visual runs on pull requests and on pushes to `simplex`. Before a pull request is opened, it is started on the branch with "Run workflow".

## Files

| Path | Content |
|---|---|
| `chain/state.json.gz` | anvil state after `scripts/deploy-local.mjs` of simplex-namespace-contract for `.simplex`, then the settings of `dump-state.mjs` |
| `chain/source.json` | the namespace commit, the ens-contracts commit, the anvil version and the mainnet block of the reserved and community names of that state |
| `chain/addresses.json` | contract addresses of that state |
| `chain/terms.json` | the URL of each terms file the name policy links to, with its file under `chain/terms/` and the content type GitHub serves it with |
| `chain/dump-state.mjs` | regenerates the five above |
| `chain.ts` | chain reset and seeding through RPC |
| `fixtures.ts` | browser context, wallet, screenshots, transaction dialogs |
| `pages-server.mjs` | serves `out/` as GitHub Pages does, with `.github/pages/404.html` for unknown paths |
| `*.spec.ts` | flows |
| `screenshots/<project>/` | screenshot baselines |
| `screenshots/registration.spec.ts/owner-typed-data.json` | the typed data the wallet signs for a temporary owner |
| `screenshot.css` | the styles applied in every screenshot |
| `whole-page.css` | the styles applied in screenshots of whole pages |

## Fixed inputs

| Input | Value |
|---|---|
| chain at each test's start | `chain/state.json.gz`, block time 2026-03-02 12:00:01 UTC, 1000 ETH at the zero address, the `from` of the access-list call in the dApp's fee estimate, as it holds ETH on mainnet |
| mainnet settings | ETH/USD 1696.64538978, public sales closed, the general terms link of mainnet, the reserved and community names set on mainnet at the block in `chain/source.json` and those of `deploy-local.mjs`; a test opens sales when it needs them |
| community terms | the names conditions at an earlier commit of simplex-chat, so that an acceptance of the general terms differs from one of the community terms; on mainnet both links are equal |
| block time | previous block + 1 s |
| browser clock | fixed at the time of the latest block, set at each page load, before a screen of the commitment wait and after the wait |
| registration secret | random; `owner-typed-data.json` holds `<random>` for its commitment, and the test reads the commitment on chain |
| pointer and scroll | the pointer at (0, 0), the page and a dialog's body at their top before each screenshot; behind an open dialog, which fixes the page at its scroll position, the page is moved to its top |
| countdown | the commitment wait is compared once it shows 60 |
| data loading | each screenshot is taken once the dApp has had no pending RPC request for 0.5 s; a screen with a fee estimate is compared once the estimate is shown |
| network | the dApp and the node; the dApp's fallback RPC endpoints answered by the node, as they answer with mainnet's state; each terms file at the exact URL of its link, with GitHub's content type; NXDOMAIN for DNS-over-HTTPS queries; other requests refused; WebSockets accepted and left unanswered |
| browser | `mcr.microsoft.com/playwright:v1.50.1-jammy`, `en-US`, UTC, light, scale 1; `desktop` Chromium at 1280×1000; `phone` the iPhone 13 of Playwright, with its engine WebKit, its user agent and touch, at 390×844 |
| terms checkbox | ticked by a click event dispatched on it: inside a phone dialog, WebKit's hit test at its centre reaches the terms box around it |
| wallet | the test mnemonic's accounts; `desktop` connects the wallet listed as installed, `phone` the browser wallet of the mobile list; a test can make it refuse the next transaction or signature, as a user does, with the error code 4001 |
| dialogs | compared at the top and, when their body scrolls, again scrolled to its end (`-end`); a desktop dialog is at most 576 px high at any viewport height, a phone dialog's body at most 60% of the viewport height |
| transactions | each confirmed transaction shows the toast "Transaction Successful", which the test closes; each flow with a dialog that stays open compares its complete stage |
| hidden in screenshots | `canvas` (confetti of the registration) |
| phone tab bar | fixed to the bottom of the screen in the dApp, drawn after the page's content in screenshots of whole pages, so that a whole page shows it once and it covers no content |
| pixel tolerance | Playwright `threshold` 0.02 (YIQ colour distance): a grey change of up to 5 per channel is accepted; the rendering of icon edges and gradients varies by up to 4 per channel between runs on one machine |
| masked | the countdown ring of the registration's second step, also behind the confirmation of its transaction: its progress dot is drawn while `commitComplete` is false, which the countdown's end sets only if the registration simulation has succeeded by then |

## Run

Requires anvil 1.5.1 (`foundryup --install v1.5.1`) and the ports 8545 and 3000.

```sh
export NEXT_PUBLIC_CHAIN_NAME=mainnet NEXT_PUBLIC_SIMPLEX_TLD=simplex
export NEXT_PUBLIC_MAINNET_RPC_URL=http://127.0.0.1:8545 E2E_PORT=3000
export NEXT_PUBLIC_MAINNET_DEPLOYMENT_ADDRESSES="$(cat e2e/visual/chain/addresses.json)"
pnpm build
pnpm export
pnpm exec playwright test -c e2e/visual/playwright.config.ts
```

The config starts anvil on the port of `NEXT_PUBLIC_MAINNET_RPC_URL` and `pages-server.mjs` on `E2E_PORT`. Screenshots taken outside the CI image differ from the baselines.

## Accept a changed screen

1. Run the workflow Visual on the branch with "Write the screenshots that differ as the new baselines".
2. Replace `e2e/visual/screenshots` with the run's artifact `visual-baselines` and commit it.

A new screenshot follows the same steps: its first run writes it and fails.

## Regenerate the chain state

The chain state, with its snapshot of mainnet's reserved and community names, is regenerated by whoever changes the contracts, `deploy-local.mjs`, the terms or the names on mainnet. It requires read access to simplex-namespace-contract, a private repository, and a mainnet RPC URL that serves `eth_getLogs` from the block of the name policy's deployment in `deployments.mainnet.simplex.journal.jsonl`.

1. Clone simplex-namespace-contract beside this repository and check out the commit to test.
2. In it, run `pnpm install` and `git submodule update --init ens-contracts`, then compile `ens-contracts` (`npx hardhat compile`, as `scripts/deploy-local.mjs` requires).
3. With anvil 1.5.1:

```sh
node e2e/visual/chain/dump-state.mjs ../simplex-namespace-contract https://eth.drpc.org
```

Then accept the changed screens.
