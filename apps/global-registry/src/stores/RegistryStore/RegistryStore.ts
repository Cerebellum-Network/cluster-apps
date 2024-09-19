import { makeAutoObservable, reaction } from 'mobx';
import { lazyObservable } from 'mobx-utils';
import { AccessRegistryApi, AccessRegistryEntity, AccessRegistrySaveOptions } from '@cluster-apps/api';

import { AccountStore } from '../AccountStore';

export class RegistryStore {
  private registryApi = new AccessRegistryApi();
  private listObservable = lazyObservable<AccessRegistryEntity[]>(async (sink) => {
    const { address } = this.accountStore;

    if (!address) {
      return sink([]);
    }

    this.registryApi.getAccessList({ signerId: address }).then(sink);
  }, []);

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);

    reaction(
      () => this.accountStore.address,
      (address) => {
        if (!address) {
          this.listObservable.reset();
        } else {
          this.listObservable.refresh();
        }
      },
    );
  }

  get list() {
    const list = this.listObservable.current();

    return [...list].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  get isListLoading() {
    return this.listObservable.pending;
  }

  async saveAccess(access: AccessRegistrySaveOptions) {
    const resultAccess = await this.registryApi.saveAccess(access);

    this.listObservable.refresh();

    return resultAccess;
  }
}
