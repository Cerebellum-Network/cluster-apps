import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { CereWalletSigner, EventSource } from '@cere-activity-sdk/events';
import {
  AGENT_SERVICE_REGISTRY_URL,
  APP_PUBLIC_KEY,
  DATA_SERVICE_PUBLIC_KEY,
  EVENT_APP_ID,
  EVENT_DISPATCH_URL,
  EVENT_LISTEN_URL,
} from '../../constants';
import { CereWalletCipher } from '@cere-activity-sdk/ciphers';
import { AgentServiceRegistry } from '@cluster-apps/api';
import { EmbedWallet } from '@cere/embed-wallet';
import { AccountStore } from '~/stores';

export class EventsStore {
  eventSource?: EventSource = undefined;
  private isConnected = false;
  readonly agentServiceRegistry: AgentServiceRegistry = new AgentServiceRegistry(AGENT_SERVICE_REGISTRY_URL);

  constructor(accountStore: AccountStore) {
    makeAutoObservable(this);
    reaction(
      () => accountStore.address,
      async (address) => {
        if (address !== '') {
          await this.connect(accountStore.wallet);
        } else {
          this.disconnect();
        }
      },
    );
  }

  async shareEdek(signer: CereWalletSigner) {
    const authorization = await signer.sign('authorization');
    const userPubKey = signer.publicKey;
    const edekKey = `edek:${userPubKey}:${DATA_SERVICE_PUBLIC_KEY}`;
    const edekShared = localStorage.getItem(edekKey) === 'true';

    if (edekShared) {
      console.log('Data service EDEK has already been shared');
      return;
    }

    const dataServiceEdek = await this.agentServiceRegistry?.getEdek(
      userPubKey,
      DATA_SERVICE_PUBLIC_KEY,
      authorization,
    );
    if (!dataServiceEdek) {
      console.log('Data service EDEK not found');
      return;
    }

    localStorage.setItem(edekKey, 'true');
  }

  async connectWithRetry(cereWallet: EmbedWallet) {
    let attempts = 0;
    while (attempts < 3) {
      try {
        await cereWallet.connect();
        const walletConnected = await cereWallet.isConnected;
        return walletConnected;
      } catch (error) {
        console.error('Connection attempt failed:', error);
        attempts++;
        if (attempts >= 3) {
          throw new Error('Max retry attempts reached');
        }
      }
    }
  }

  async connect(cereWallet: EmbedWallet) {
    if (!cereWallet || this.isConnected) return;

    try {
      if (cereWallet.status !== 'connected') {
        await cereWallet.connect();
      }

      await this.connectWithRetry(cereWallet);

      const signer = new CereWalletSigner(cereWallet);
      await signer.isReady();
      const cipher = new CereWalletCipher(cereWallet);
      await cipher.isReady();

      await this.shareEdek(signer);

      const client = new EventSource(signer, cipher, {
        appId: EVENT_APP_ID,
        dispatchUrl: EVENT_DISPATCH_URL,
        listenUrl: EVENT_LISTEN_URL,
        dataServicePubKey: DATA_SERVICE_PUBLIC_KEY,
        appPubKey: APP_PUBLIC_KEY,
      });

      await client.connect();
      runInAction(() => {
        this.eventSource = client;
        this.isConnected = true;
      });

      console.log('EventsClient connected successfully.');
    } catch (error) {
      console.error('Failed to connect to EventsClient:', error);
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.disconnect();
      runInAction(() => {
        this.eventSource = undefined;
        this.isConnected = false;
      });
      console.log('EventsClient disconnected.');
    }
  }
}
