/**
 * Presents the CEF wallet's `CefSigner` to the DDC SDK as a
 * `@cere-ddc-sdk/blockchain` `Signer`.
 *
 * Ported from ROC (roc/src/features/account/cefDdcSigner.ts). The wallet's
 * `CefSigner` is already a structural superset of 3.x's chain-free `Signer`
 * ({ type, address, publicKey, isReady, sign }); this adapter exists for three
 * reasons:
 *   1. Lazy resolution -- the signer is read per use (`resolve()`), so the DDC
 *      clients can be built before there is a wallet session.
 *   2. The consent description -- 3.x `sign(bytes, intent?)` has no options
 *      parameter, so `humanReadable` (what the wallet's consent screen shows) is
 *      carried here and passed through to `CefSigner.sign`.
 *   3. The token default -- the SDK's createSignature() calls sign(message) with
 *      no intent; defaulting to 'token' reproduces the 2.x mapping.
 *
 * The intent map is load-bearing: only 'extrinsic' raises the wallet's consent
 * screen, so a mis-mapping yields a valid signature with the wrong (or no)
 * prompt -- invisible to a test that inspects only bytes.
 *   'token'      createSignature / AuthToken.sign() (reached by omitting intent)
 *   'extrinsic'  only via client.tx.send() (requires a humanReadable description)
 *   'data'       raw-message paths (e.g. the S3 gateway X-Signature header)
 */
import type { Signer, SignerType, SignIntent } from '@cere-ddc-sdk/blockchain';
import type { CefSigner } from '@cef-ai/wallet';

export class CefDdcSigner implements Signer {
  private readonly resolve: () => CefSigner;
  private readonly humanReadable?: string;

  /**
   * @param resolve Returns the current `CefSigner`. Called per use, never cached.
   * @param humanReadable What the wallet's extrinsic-consent screen tells the user
   *   they are approving; the extrinsic path refuses to sign without it. Set via
   *   {@link describing}.
   */
  constructor(resolve: () => CefSigner, humanReadable?: string) {
    this.resolve = resolve;
    this.humanReadable = humanReadable;
  }

  /**
   * A sibling adapter that describes `humanReadable` on the consent screen.
   * Returns a NEW instance (not a field assignment) so the label survives an
   * `await` while another write is in flight.
   */
  describing(humanReadable: string): CefDdcSigner {
    return new CefDdcSigner(this.resolve, humanReadable);
  }

  private get cef(): CefSigner {
    return this.resolve();
  }

  get type(): SignerType {
    return this.cef.type as SignerType;
  }

  get address(): string {
    return this.cef.address;
  }

  get publicKey(): Uint8Array {
    return this.cef.publicKey;
  }

  /** `false` rather than a throw when there is no wallet session yet. */
  async isReady(): Promise<boolean> {
    let cef: CefSigner;
    try {
      cef = this.cef;
    } catch {
      return false;
    }
    return cef.isReady();
  }

  async sign(bytes: Uint8Array, intent: SignIntent = 'token'): Promise<Uint8Array> {
    if (intent === 'extrinsic' && !this.humanReadable) {
      // Deliberately loud: this is asking the user to approve a blockchain
      // transaction they cannot identify. Use `signer.describing('<what>')`.
      throw new Error(
        'CefDdcSigner: refusing to sign an extrinsic with no description for the ' +
          "wallet's consent screen. Use `signer.describing('<what the user is approving>')`.",
      );
    }
    return this.cef.sign(bytes, intent, this.humanReadable ? { humanReadable: this.humanReadable } : undefined);
  }
}
