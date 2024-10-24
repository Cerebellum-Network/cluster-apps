import { makeAutoObservable, runInAction } from 'mobx';
import { Amount, Blockchain, ClusterNodeKind, StorageNodeProps } from '@cere-ddc-sdk/blockchain';
import { APP_ENV, APP_ID, DDC_PRESET } from '../../constants.ts';
import { EmbedWallet } from '@cere/embed-wallet';
import { CereWalletSigner } from '@cere-ddc-sdk/ddc-client';

export class DdcBlockchainStore {
  readonly wallet = new EmbedWallet({ appId: APP_ID, env: APP_ENV });
  readonly signer = new CereWalletSigner(this.wallet, { autoConnect: false });

  status: string = 'Ready';
  blockchainPromise: Promise<Blockchain> | undefined;

  constructor(protected readonly blockchainWsEndpoint = DDC_PRESET.blockchain) {
    makeAutoObservable(this, {
      blockchainPromise: false,
    });
  }

  getOrCreateBlockchain() {
    if (this.blockchainPromise !== undefined) {
      return this.blockchainPromise;
    }
    this.blockchainPromise = Blockchain.connect({
      wsEndpoint: this.blockchainWsEndpoint,
    });

    this.blockchainPromise
      .then((blockchain) => {
        console.log('Blockchain connected:', blockchain);
      })
      .catch((error) => {
        console.error('Error connecting to blockchain:', error);
      });

    return this.blockchainPromise;
  }

  private setStatus(newStatus: string) {
    runInAction(() => {
      this.status = newStatus;
      console.log(`Status updated: ${newStatus}`);
    });
  }

  async addStorageNodeToCluster({
    nodePublicKey,
    nodeParams,
  }: {
    nodePublicKey: string;
    nodeParams: StorageNodeProps;
  }) {
    try {
      await this.wallet.init();
      await this.wallet.connect();
      const senderAddress = this.signer.address;

      if (!senderAddress) {
        throw new Error('Signer account is not available');
      }

      const blockchain = await this.getOrCreateBlockchain();
      if (!blockchain || !blockchain.api) {
        throw new Error('Blockchain is not initialized correctly');
      }
      const signer = await this.signer.getSigner();
      blockchain.api.setSigner(signer);

      const amount: Amount = BigInt(500);

      const tx1 = blockchain.ddcNodes.createStorageNode(nodePublicKey, nodeParams);
      const tx2 = blockchain.ddcStaking.bondStorageNode(senderAddress, nodePublicKey, amount);
      const tx3 = blockchain.ddcStaking.store('0x0000000000000000000000000000000000000001');
      const tx4 = blockchain.ddcStaking.setController(nodePublicKey);
      const tx5 = blockchain.ddcClusters.addStorageNodeToCluster(
        '0x0000000000000000000000000000000000000001',
        nodePublicKey,
        ClusterNodeKind.Genesis,
      );

      const batchTx = blockchain.api.tx.utility.batch([tx1, tx2, tx3, tx4, tx5]);

      const unsub = await batchTx.signAndSend(senderAddress, ({ status }) => {
        runInAction(() => {
          if (status.isInBlock) {
            this.setStatus(`Included in the block: ${status.asInBlock}`);
          } else if (status.isFinalized) {
            this.setStatus(`Transaction finalized: ${status.asFinalized}`);
            unsub();
          }
        });
      });
    } catch (error) {
      this.setStatus(`Error: ${error.message}`);
    }
  }
}
