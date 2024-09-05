import { AuthToken, DdcClient } from '@cere-ddc-sdk/ddc-client';
import { BucketParams } from '@cere-ddc-sdk/blockchain';
import { UserInfo, WalletStatus } from '@cere/embed-wallet';
import { AccountStats, AccountStatsHistoryRecord, BucketStats, IndexedBucket } from '@developer-console/api';

export type AccountStatus = WalletStatus;

export type ConnectOptions = {
  email: string;
};

export type Bucket = IndexedBucket & {
  stats?: BucketStats;
};

export type AccountMetrics = {
  total: AccountStats;
  history: AccountStatsHistoryRecord[];
};

export interface Account {
  readonly ddc: DdcClient;

  readonly userInfo?: UserInfo;
  readonly address?: string;
  readonly balance?: number;
  readonly deposit?: number;
  readonly buckets?: Bucket[];
  readonly metrics?: AccountMetrics;

  isReady(): this is ReadyAccount;
  init(): Promise<AccountStatus>;
  connect(options: ConnectOptions): Promise<void>;
  disconnect(): void;
  signMessage(message: string): Promise<string>;
  createBucket(params: BucketParams): Promise<bigint>;
  saveBucket(bucketId: bigint, params: BucketParams): Promise<void>;
  topUp(amount: number): Promise<void>;
  createAuthToken(cid: string): Promise<AuthToken>;
}

export type ReadyAccount = Required<Omit<Account, 'stats'>> & {
  readonly metrics?: AccountMetrics;
};
