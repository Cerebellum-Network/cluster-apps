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
    account: IndexedAccount;
  };
};

type DdcBucketsResult = {
  data: {
    ddcBuckets: IndexedBucket[];
  };
};

const marshallBucket = (bucket: IndexedBucket): IndexedBucket => ({
  ...bucket,
  id: BigInt(bucket.id),
});

const marshallAccount = (account: IndexedAccount): IndexedAccount => ({
  ...account,
  balance: BigInt(account.balance),
  deposit: BigInt(account.deposit),
  buckets: account.buckets.map(marshallBucket),
});

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

    const { data }: AccountResult = await response.json();

    return marshallAccount(data.account);
  }

  async getBuckets(accountId: string) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify({
        query: `
          query {
            ddcBuckets(where: {ownerId:{id_eq :"${accountId}"}}) {
              id
              isPublic
              isRemoved
            }
          }
        `,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { data }: DdcBucketsResult = await response.json();

    return data.ddcBuckets.map(marshallBucket);
  }
}
