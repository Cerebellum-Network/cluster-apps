import { DEVNET } from '@cere-ddc-sdk/ddc-client';

type UseNodeRunCommandProps = {
  nodePublicKey: string | null;
  port: number;
  nodeType: 'storage' | 'cdn';
  blockChainUrl?: string;
  mnemonic: string | null;
  networkName?: string;
  nodeIp?: string;
  grpcPort: number;
  p2pPort: number;
};

export const useNodeRunCommand = ({
  nodePublicKey,
  nodeType,
  port,
  blockChainUrl = DEVNET.blockchain,
  mnemonic,
  networkName = 'TEST',
  grpcPort,
  p2pPort,
}: UseNodeRunCommandProps) => {
  const runCommandPrefix = `docker run --restart=always -d --name ddc-${nodeType}-node-${nodePublicKey} \
    -v $HOME/ddc/${nodePublicKey}:/data:rw \
    -p ${port}:${port} -p ${grpcPort}:${grpcPort} -p ${p2pPort}:${p2pPort} \
    --network ${networkName} \
    --add-host "host.docker.internal:host-gateway"`;

  const envVariables = `
    --env LOG_LEVEL='trace' \
    --env LOG_REPORT_CALLER='true' \
    --env LOG_P2P_RPC_LEVEL='trace' \
    --env STORAGE_RESERVED='100MiB' \
    --env STORAGE_CUTOFF='10MiB' \
    --env STORAGE_THRESHOLD='0.99' \
    --env REDUNDANCY_ERASURE_CODING_REQUIRED='2' \
    --env REDUNDANCY_ERASURE_CODING_TOTAL='3' \
    --env REDUNDANCY_ERASURE_CODING_SUCCESS_THRESHOLD='3' \
    --env REDUNDANCY_ERASURE_CODING_REPAIR_THRESHOLD='3' \
    --env REDUNDANCY_REPLICATION_TOTAL='3' \
    --env REDUNDANCY_REPLICATION_SUCCESS_THRESHOLD='3' \
    --env P2P_MAX_MESSAGE_SIZE='68157440' \
    --env LIMITS_EXTERNAL_TRAFFIC='1073741824' \
    --env LIMITS_PUBLIC_REQUESTS_PER_SECOND='50' \
    --env LIMITS_PUBLIC_REQUESTS_BURST='500' \
    --env LIMITS_PUBLIC_BYTES_PER_SECOND='200000000' \
    --env GRPC_BANDWIDTH_LIMITER_MAX_IDLE='15s' \
    --env GRPC_BANDWIDTH_LIMITER_MIN_KBPS='1' \
    --env GRPC_BANDWIDTH_LIMITER_WARMUP='10s' \
    --env GRPC_BANDWIDTH_LIMITER_EVAL_PERIOD='5s' \
    --env UNACKNOWLEDGED_DELIVERY_QUOTA_REFILL_TIMEOUT='1500s' \
    --env UNACKNOWLEDGED_DELIVERY_QUOTA_MAX_TTL='3000s' \
    --env UNACKNOWLEDGED_DELIVERY_QUOTA_CAPACITY='52428800' \
    --env CACHE_P2P_DIGEST_TTL='5s' \
    --env ACTIVITY_ERA_DURATION='24h' \
    --env ACTIVITY_COLLECTION_RECORD_AWAIT_TIMEOUT='5s' \
    --env ACTIVITY_COLLECTION_LAST_ACK_AWAIT_TIMEOUT='5s' \
    --env ACTIVITY_PROCESSING_DELAY='5m' \
    --env ACTIVITY_PROCESSING_PERIOD='5m' \
    --env ACTIVITY_PROCESSING_REDUNDANCY='3' \
    --env PEER_SECRET_PHRASE='${mnemonic}' \
    --env GRPC_PORT='${grpcPort}' \
    --env P2P_PORT='${p2pPort}' \
    --env HTTP_PORT='${port}' \
    --env BLOCKCHAIN_URL="${blockChainUrl}"`;

  const dockerImage = `cerebellumnetwork/ddc-${nodeType}-node:test`;

  const runCommand = `${runCommandPrefix} \\
  ${envVariables} \\
  ${dockerImage}`;

  return { runCommand, envVariables, runCommandPrefix, grpcPort, p2pPort, dockerImage };
};
