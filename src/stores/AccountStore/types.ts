import { DdcClient } from '@cere-ddc-sdk/ddc-client';
import { UserInfo, WalletStatus } from '@cere/embed-wallet';

export type AccountStatus = WalletStatus;

export type ConnectOptions = {
  email: string;
};

export interface Account {
  readonly ddc?: DdcClient;
  readonly userInfo?: UserInfo;
  readonly address?: string;
  readonly balance?: number;

  isConnected(): this is ConnectedAccount;

  init(): Promise<AccountStatus>;
  connect(options: ConnectOptions): Promise<void>;
}

export type ConnectedAccount = Required<Account> & {
  disconnect(): void;
  signMessage(message: string): Promise<string>;
};
