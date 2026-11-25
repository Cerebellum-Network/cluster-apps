# Cluster Console

The console for a DDC cluster's manager (and, next, its node providers). One app; the role is read from the blockchain
at every sign-in. It talks to one backend only: the cluster's **console backend** (ddc-node `cluster/console-backend`),
which holds read-only keys to the resource manager and the egress proxy and reads the cluster's DAC grouping collector. The browser never holds an upstream key and
never sends a query: it asks the backend for named views.

## Sign-in

1. **Connect SSCP wallet** (`@cef-ai/wallet-react`, appId `cluster-console`): the passkey ceremony runs at the wallet.
2. **Sign and continue**: the wallet signs the backend's challenge (`cluster-console sign-in`, cluster, account, nonce,
   expiry) as raw bytes; the backend checks it, reads the account's roles from the blockchain and returns a session.
   An account with no role gets "This wallet has no role in this cluster".

The session is a bearer in `sessionStorage` (this tab only, never in a URL). A manager granted by the backend's
devnet-only `EXTRA_MANAGERS` is shown as **Manager · by backend config** in the header and sidebar.

## Menu and screens

The menu follows the Cluster Console canvas (boards `Side` and `n1`):

- the first group, with no heading: Overview, Nodes, Requests, Customers, Plans, Revenue, Rules (later);
- **Services**: Storage, Delivery, Inference, Sandboxes, Agents. Each service page shows its capacity in its own unit,
  then its usage, served and verified by DAC. Sandboxes has tabs: Sandboxes, Placements, Egress, Usage;
- the footer: Team, and "What backs each number".

| Screen | What | Source (via the console backend) |
| --- | --- | --- |
| Overview (Main) | one card per area: nodes, storage, delivery, inference, sandboxes, revenue, customers; "needs your attention" | `/summary`, `/inference`, `/dac` |
| Nodes (c1) | sandbox, inference and agent nodes from the resource manager; the on-chain roster with each node's matching report and its work verified by DAC in the last 24 h | `/nodes`, `/chain`, `/dac` |
| Revenue (f1) | per UTC day and per era: payout status and verified usage by bill line (storage and delivery, GPU, CPU and RAM) from DAC; collected, reserve and providers paid shown as missing (payout receipts not read) | `/dac` |
| Inference (b2) | requests at once in flight against capacity, GPU units verified by DAC, per model: ready nodes, requests at once, in flight, queued | `/inference`, `/dac` |
| Sandboxes (service) | capacity (nodes, CPU, memory, running), egress and usage records in the last hour, and what DAC verified for the sandbox nodes (missing while their IDs are not nodes of the cluster on the blockchain) | `/summary`, `/nodes`, `/chain`, `/dac` |
| Sandboxes › Sandboxes | every sandbox across buckets, list or grouped by node or by customer bucket; a row opens its spec, egress rules, usage and placement | `/sandboxes` |
| Sandboxes › Placements | why each sandbox landed on its node: candidates, free room, score, fits or why not, attempts | `/sandboxes` (`placement`) |
| Sandboxes › Egress | allowed, denied and error requests with the credential **name** the proxy added (values are never logged) | `/egress/log` |
| Sandboxes › Usage | the path to payouts (measured, at the DAC agent, collected by DAC, charged); per sandbox per minute and final, CPU-s, GiB-s, DAC units, TCA, whether each reached the host's DAC agent; billed figures when the runtime records them | `/usage/records` |
| Storage, Delivery, Requests, Customers, Plans, Agents, Team, Rules | no source this backend can read today: each says what it would need | `/sources` |
| What backs each number | every number to its component, route and table, or why it is missing (the canvas's z1) | `/sources` |

The old addresses `/placements`, `/egress` and `/usage` redirect to the Sandboxes tabs with their filters.

A source that does not answer is shown as **Source missing** with the backend's reason; it is never replaced by a zero.

## Run locally

```bash
nvm exec npm i
# the console backend (ddc-node), e.g. on :18086 with CONSOLE_BACKEND_ALLOWED_ORIGINS=https://localhost:5173
VITE_CONSOLE_BACKEND_URL=http://localhost:18086 \
DEV_HTTPS_CERT=~/.certs/localhost.pem DEV_HTTPS_KEY=~/.certs/localhost-key.pem \
nvm exec npm run start -w apps/cluster-console -- --port 5173
```

The wallet's iframe sign-in needs https and an origin on wallet-api's `WALLET_API_EMBED_TOP_ORIGINS`; the dev wallet
allows `https://localhost:5173` (certificates from `mkcert localhost`). Set `VITE_WALLET_TRANSPORT=popup` to use the
popup instead.

Runtime config (`/config.js`, mounted by the `cef-cluster-console` Helm chart): `consoleBackendUrl`, `walletOrigin`,
`walletTransport`, `network`. Image: `cerebellumnetwork/cluster-console` (`.github/workflows/docker-build.yml` with `app: cluster-console`).

```bash
npm run check-types -w apps/cluster-console
npm test -w apps/cluster-console
npm run build -w apps/cluster-console
```
