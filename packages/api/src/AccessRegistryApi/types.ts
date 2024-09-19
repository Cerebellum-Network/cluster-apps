export type AccessRegistryEntity = {
  id: number;
  bucketId: bigint;
  cid?: string;
  accountId: string;
  signerId: string;
  accessToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ApiResponse<T = unknown> = {
  code: 'SUCCESS' | 'ERROR';
  data: T;
};
