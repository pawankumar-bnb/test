import type { StorageAdapter } from '../storage/adapter'
import { indexedDbAdapter } from '../storage/indexeddb'
import { cloudPhoto, queueCloudPhotoDelete } from './runtime'

/**
 * This device's IndexedDB, with photos it does not have yet fetched from the cloud
 * and deletions passed on to it. Documents sync separately, through the store.
 */
export const syncedStorage: StorageAdapter = {
  ...indexedDbAdapter,
  async getPhoto(id) {
    return (await indexedDbAdapter.getPhoto(id)) ?? (await cloudPhoto(id))
  },
  async deletePhoto(id) {
    await indexedDbAdapter.deletePhoto(id)
    await queueCloudPhotoDelete(id)
  },
}
