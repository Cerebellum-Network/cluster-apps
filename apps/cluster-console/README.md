# Cluster Console

The console for a DDC cluster's manager (and, next, its node providers). One app; the role is read from the blockchain
at every sign-in. It talks to one backend only: the cluster's **console backend** (ddc-node `cluster/console-backend`),
which holds read-only keys to the resource manager and the egress proxy and reads the cluster's DAC grouping collector. The browser never holds an upstream key and
never sends a query: it asks the backend for named views.

## Sign-in

One button, **Sign in with SSCP wallet** (`@cef-ai/wallet-react`, appId `cluster-console`):

1. The wallet connects. The passkey ceremony runs at the wallet; a wallet resumed from an earlier visit is offered as
   "Continue as …".
2. In the same click, the console asks the wallet to sign the backend's challenge (`cluster-console sign-in`, cluster,
   account, nonce, expiry) as raw bytes with the `data` intent. A wallet that has just logged in signs without a prompt;
   a resumed one runs one passkey step-up in its own frame. If the wallet answers `gesture-required` or `popup-blocked`,
   one **Continue** button signs from a fresh click.
3. The backend checks the signature, reads the account's roles from the blockchain and returns a session. An account
   with no role gets "This wallet has no role in this cluster".

The signature is what proves the person holds the wallet's key; it moves no money and sends no transaction. The
session is a bearer in `sessionStorage` (this tab only, never in a URL). A manager granted by the backend's devnet-only
`EXTRA_MANAGERS` is shown as **Manager · set by backend config** under the account.

## Menu and screens

The menu has only screens with data: Overview, Nodes, Customers, Revenue; then **Services**: Storage, Delivery,
Inference, Sandboxes; and **Data sources** in the footer. Screens with no source yet (Requests, Plans, Team, Rules,
Agents) are listed on Data sources with what each needs; their old links go there.

| Screen | What it answers | Source (via the console backend) |
| --- | --- | --- |
| Overview | what needs the manager now; one figure per area (nodes, storage, delivery, inference, sandboxes, DAC eras); sandbox use over 24 h, billed and measured; top customers | `/summary`, `/nodes`, `/chain`, `/fleet`, `/storage`, `/delivery`, `/inference`, `/live`, `/usage`, `/dac` |
| Nodes | every node in one list with the same columns: status, availability over 7 days, uptime, version, CPU, memory, disk or GPU memory, work DAC verified in 24 h; compute identities on chain in one line | `/fleet`, `/nodes`, `/chain`, `/dac` |
| Customers | customer buckets by billed vCPU-hours on sandboxes | `/usage` |
| Revenue | every DAC era by status; verified usage per era; sandbox vCPU-hours billed per era, for the request and for burst; whether sandbox usage is counted; days | `/dac`, `/usage` |
| Storage | disk used and stored over 30 days, fill projection, a row per storage node with its disk against the machine | `/storage`, `/fleet` |
| Delivery | served per day from cache and from storage, a row per node | `/delivery`, `/fleet` |
| Inference | requests at once against capacity, daily peak, refusals, GPU units; a row per model; GPUs per node | `/inference`, `/inference/history`, `/fleet`, `/dac` |
| Sandboxes | live: a row per node with its sandbox quota (counted in requests) and a block per sandbox sized by its request, filled by its latest use; use above the request (burst) runs on past the block, and an open node shows each sandbox's request, use and limit (polled every second); use over time, billed (and its burst) and measured, by customer and by node; billing state; all sandboxes; outbound requests. A sandbox opens in a drawer with its request and limit, its use over the last hour against them, billed for the request and for burst, its image (digest and size), how its start went (the image pulled or already on the node), how it ended, the files it keeps after it ends (count, size and until when, and what was not kept and why), where it runs and why, and its rules | `/live`, `/fleet`, `/usage`, `/sandboxes`, `/sandboxes/:id`, `/sandboxes/:id/metrics`, `/egress/log` |
| Data sources | every number to its source; what is not available yet; the DAC collector | `/sources`, `/dac` |

**Requests, limits and burst.** A sandbox's request is what the node keeps for it, what the node's sandbox quota
counts and what it pays for at least; its limit is the most it can use. Use above the request is burst, billed as used,
and shows in one colour (orange) everywhere: past the block on a node's lane, past the request on a sandbox's gauge,
and as its own line or bar in billed use. A sandbox from before limits is limited at its request and never shown as
bursting. It ends "Out of memory" at its memory limit, or "Memory reclaimed" when it used more than its memory request
while the node was short of memory.

Billing states are plain: **Counted**, **Waiting for verification**, **Not counted** or **Not known yet**, each with a
one-line reason. A source that is not read yet is one quiet "Not available yet" line; a source that did not answer is a
"Couldn't read …" warning. Neither is ever shown as zero.

The old addresses `/placements`, `/egress`, `/usage`, `/sandboxes/placements` and `/sandboxes/usage` redirect.

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
