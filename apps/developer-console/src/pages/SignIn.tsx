import { Alert, Btn, CereMark, IndeterminateBar } from '../components/ui';
import { useSession } from '../wallet/session';

/** Billing Sign In.dc.html — idle / connecting / waiting / error. */
export function SignIn() {
  const s = useSession();
  const state = s.state;

  return (
    <div
      style={{
        background: 'var(--b-bg)',
        color: 'var(--b-tx)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 16px',
      }}
    >
      <main
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          padding: 32,
          borderRadius: 20,
          border: '1px solid var(--b-line)',
          background: 'var(--b-card)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CereMark size={24} />
          <span style={{ font: '800 10px/1 var(--font-sans)', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--b-tx2)' }}>
            Dragon 1 · DDC
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0, font: '500 24px/1.33 var(--font-sans)', letterSpacing: '-0.12px' }}>Developer Console</h1>
          <p style={{ margin: 0, font: '400 15px/1.5 var(--font-sans)', color: 'var(--b-tx2)' }}>
            Use the CEF wallet that holds your DDC account.
          </p>
        </div>

        {(state === 'idle' || state === 'expired') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn variant="primary" size="lg" full onClick={s.connect}>
              Connect wallet
            </Btn>
            <Btn variant="secondary" size="lg" full onClick={s.createWallet}>
              Create a wallet
            </Btn>
          </div>
        )}

        {state === 'connecting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn variant="primary" size="lg" full disabled>
              Connecting…
            </Btn>
            <IndeterminateBar height={3} seconds={1.2} />
            <div style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--b-tx3)' }}>Opening the CEF wallet…</div>
          </div>
        )}

        {state === 'waiting' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16, borderRadius: 12, background: 'var(--b-chip)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--b-acc)', flex: 'none' }} />
                <span style={{ font: '500 15px/1.3 var(--font-sans)' }}>Finish in the wallet window…</span>
              </div>
              <div style={{ font: '400 13px/1.5 var(--font-sans)', color: 'var(--b-tx2)' }}>
                Creating a wallet can take a few minutes while you confirm the code sent to your email. Keep this tab open; it continues
                on its own.
              </div>
              <IndeterminateBar height={3} seconds={1.6} />
            </div>
            <Btn variant="tertiary" style={{ alignSelf: 'flex-start', font: '500 14px/1 var(--font-sans)', padding: '10px 0' }} onClick={s.cancel}>
              Cancel
            </Btn>
          </>
        )}

        {state === 'error' && (
          <>
            <Alert tone="err" title="Wallet connection failed">
              {friendlyError(s.error)}
              {s.error && friendlyError(s.error) !== s.error && (
                <span
                  style={{ display: 'block', marginTop: 6, font: '400 11px/1.4 var(--font-mono)', opacity: 0.8, overflowWrap: 'anywhere' }}
                >
                  {s.error}
                </span>
              )}
            </Alert>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn variant="primary" size="lg" full onClick={s.connect}>
                Try again
              </Btn>
              <Btn variant="secondary" size="lg" full onClick={s.createWallet}>
                Create a wallet
              </Btn>
            </div>
          </>
        )}

        <div style={{ paddingTop: 16, borderTop: '1px solid var(--b-line)', font: '400 12px/1.5 var(--font-sans)', color: 'var(--b-tx3)' }}>
          Signs in with a passkey. No seed phrase, no browser extension.
        </div>
      </main>
    </div>
  );
}

/**
 * Plain-language copy for the common failures; the SDK's own text is shown
 * underneath, so nothing is hidden. On https the wallet runs framed, and a
 * dismissed (or empty) passkey prompt surfaces as `user-cancelled` -- not a
 * closed window, which only the popup transport has.
 */
function friendlyError(error: string | null): string {
  if (!error) return 'Sign-in didn\u2019t finish. Try again.';
  if (/popup-blocked|blocked/i.test(error)) return 'The browser blocked the wallet window. Allow pop-ups for this site and try again.';
  if (/popup-closed|window closed|delegation-closed/i.test(error)) return 'The wallet window closed before sign-in finished.';
  if (/cancel/i.test(error)) {
    return 'The passkey prompt was closed before sign-in finished. Try again and choose your passkey for the CEF wallet.';
  }
  if (/topOrigin|EMBED_TOP_ORIGINS/.test(error)) return 'This site isn\u2019t allowed to sign in with the wallet here yet.';
  return error;
}
