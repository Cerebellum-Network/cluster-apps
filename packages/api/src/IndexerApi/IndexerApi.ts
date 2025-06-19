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
  ddcActiveBalance: string;
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

const mapResultToAccount = ({ data: { account } }: AccountResult, clusterId?: string): IndexedAccount => {
  if (!account) {
    return {
      balance: 0n,
      deposit: 0n,
      charges: 0n,
      buckets: [],
    };
  }

  const filterByCluster = <T extends { clusterId?: { id: string } }>(arr: T[]) => {
    return clusterId ? arr.filter((i) => i.clusterId?.id === clusterId) : arr;
  };

  const deposits = filterByCluster(account.ddcCustomerDeposits ?? []);
  const charges = filterByCluster(account.ddcCustomerCharges ?? []);
  const balances = filterByCluster(account.ddcCustomerBalances ?? []);
  const buckets = filterByCluster(account.ddcBuckets ?? []);

  const depositSum = sumBigInts(deposits.map((d) => BigInt(d.amount)));
  const chargeSum = sumBigInts(charges.map((c) => BigInt(c.amount)));
  const activeBalanceSum = sumBigInts(balances.map((b) => BigInt(b.activeBalance)));

  return {
    balance: BigInt(account.cereFreeBalance),
    deposit: activeBalanceSum > 0n ? activeBalanceSum : depositSum - chargeSum,
    charges: chargeSum,
    buckets: buckets.map(mapBucket),
  };
};

const mapResultToDdcNodes = ({ data: { ddcNodes } }: DdcNodesResult): IndexedDdcNode[] =>
  ddcNodes?.length > 0 ? ddcNodes : [];

export class IndexerApi {
  private readonly endpoint = INDEXER_ENDPOINT;

  async getAccount(accountId: string, clusterId?: string) {
    const query = `
      query {
        account: accountById(id: "${accountId}") {
          id
          cereFreeBalance
          ddcActiveBalance
          ddcBuckets {
            id
            isPublic
            isRemoved
            clusterId { id }
          }
          ddcCustomerDeposits(orderBy: blockTimestamp_DESC) {
            id
            blockTimestamp
            amount
            clusterId { id }
          }
          ddcCustomerCharges(orderBy: blockTimestamp_DESC) {
            id
            blockTimestamp
            amount
            clusterId { id }
          }
          ddcCustomerBalances {
            id
            activeBalance
            clusterId { id }
          }
        }
      }
    `;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result: AccountResult = await response.json();
    return mapResultToAccount(result, clusterId);
  }

  async getClusterBalances(clusterId: string, limit = 10) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify({
        query: `
          query {
            ddcCustomerBalances(
              where: { clusterId: { id_eq: "${clusterId}" } }
              limit: ${limit}
              orderBy: activeBalance_DESC
            ) {
              id
              activeBalance
              accountId { id }
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

  async getAllCustomerDeposits(accountId: string, limit = 100) {
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

  async getAllCustomerCharges(accountId: string, limit = 100) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: JSON.stringify({
        query: `
          query {
            ddcCustomerCharges(
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
