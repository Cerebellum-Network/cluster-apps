import { makeAutoObservable } from 'mobx';

import { AccountStore } from '../AccountStore';

export class RegistryStore {
  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);
  }
}
