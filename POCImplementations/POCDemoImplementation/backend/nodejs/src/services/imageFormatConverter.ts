import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export interface ConversionResult {
  path: string;
  originalFormat: string;
  convertedFormat: 'jpeg' | 'png';
  originalSize: number;
  convertedSize: number;
}

/**
 * Image Format Converter Service
 * Converts any image format (including PDF pages) to JPEG or PNG
 */
export class ImageFormatConverter {
  /**
   * Convert image to JPEG or PNG format
   * Prefers JPEG for smaller file size, uses PNG for transparency or better quality
   */
  async convertToStandardFormat(
    inputPath: string,
    outputFormat: 'jpeg' | 'png' = 'jpeg',
    quality: number = 90
  ): Promise<ConversionResult> {
    // Get original file stats
    const originalStats = await fs.stat(inputPath);
    const originalSize = originalStats.size;
    
    // Determine original format from file extension or content
    const ext = path.extname(inputPath).toLowerCase();
    const originalFormat = ext.substring(1) || 'unknown';

    // Determine output path
    let outputPath = inputPath.replace(
      new RegExp(`${ext.replace('.', '\\.')}$`, 'i'),
      `.converted.${outputFormat}`
    );
    let finalFormat: 'jpeg' | 'png' = outputFormat;

    try {
      // Use Sharp to convert the image
      // Sharp can handle: JPEG, PNG, WebP, GIF, SVG, TIFF, BMP, and PDF (first page)
      const image = sharp(inputPath, {
        // For PDFs, convert first page only
        pages: ext === '.pdf' ? 1 : undefined,
      });

      // Get metadata to check for transparency
      const metadata = await image.metadata();
      const hasAlpha = metadata.hasAlpha || false;

      // If image has transparency and output format is JPEG, convert to PNG instead
      if (hasAlpha && outputFormat === 'jpeg') {
        finalFormat = 'png';
        outputPath = inputPath.replace(
          new RegExp(`${ext.replace('.', '\\.')}$`, 'i'),
          '.converted.png'
        );
        await image.png({ quality: 100, compressionLevel: 9 }).toFile(outputPath);
        
        const convertedStats = await fs.stat(outputPath);
        return {
          path: outputPath,
          originalFormat,
          convertedFormat: 'png',
          originalSize,
          convertedSize: convertedStats.size,
        };
      }

      // Convert based on desired format
      if (finalFormat === 'jpeg') {
        await image
          .jpeg({ quality, mozjpeg: true })
          .toFile(outputPath);
      } else {
        await image
          .png({ quality: Math.min(100, quality * 100 / 90), compressionLevel: 9 })
          .toFile(outputPath);
      }

      // Get converted file stats
      const convertedStats = await fs.stat(outputPath);
      const convertedSize = convertedStats.size;

      return {
        path: outputPath,
        originalFormat,
        convertedFormat: finalFormat,
        originalSize,
        convertedSize,
      };
    } catch (error: any) {
      // If Sharp can't handle the format, try reading as buffer and re-encoding
      if (error.message?.includes('unsupported') || error.message?.includes('Input buffer') || error.message?.includes('VipsOperation')) {
        // For PDFs or other complex formats, try reading and converting
        try {
          const buffer = await fs.readFile(inputPath);
          const image = sharp(buffer, {
            pages: ext === '.pdf' ? 1 : undefined,
          });
          
          if (finalFormat === 'jpeg') {
            await image.jpeg({ quality, mozjpeg: true }).toFile(outputPath);
          } else {
            await image.png({ quality: 100, compressionLevel: 9 }).toFile(outputPath);
          }

          const convertedStats = await fs.stat(outputPath);
          return {
            path: outputPath,
            originalFormat,
            convertedFormat: finalFormat,
            originalSize,
            convertedSize: convertedStats.size,
          };
        } catch (retryError) {
          // If conversion completely fails, log and rethrow
          console.error(`Failed to convert ${inputPath} to ${outputFormat}:`, retryError);
          throw new Error(`Unable to convert ${originalFormat} to ${outputFormat}: ${retryError}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Check if file needs conversion
   */
  static needsConversion(mimetype: string, filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    
    // Standard formats that don't need conversion
    const standardFormats = ['.jpg', '.jpeg', '.png'];
    
    // If it's already JPEG or PNG, might not need conversion (but we'll convert for consistency)
    // Always convert to ensure uniform format
    return true;
    
    // If you want to skip conversion for JPEG/PNG:
    // return !standardFormats.includes(ext);
  }

  /**
   * Determine best output format based on input
   */
  static determineOutputFormat(mimetype: string, filename: string): 'jpeg' | 'png' {
    const ext = path.extname(filename).toLowerCase();
    
    // PDF, WebP, GIF, TIFF, BMP, SVG should convert to JPEG (smaller)
    // PNG sources might want to stay PNG if they have transparency
    // For now, default to JPEG for better compression
    return 'jpeg';
  }
}

