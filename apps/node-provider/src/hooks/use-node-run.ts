type UseNodeRunCommandProps = {
  nodePublicKey: string | null;
  port: number;
  nodeType: 'storage' | 'cdn';
};

export const useNodeRunCommand = ({
  nodePublicKey,
  nodeType,
  port,
  blockChainUrl,
  mnemonic,
}: UseNodeRunCommandProps) => {
  console.log('T');
  const grpcPort = port + 1000;
  const p2pPort = port + 990;

  const runCommandPrefix = `docker run --restart=always -d --name ddc-${nodeType}-node-${nodePublicKey} -v $HOME/ddc/${
    nodePublicKey || 'node-key'
  }:/data:rw -p ${port}:${port} -p ${grpcPort}:${grpcPort} -p ${p2pPort}:${p2pPort} -e HTTP_PORT=${port} -e GRPC_PORT=${grpcPort} -e BLOCKCHAIN_URL="${blockChainUrl}" -e PEER_URL="libp2p://0.0.0.0:${p2pPort}"`;
  const dockerImage = `cerebellumnetwork/ddc-${nodeType}-node:dev-latest`;

  const secretPhraseEnvVariable = '-e PEER_SECRET_PHRASE';

  const runCommand = `${runCommandPrefix} ${secretPhraseEnvVariable}="${mnemonic || ''}" ${dockerImage}`;

  return { runCommand, secretPhraseEnvVariable, runCommandPrefix, grpcPort, p2pPort, dockerImage };
};
