import { AccountStore, Bucket, QuestsStore } from '~/stores';
import { computed, makeAutoObservable, reaction, runInAction } from 'mobx';
import { DirectoryType } from '~/applications/ContentStorage/FileManager';
import { DagNodeUri, Link } from '@cere-ddc-sdk/ddc-client';
import Reporting from '@developer-console/reporting';

export class ContentStorageStore {
  private _buckets: Bucket[] = [];
  private _dirs: DirectoryType[] = [];
  private _isBucketCreating: boolean = false;
  private _selectedBucket: string | null = null;
  private _loading: boolean = false;
  private _error: string | null = null;

  private _firstBucketLocked: boolean = true;

  constructor(
    private accountStore: AccountStore,
    private questsStore: QuestsStore,
  ) {
    makeAutoObservable(this, {
      firstBucketLocked: computed,
      isBucketCreating: computed,
      selectedBucket: computed,
      loading: computed,
      buckets: computed,
      dirs: computed,
    });

    reaction(
      () => this.accountStore.buckets,
      (newBuckets) => {
        const areBucketsEqual = (a: Bucket[], b: Bucket[]): boolean => {
          if (a.length !== b.length) return false;
          return a.every(
            (bucket, index) =>
              bucket.id === b[index].id &&
              bucket.isPublic === b[index].isPublic &&
              bucket.isRemoved === b[index].isRemoved,
          );
        };

        if (!areBucketsEqual(this._buckets, newBuckets || [])) {
          this._buckets = newBuckets || [];
          this.fetchDirs();
        }
      },
    );

    this._firstBucketLocked = localStorage.getItem('firstBucketLocked') === 'true';
  }

  get firstBucketLocked(): boolean {
    if (!this._dirs.some((dir) => !!dir.cid)) {
      return true;
    }
    return !(this._buckets.length >= 1 && this._dirs.some((dir) => !!dir.cid)) || this._firstBucketLocked;
  }

  get isBucketCreating(): boolean {
    return this._isBucketCreating;
  }

  get selectedBucket(): string | null {
    return this._selectedBucket;
  }

  get loading(): boolean {
    return this._loading;
  }

  get buckets(): Bucket[] {
    return this._buckets;
  }

  get dirs(): DirectoryType[] {
    return this._dirs;
  }

  setBucketCreating(isCreating: boolean) {
    this._isBucketCreating = isCreating;
  }

  setSelectedBucket(bucketId: string | null) {
    this._selectedBucket = bucketId;
  }

  private setFirstBucketLocked(isLocked: boolean) {
    console.log('Setting firstBucketLocked to:', isLocked);
    runInAction(() => {
      this._firstBucketLocked = isLocked;
      debugger;
      localStorage.setItem('firstBucketLocked', isLocked.toString());
    });
  }

  private setLoadingState(isLoading: boolean) {
    this._loading = isLoading;
  }

  private setErrorState(errorMessage: string | null) {
    this._error = errorMessage;
  }

  private async fetchDirs() {
    if (!this.accountStore.ddc || this._loading) {
      return;
    }

    this.setLoadingState(true);
    this.setErrorState(null);

    try {
      const newDirs = await this.loadDirectories();
      runInAction(() => {
        this._dirs = [...this._dirs, ...newDirs];
      });
    } catch (e) {
      this.handleError(e as Error);
    } finally {
      this.setLoadingState(false);
    }
  }

  private async loadDirectories(): Promise<DirectoryType[]> {
    const newDirs: DirectoryType[] = [];
    for (const bucket of this._buckets) {
      const dagUri = new DagNodeUri(BigInt(bucket.id), 'fs');
      try {
        const dir = await this.accountStore.ddc.read(dagUri, { cacheControl: 'no-cache' });
        if (dir) {
          const links: Link[] = dir.links;
          for (const link of links) {
            newDirs.push({ bucketId: bucket.id.toString(), isPublic: bucket.isPublic, ...link });
          }
        }
      } catch (dirError) {
        this.handleError(dirError as Error, bucket.id.toString());
        newDirs.push({ bucketId: bucket.id.toString(), isPublic: bucket.isPublic, ...({} as Link) });
      }
    }
    return newDirs;
  }

  async createBucket() {
    if (!this.accountStore.ddc) return;

    this.questsStore.markStepDone('uploadFile', 'createBucket');
    this.setBucketCreating(true);

    try {
      const createdBucketId = await this.accountStore.createBucket({ isPublic: true });
      await this.addNewBucket(createdBucketId.toString());
    } catch (error) {
      this.handleError(error as Error, 'Failed to create bucket');
    } finally {
      this.setBucketCreating(false);
    }
  }

  private async addNewBucket(bucketId: string) {
    const bucketInfo = await this.accountStore.ddc.getBucket(BigInt(bucketId));
    if (bucketInfo) {
      runInAction(() => {
        this._buckets.push({
          id: bucketInfo.bucketId,
          isPublic: bucketInfo.isPublic,
          isRemoved: bucketInfo.isRemoved,
          stats: undefined,
        });
        this.setSelectedBucket(bucketId);
      });
      await this.refetchBucket(BigInt(bucketId));
    }
  }

  async refetchBucket(bucketId: bigint) {
    if (!this.accountStore.ddc) {
      return;
    }

    this.setLoadingState(true);
    this.setErrorState(null);

    try {
      const newDirs = await this.loadDirectory(bucketId);
      runInAction(() => {
        this._dirs = [...this._dirs.filter((dir) => dir.bucketId !== bucketId.toString()), ...newDirs];
      });
    } catch (e) {
      this.handleError(e as Error, bucketId.toString());
    } finally {
      this.setLoadingState(false);
    }
  }

  private async loadDirectory(bucketId: bigint): Promise<DirectoryType[]> {
    const newDirs: DirectoryType[] = [];
    const dagUri = new DagNodeUri(bucketId, 'fs');
    try {
      const dir = await this.accountStore.ddc.read(dagUri, { cacheControl: 'no-cache' });
      if (dir) {
        const links: Link[] = dir.links;
        for (const link of links) {
          newDirs.push({ bucketId: bucketId.toString(), isPublic: true, ...link });
        }
      }
    } catch (dirError) {
      this.handleError(dirError as Error, bucketId.toString());
      newDirs.push({ bucketId: bucketId.toString(), isPublic: true, ...({} as Link) });
    }
    return newDirs;
  }

  private handleError(error: Error, context: string = '') {
    const errorMessage = context ? `Error ${context}: ${error.message}` : error.message;
    this.setErrorState(errorMessage);
    console.error(errorMessage);
    Reporting.message(errorMessage, 'error');
  }

  handleFirstBucketUnlock = async () => {
    if (!this.questsStore) {
      console.error('questsStore is not defined');
      return;
    }
    this.questsStore.markStepDone('uploadFile', 'createBucket');

    this.setBucketCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (this._buckets.length > 0) {
      runInAction(() => {
        this.setSelectedBucket(this._buckets[0].id.toString());
        this.setFirstBucketLocked(false);
      });
    }

    this.setBucketCreating(false);
  };
}
