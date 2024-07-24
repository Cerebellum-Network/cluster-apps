import { DdcClient } from '@cere-ddc-sdk/ddc-client';
import { BucketParams } from '@cere-ddc-sdk/blockchain';
import { UserInfo, WalletStatus } from '@cere/embed-wallet';
import { BucketStats, IndexedBucket } from '@developer-console/api';

export type AccountStatus = WalletStatus;

export type ConnectOptions = {
  email: string;
};

export type Bucket = IndexedBucket & {
  stats?: BucketStats;
};

export interface Account {
  readonly ddc?: DdcClient;
  readonly userInfo?: UserInfo;
  readonly address?: string;
  readonly balance?: number;
  readonly deposit?: number;
  readonly buckets?: Bucket[];

  isReady(): this is ReadyAccount;
  init(): Promise<AccountStatus>;
  connect(options: ConnectOptions): Promise<void>;
  disconnect(): void;
  signMessage(message: string): Promise<string>;
  createBucket(isPublic: boolean): Promise<bigint>;
  saveBucket(bucketId: bigint, params: BucketParams): Promise<void>;
  refreshBuckets(): Promise<void>;
}

export type ReadyAccount = Required<Omit<Account, 'deposit' | 'balance'>> & {
  readonly balance?: number;
  readonly deposit?: number;
};
