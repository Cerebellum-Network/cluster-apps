import { WalletStatus } from '@cere/embed-wallet';

export type AccountStatus = WalletStatus;

export type ConnectOptions = {
  email: string;
};

export interface Account {
  readonly address?: string;

  isReady(): this is ReadyAccount;
  init(): Promise<AccountStatus>;
  connect(options: ConnectOptions): Promise<void>;
  disconnect(): void;
}

export type ReadyAccount = Required<Account>;
