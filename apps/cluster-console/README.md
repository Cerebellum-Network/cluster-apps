# Cluster Console

The console for a DDC cluster's manager (and, next, its node providers). One app; the role is read from the blockchain
at every sign-in. It talks to one backend only: the cluster's **console backend** (ddc-node `cluster/console-backend`),
which holds read-only keys to the resource manager and the egress proxy. The browser never holds an upstream key and
never sends a query: it asks the backend for named views.

## Sign-in

1. **Connect SSCP wallet** (`@cef-ai/wallet-react`, appId `cluster-console`): the passkey ceremony runs at the wallet.
2. **Sign and continue**: the wallet signs the backend's challenge (`cluster-console sign-in`, cluster, account, nonce,
   expiry) as raw bytes; the backend checks it, reads the account's roles from the blockchain and returns a session.
   An account with no role gets "This wallet has no role in this cluster".

The session is a bearer in `sessionStorage` (this tab only, never in a URL). A manager granted by the backend's
devnet-only `EXTRA_MANAGERS` is shown as **Manager · by backend config** in the header and sidebar.

## Screens and sources

| Screen | What | Source (via the console backend) |
| --- | --- | --- |
| Overview | sandbox nodes, CPU and memory allocated of allocatable, sandboxes running, egress and usage records in the last hour, compute nodes by runtime, nodes on the blockchain, "needs your attention" | `/summary` |
| Nodes (c1) | sandbox runtime per node (arch, kernel, runsc, runtimes, allocatable, allocated by RM and as reported, sandboxes, disk free, health, matching on-chain node), inference nodes (GPUs, VRAM, models, requests at once, in flight), agent nodes, on-chain nodes not reporting | `/nodes`, `/chain` |
| Sandboxes | every sandbox across buckets, list or grouped by node or by customer bucket; a row opens its spec, egress rules, usage and placement | `/sandboxes` |
| Placements | why each sandbox landed on its node: candidates, free room, score, fits or why not, attempts | `/sandboxes` (`placement`) |
| Egress log | allowed, denied and error requests with the credential **name** the proxy added (values are never logged) | `/egress/log` |
| Usage records | per sandbox per minute and final, CPU-s, GiB-s, DAC units, TCA, and whether each reached the host's DAC agent | `/usage/records` |
| Inference | per model: ready nodes, requests at once, in flight, queued (snapshot of node reports) | `/inference` |
| Storage, Delivery, Requests, Customers, Plans, Revenue | no source this backend can read today: each says what it would need | `/sources` |
| What backs each number | every number to its component, route and table, or why it is missing (the canvas's z1) | `/sources` |

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
`walletTransport`, `network`. Image: `cerebellumnetwork/cluster-console` (`.github/workflows/docker-build-cluster-console.yml`).

```bash
npm run check-types -w apps/cluster-console
npm test -w apps/cluster-console
npm run build -w apps/cluster-console
```
