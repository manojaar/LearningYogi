import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Storage service abstraction
 * Supports local filesystem with S3-compatible interface
 */
export class StorageService {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.ensureDirectory(basePath);
  }

  /**
   * Save file to storage
   */
  async saveFile(buffer: Buffer, filename: string, subdirectory: string = ''): Promise<string> {
    const dir = path.join(this.basePath, subdirectory);
    this.ensureDirectory(dir);

    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);

    return filePath;
  }

  /**
   * Read file from storage
   */
  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFileSync(filePath);
  }

  /**
   * Delete file from storage
   */
  async deleteFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    return fs.existsSync(filePath);
  }

  /**
   * Generate unique filename
   */
  generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const randomId = crypto.randomBytes(16).toString('hex');
    return `${randomId}${ext}`;
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

