import { promises as fs } from 'fs';
import path from 'path';

/**
 * Storage abstraction (spec §2: "S3-compatible storage with an abstraction
 * supporting on-premise object storage"). This default implementation writes
 * to local disk so the product runs at a paper-first site with no cloud
 * dependency. Swap STORAGE_DRIVER=s3 (not wired up in this MVP) to point the
 * same interface at an S3-compatible bucket without touching callers.
 */
export interface ObjectStorage {
  putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer | null>;
}

const ROOT = path.join(process.cwd(), '.data', 'storage');

class LocalFsStorage implements ObjectStorage {
  async putObject(key: string, bytes: Uint8Array, _contentType: string): Promise<void> {
    const fullPath = path.join(ROOT, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, bytes);
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(ROOT, key));
    } catch {
      return null;
    }
  }
}

export const storage: ObjectStorage = new LocalFsStorage();
