export type NodeAccessParams = {
  host: string;
  domain?: string;
  httpPort: string;
  grpcPort: string;
  p2pPort: string;
};

export type NodeAccessResponse = {
  reachable: Record<string, string | number>[];
  unreachable: Record<string, string | number>[];
};
