import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Optional local https for the dev server: point DEV_HTTPS_CERT / DEV_HTTPS_KEY
// at a cert + key (e.g. from mkcert) and `npm run dev` serves over https. Needed
// to exercise the CEF wallet locally -- WebAuthn (the passkey) refuses non-TLS
// origins, so the wallet's sign-in/signing only works over https. Plain http dev
// still works for everything that doesn't touch the wallet.
const certPath = process.env.DEV_HTTPS_CERT
const keyPath = process.env.DEV_HTTPS_KEY
const https =
  certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
    : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  ...(https ? { server: { https } } : {}),
})
