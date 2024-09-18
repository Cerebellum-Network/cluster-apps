import { makeAutoObservable, reaction } from 'mobx';
import { lazyObservable } from 'mobx-utils';
import { AccessRegistryApi, AccessRegistrySaveOptions } from '@cluster-apps/api';

import { AccountStore } from '../AccountStore';

export class RegistryStore {
  private registryApi = new AccessRegistryApi();
  private listObservable = lazyObservable<any>(async (sink) => {
    if (!this.accountStore.isReady()) {
      return sink([]);
    }

    this.registryApi.getAccessList({ signerId: this.accountStore.address }).then(sink);
  });

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
    return this.listObservable.current();
  }

  async saveAccess(access: AccessRegistrySaveOptions) {
    await this.registryApi.saveAccess(access);

    this.listObservable.refresh();
  }
}
