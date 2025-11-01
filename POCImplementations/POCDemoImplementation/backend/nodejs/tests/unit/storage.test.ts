import { StorageService } from '../../src/services/storage.service';
import * as fs from 'fs';
import * as path from 'path';

describe('StorageService Unit Tests', () => {
  let storage: StorageService;
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(__dirname, '../../../data/uploads/test');
    // Ensure directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    storage = new StorageService(testDir);
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testDir, file));
      }
    }
  });

  describe('File Operations', () => {
    it('should save file to storage', async () => {
      const buffer = Buffer.from('test content');
      const filename = 'test.txt';
      
      const filePath = await storage.saveFile(buffer, filename);
      
      expect(filePath).toBeTruthy();
      expect(fs.existsSync(filePath)).toBe(true);
      
      const savedContent = fs.readFileSync(filePath);
      expect(savedContent.toString()).toBe('test content');
    });

    it('should read file from storage', async () => {
      const buffer = Buffer.from('read test');
      const filename = 'read-test.txt';
      
      const filePath = await storage.saveFile(buffer, filename);
      const readBuffer = await storage.readFile(filePath);
      
      expect(readBuffer.toString()).toBe('read test');
    });

    it('should delete file from storage', async () => {
      const buffer = Buffer.from('delete test');
      const filename = 'delete-test.txt';
      
      const filePath = await storage.saveFile(buffer, filename);
      expect(fs.existsSync(filePath)).toBe(true);
      
      await storage.deleteFile(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should check if file exists', async () => {
      const buffer = Buffer.from('exists test');
      const filename = 'exists-test.txt';
      
      const filePath = await storage.saveFile(buffer, filename);
      
      expect(await storage.fileExists(filePath)).toBe(true);
      expect(await storage.fileExists('/nonexistent/file.txt')).toBe(false);
    });

    it('should generate unique filenames', () => {
      const originalName = 'timetable.png';
      const unique1 = storage.generateUniqueFilename(originalName);
      const unique2 = storage.generateUniqueFilename(originalName);
      
      expect(unique1).not.toBe(unique2);
      expect(unique1).toMatch(/\.png$/);
      expect(unique2).toMatch(/\.png$/);
    });
  });

  describe('Directory Management', () => {
    it('should create nested directories', async () => {
      const buffer = Buffer.from('test');
      const subdir = 'subdir/nested';
      
      const filePath = await storage.saveFile(buffer, 'test.txt', subdir);
      
      const fullPath = path.resolve(filePath);
      expect(fullPath).toContain('subdir/nested');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});

