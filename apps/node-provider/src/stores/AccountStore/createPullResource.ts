import { fromResource } from 'mobx-utils';
import Reporting from '@cluster-apps/reporting';

export type PullResourceOptions = {
  pullTimeout?: number;
};

export const createPullResource = <T>(pull: () => T | Promise<T>, { pullTimeout = 6000 }: PullResourceOptions = {}) => {
  let timeout: NodeJS.Timeout;

  const start = async (run: () => Promise<void>) => {
    await run().catch(Reporting.error);

    timeout = setTimeout(() => start(run), pullTimeout);
  };

  return fromResource<T>(
    (sink) => start(async () => sink(await pull())),
    () => clearTimeout(timeout),
  );
};
