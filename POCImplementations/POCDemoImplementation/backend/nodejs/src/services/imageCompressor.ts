import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export interface CompressionResult {
  path: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Image Compressor Service
 * Compresses images using Sharp library to reduce file sizes
 */
export class ImageCompressor {
  private maxDimension: number;
  private quality: number;
  private outputFormat: 'webp' | 'jpeg' | 'png';

  constructor(
    maxDimension: number = 2048,
    quality: number = 85,
    outputFormat: 'webp' | 'jpeg' | 'png' = 'webp'
  ) {
    this.maxDimension = maxDimension;
    this.quality = quality;
    this.outputFormat = outputFormat;
  }

  /**
   * Compress an image file
   */
  async compress(inputPath: string): Promise<CompressionResult> {
    // Get original file stats
    const originalStats = await fs.stat(inputPath);
    const originalSize = originalStats.size;

    // Determine output path
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, `.compressed.${this.outputFormat}`);

    // Load image and get metadata
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Calculate resize dimensions (maintain aspect ratio)
    let width = metadata.width || this.maxDimension;
    let height = metadata.height || this.maxDimension;

    if (width > this.maxDimension || height > this.maxDimension) {
      if (width > height) {
        height = Math.round((height / width) * this.maxDimension);
        width = this.maxDimension;
      } else {
        width = Math.round((width / height) * this.maxDimension);
        height = this.maxDimension;
      }
    }

    // Compress image
    let pipeline = image.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    // Apply format-specific compression
    switch (this.outputFormat) {
      case 'webp':
        pipeline = pipeline.webp({ quality: this.quality });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality: this.quality, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality: Math.round(this.quality / 100 * 9), compressionLevel: 9 });
        break;
    }

    await pipeline.toFile(outputPath);

    // Get compressed file stats
    const compressedStats = await fs.stat(outputPath);
    const compressedSize = compressedStats.size;

    // Calculate compression ratio
    const compressionRatio = (1 - compressedSize / originalSize) * 100;

    return {
      path: outputPath,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  }

  /**
   * Check if a file is an image that can be compressed
   */
  static isCompressible(mimetype: string): boolean {
    return mimetype.startsWith('image/') && 
           (mimetype === 'image/png' || 
            mimetype === 'image/jpeg' || 
            mimetype === 'image/jpg' ||
            mimetype === 'image/webp');
  }
}

