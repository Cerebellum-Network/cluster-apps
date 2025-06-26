import { ApiPromise, WsProvider } from '@polkadot/api';
import { DDC_CLUSTER_ID, DDC_PRESET } from '~/constants.ts';
import { IndexedAccount } from '@cluster-apps/api';
import type { AccountInfo } from '@polkadot/types/interfaces';

let cachedApi: ApiPromise | null = null;
async function getPolkadotApi(): Promise<ApiPromise> {
  if (!cachedApi) {
    const wsProvider = new WsProvider(DDC_PRESET.blockchain);
    cachedApi = await ApiPromise.create({ provider: wsProvider });
  }
  return cachedApi;
}

export async function fetchAccountFromChain(address: string): Promise<IndexedAccount | undefined> {
  try {
    const api = await getPolkadotApi();
    const accountInfo = (await api.query.system.account(address)) as unknown as AccountInfo;
    const { data: balance, nonce } = accountInfo;

    const ledger = await api.query.ddcCustomers.clusterLedger(DDC_CLUSTER_ID, address);
    const ledgerHuman = ledger.toHuman() as any;

    const deposit = ledgerHuman?.total ? BigInt(ledgerHuman.active.replace(/,/g, '')) : BigInt(0);

    if (balance.free.isZero() && nonce.isZero()) {
      return undefined;
    }

    return {
      balance: balance.free.toBigInt(),
      deposit,
      buckets: [],
      charges: 0n,
      exists: true,
    };
  } catch (error) {
    console.warn('Error getting account from chain:', error);
    return undefined;
  }
}
