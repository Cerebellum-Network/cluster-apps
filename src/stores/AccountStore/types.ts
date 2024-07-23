import { DdcClient } from '@cere-ddc-sdk/ddc-client';
import { UserInfo, WalletStatus } from '@cere/embed-wallet';
import { IndexedBucket } from '@developer-console/api';

export type AccountStatus = WalletStatus;

export type ConnectOptions = {
  email: string;
};

export interface Account {
  readonly ddc?: DdcClient;
  readonly userInfo?: UserInfo;
  readonly address?: string;
  readonly balance?: number;
  readonly deposit?: number;
  readonly buckets?: IndexedBucket[];

  isReady(): this is ReadyAccount;
  init(): Promise<AccountStatus>;
  connect(options: ConnectOptions): Promise<void>;
  disconnect(): void;
  signMessage(message: string): Promise<string>;
}

export type ReadyAccount = Required<Omit<Account, 'deposit' | 'balance'>> & {
  readonly balance?: number;
  readonly deposit?: number;
};
