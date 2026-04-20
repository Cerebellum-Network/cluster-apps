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

export type ComputeTierSelection = {
  email: string;
  publicKey: string;
  tier: string;
};

export type ComputeTierSelectionResponse = {
  id: string;
  email: string;
  publicKey: string;
  tier: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
};
