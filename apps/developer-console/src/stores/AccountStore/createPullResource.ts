import { fromResource } from 'mobx-utils';

export type PullResourceOptions = {
  pullTimeout?: number;
};

export const createPullResource = <T>(pull: () => T | Promise<T>, { pullTimeout = 6000 }: PullResourceOptions = {}) => {
  let timeout: NodeJS.Timeout;

  const start = async (run: () => Promise<void>) => {
    await run();

    timeout = setTimeout(() => start(run), pullTimeout);
  };

  return fromResource<T>(
    (sink) => start(async () => sink(await pull())),
    () => clearTimeout(timeout),
  );
};
