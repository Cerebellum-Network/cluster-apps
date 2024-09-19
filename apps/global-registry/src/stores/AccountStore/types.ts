import { WalletStatus } from '@cere/embed-wallet';
import { IndexedBucket } from '@cluster-apps/api';

export type AccountStatus = WalletStatus;

export type ConnectOptions = {
  email: string;
};

export interface Account {
  readonly status: AccountStatus;
  readonly address?: string;
  readonly buckets?: IndexedBucket[];

  isReady(): this is ReadyAccount;
  init(): Promise<AccountStatus>;
  connect(options: ConnectOptions): Promise<void>;
  disconnect(): void;
}

export type ReadyAccount = Required<Account>;
