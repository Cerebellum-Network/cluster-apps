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
  private readonly baseUrl = 'http://178.18.148.201:4350/graphql';

  async getBuckets(accountId: string) {
    const response = await fetch(this.baseUrl, {
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

    return data.ddcBuckets;
  }
}
