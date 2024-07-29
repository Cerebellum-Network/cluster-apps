import { INDEXER_ENDPOINT } from '../constants';

export type IndexedBucket = {
  id: bigint;
  isPublic: boolean;
};

type DdcBucketsResult = {
  data: {
    ddcBuckets: IndexedBucket[];
  };
};

export class IndexerApi {
  private readonly endpoint = INDEXER_ENDPOINT;

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

    return data.ddcBuckets.map((bucket) => ({ ...bucket, id: BigInt(bucket.id) }));
  }
}
