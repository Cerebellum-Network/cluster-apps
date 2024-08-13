import { INDEXER_ENDPOINT } from '../constants';

export type IndexedBucket = {
  id: bigint;
  isPublic: boolean;
  isRemoved: boolean;
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
}
