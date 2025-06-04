import { INDEXER_ENDPOINT } from '../constants';
import { DDC_CLUSTER_ID } from '@cluster-apps/developer-console/src/constants.ts';

export type IndexedBucket = {
  id: bigint;
  isPublic: boolean;
  isRemoved: boolean;
  storedBytes: number;
};

export type IndexedAccount = {
  balance: bigint;
  deposit: bigint;
  charges: bigint;
  buckets: IndexedBucket[];
};

export type IndexedDeposit = {
  id: string;
  blockTimestamp: string;
  amount: string;
  clusterId?: {
    id: string;
  };
};

export type IndexedCharge = {
  id: string;
  blockTimestamp: string;
  amount: string;
  clusterId?: {
    id: string;
  };
};

export type IndexedBalance = {
  id: string;
  activeBalance: string;
  clusterId?: {
    id: string;
  };
};

type GraphQLBucket = {
  id: string;
  isPublic: boolean;
  isRemoved: boolean;
  clusterId?: {
    id: string;
  };
};

type GraphQLAccount = {
  id: string;
  cereFreeBalance: string;
  ddcBuckets: GraphQLBucket[];
  ddcCustomerDeposits: IndexedDeposit[];
  ddcCustomerCharges: IndexedCharge[];
  ddcCustomerBalances: IndexedBalance[];
};

type AccountResult = {
  data: {
    account: GraphQLAccount | null;
  };
};

export type IndexedDdcNode = { id: number };

type DdcNodesResult = {
  data: {
    ddcNodes: IndexedDdcNode[];
  };
};

const sumBigInts = (values: bigint[] = []) => values.reduce((acc, val) => acc + BigInt(val), 0n);

const mapBucket = (bucket: GraphQLBucket): IndexedBucket => ({
  id: BigInt(bucket.id),
  isPublic: bucket.isPublic,
  isRemoved: bucket.isRemoved,
  storedBytes: 0, // TODO: get from actual usage
});

const mapResultToAccount = ({ data: { account } }: AccountResult): IndexedAccount =>
  account
    ? {
        buckets: account.ddcBuckets.map(mapBucket),
        balance: BigInt(account.cereFreeBalance),
        deposit:
          sumBigInts(account.ddcCustomerDeposits?.map((d) => BigInt(d.amount))) -
          sumBigInts(account.ddcCustomerCharges?.map((c) => BigInt(c.amount))),
        charges: sumBigInts(account.ddcCustomerCharges?.map((c) => BigInt(c.amount))),
      }
    : {
        balance: 0n,
        deposit: 0n,
        charges: 0n,
        buckets: [],
      };

const mapResultToDdcNodes = ({ data: { ddcNodes } }: DdcNodesResult): IndexedDdcNode[] =>
  ddcNodes?.length > 0 ? ddcNodes : [];

export class IndexerApi {
  private readonly endpoint = INDEXER_ENDPOINT;

  async getAccount(accountId: string) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify({
        query: `
          query {
            account: accountById(id: "${accountId}") {
              id
              cereFreeBalance
              ddcBuckets {
                id
                isPublic
                isRemoved
                clusterId { id }
              }
              ddcCustomerDeposits(orderBy: blockTimestamp_DESC, where: { clusterId: { id_eq: "${DDC_CLUSTER_ID}" } }) {
                id
                blockTimestamp
                amount
              }
              ddcCustomerCharges(orderBy: blockTimestamp_DESC, where: { clusterId: { id_eq: "${DDC_CLUSTER_ID}" } }) {
                id
                blockTimestamp
                amount
              }
              ddcCustomerBalances(where: { clusterId: { id_eq: "${DDC_CLUSTER_ID}" } }) {
                id
                activeBalance
                clusterId { id }
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
            ddcNodes(where: { providerId: { id_eq: "${accountId}" } }) {
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

  async getCustomerDeposits(accountId: string, limit = 10) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify({
        query: `
          query {
            ddcCustomerDeposits(
              where: { accountId: { id_eq: "${accountId}" } }
              limit: ${limit}
              orderBy: blockTimestamp_DESC
            ) {
              id
              blockTimestamp
              amount
              clusterId { id }
            }
          }
        `,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.json();
  }

  async getClusterDeposits(clusterId: string, limit = 10) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify({
        query: `
          query {
            ddcCustomerDeposits(
              where: { clusterId_eq: "${clusterId}" }
              limit: ${limit}
              orderBy: blockTimestamp_DESC
            ) {
              id
              blockTimestamp
              accountId { id }
              amount
              clusterId { id }
            }
          }
        `,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.json();
  }
}
