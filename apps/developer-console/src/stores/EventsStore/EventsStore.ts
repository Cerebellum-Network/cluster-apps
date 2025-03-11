import { makeAutoObservable, runInAction } from 'mobx';
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

export class EventsStore {
  eventSource?: EventSource = undefined;
  private isConnected = false;
  readonly agentServiceRegistry?: AgentServiceRegistry = new AgentServiceRegistry(AGENT_SERVICE_REGISTRY_URL);

  constructor() {
    makeAutoObservable(this);
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

  async connect(cereWallet: EmbedWallet) {
    if (!cereWallet || this.isConnected) return;

    try {
      console.log('Connecting to EventsClient...');
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
