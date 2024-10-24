import { Blockchain, Signer } from '@cere-ddc-sdk/blockchain';
import { DDC_PRESET } from '../constants.ts';

export class DdcBlockchainService {
  protected blockchainPromise: Promise<Blockchain> | undefined;

  constructor(protected readonly blockchainWsEndpoint = DDC_PRESET.blockchain) {}

  protected getOrCreateBlockchain() {
    if (this.blockchainPromise != null) {
      return this.blockchainPromise;
    }
    this.blockchainPromise = Blockchain.connect({
      wsEndpoint: this.blockchainWsEndpoint,
    });

    return this.blockchainPromise;
  }

  async addStorageNodeToCluster({ nodePublicKey, sender }: { nodePublicKey: string; sender: Signer }) {
    const blockchain = await this.getOrCreateBlockchain();

    const tx1 = blockchain.api.tx.palletDdcNodes.createNode(nodePublicKey, {
      /* параметры node_params */
    });
    const tx2 = blockchain.api.tx.palletDdcStaking.bond(sender.address, node_pub_key, amount);
    const tx3 = blockchain.api.tx.palletDdcStaking.store('0x0000000000000000000000000000000000000001');
    const tx4 = blockchain.api.tx.palletDdcStaking.setController(new_controller);
    const tx5 = blockchain.api.tx.palletDdcClusters.joinCluster(cluster_id, node_pub_key);

    const batchTx = blockchain.api.tx.utility.batch([tx1, tx2, tx3, tx4, tx5]);

    const unsub = await batchTx.signAndSend(sender, ({ status }) => {
      if (status.isInBlock) {
        console.log(`Включено в блок: ${status.asInBlock}`);
      } else if (status.isFinalized) {
        console.log(`Транзакция финализирована: ${status.asFinalized}`);
        unsub();
      }
    });
  }
}
