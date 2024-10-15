import { INDEXER_ENDPOINT } from '../constants';

export type IndexedBucket = {
  id: bigint;
  isPublic: boolean;
  isRemoved: boolean;
  storedBytes: number;
};

export type IndexedAccount = {
  balance: bigint;
  deposit: bigint;
  buckets: IndexedBucket[];
};

type AccountResult = {
  data: {
    account: IndexedAccount | null;
  };
};

export type IndexedDdcNode = unknown;

type DdcNodesResult = {
  data: {
    ddcNodes: IndexedDdcNode[]; // @TODO
  };
};

const mapBucket = (bucket: IndexedBucket): IndexedBucket => ({
  ...bucket,
  id: BigInt(bucket.id),
});

const mapResultToAccount = ({ data: { account } }: AccountResult): IndexedAccount =>
  account
    ? {
        ...account,
        balance: BigInt(account.balance),
        deposit: BigInt(account.deposit),
        buckets: account.buckets.map(mapBucket),
      }
    : {
        balance: 0n,
        deposit: 0n,
        buckets: [],
      };

const mapResultToDdcNodes = ({ data: { ddcNodes } }: DdcNodesResult) => (ddcNodes?.length > 0 ? ddcNodes : []);

export class IndexerApi {
  private readonly endpoint = INDEXER_ENDPOINT;

  async getAccount(accountId: string) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify({
        query: `
          query {
            account: accountById(id: "${accountId}") {
              balance: cereFreeBalance
              deposit: ddcActiveBalance
              buckets: ddcBuckets {
                id
                isPublic
                isRemoved
                storedBytes
              }
            }
          }
        `,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.json().then(mapResultToAccount);
  }

  async getDdcNodes(accountId: string) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify({
        query: `
          query {
            ddcNodes(where: {providerId: {id_eq: "${accountId}"}}) {
              id
            }
          }
        `,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.json().then(mapResultToDdcNodes);
  }
}
