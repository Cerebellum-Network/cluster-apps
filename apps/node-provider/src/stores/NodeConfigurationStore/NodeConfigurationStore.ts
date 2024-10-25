import { makeAutoObservable } from 'mobx';
import { ClusterManagementApi, NodeAccessParams } from '@cluster-apps/api';
import { StorageNodeProps, StorageNodeMode } from '@cere-ddc-sdk/blockchain';
import { DdcBlockchainStore } from '../DdcBlockchainStore';
import { DDC_PRESET } from '../../constants.ts';

export class NodeConfigurationStore {
  private clusterManagementApi = new ClusterManagementApi();

  nodePublicKey = '';
  nodeType = 'storage';
  hostName = '';
  port = '';
  grpcPort = '';
  p2pPort = '';
  status = "validation hasn't started yet";
  checks = {
    openPortChecked: false,
    nodeVersionChecked: false,
    nodeKeyChecked: false,
  };
  isLoading = false;

  constructor(private ddcBlockchainStore: DdcBlockchainStore) {
    makeAutoObservable(this);
  }

  setNodePublicKey(publicKey: string) {
    this.nodePublicKey = publicKey;
  }

  setNodeType(type: string) {
    this.nodeType = type;
  }

  setHostName(host: string) {
    this.hostName = host;
  }

  setPort(port: string) {
    this.port = port;
  }

  setGrpcPort(port: string) {
    this.grpcPort = port;
  }

  setP2pPort(port: string) {
    this.p2pPort = port;
  }

  handleValidation = async () => {
    this.status = 'Validation in progress...';
    try {
      const nodeParams: NodeAccessParams = {
        host: this.hostName,
        httpPort: this.port,
        grpcPort: this.grpcPort,
        p2pPort: this.p2pPort,
        domain: 'www.example.com',
      };

      const response = await this.clusterManagementApi.validateNodeConfiguration(nodeParams);

      if (response.data.unreachable.length === 0) {
        await this.activateCheckboxesWithDelay();
        this.status = 'Validation successful!';
      } else {
        this.status = 'Validation failed!';
      }
    } catch (error) {
      this.status = 'Validation failed!';
    }
  };

  handleCopyCommand = async () => {
    const storageRoot = './';
    const mode = this.nodeType === 'cdn' ? 'cache' : 'storage';
    const command = `bash <(curl -s https://cdn.dragon.cere.network/961/baear4ifvgsrxc6y5rsmxlyyste4cyv35np6noedn4jb3bsyriqd2skre4i/bootstrap.sh) "${storageRoot}" "${DDC_PRESET.blockchain}" "${mode}" "${this.nodeType}" "${this.port}" "${this.grpcPort}" "${this.p2pPort}"`;
    navigator.clipboard.writeText(command).then(() => {});
  };

  activateCheckboxesWithDelay = async () => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    this.checks.openPortChecked = true;
    await delay(2000);
    this.checks.nodeVersionChecked = true;
    await delay(2000);
    this.checks.nodeKeyChecked = true;
  };

  async addNodeToTheCluster() {
    const nodeParams: StorageNodeProps = {
      host: this.hostName,
      httpPort: +this.port,
      grpcPort: +this.grpcPort,
      p2pPort: +this.p2pPort,
      mode: this.nodeType === 'cdn' ? StorageNodeMode.Cache : StorageNodeMode.Storage,
    };
    this.isLoading = true;
    try {
      await this.ddcBlockchainStore.addStorageNodeToCluster({ nodePublicKey: this.nodePublicKey, nodeParams });
      console.log('Your node was added to the cluster successfully!');
      return 'OK';
    } catch (error) {
      console.error('Error adding node to cluster:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
