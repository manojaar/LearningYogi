import axios, { AxiosInstance } from 'axios';
import { TimetableData } from '../models/types';

/**
 * Processing service to orchestrate OCR and AI pipeline
 */
export class ProcessingService {
  private aiApi: AxiosInstance;

  constructor(pythonApiUrl: string) {
    this.aiApi = axios.create({
      baseURL: pythonApiUrl,
      timeout: 300000,  // 5 minutes (300 seconds) - increased for AI processing
    });
  }

  /**
   * Preprocess image
   */
  async preprocessImage(imagePath: string, outputDir: string): Promise<string> {
    const response = await this.aiApi.post('/preprocess/enhance', {
      image_path: imagePath,
      output_dir: outputDir,
    });

    return response.data.enhanced_image_path;
  }

  /**
   * Process OCR
   */
  async processOCR(imagePath: string): Promise<any> {
    const response = await this.aiApi.post('/ocr/process', {
      image_path: imagePath,
    });

    return response.data;
  }

  /**
   * Extract timetable with Claude AI
   * Uses async endpoint for better performance
   */
  async extractWithAI(imagePath: string, useAsync: boolean = true): Promise<TimetableData> {
    const endpoint = useAsync ? '/ai/extract-async' : '/ai/extract';
    const response = await this.aiApi.post(endpoint, {
      image_path: imagePath,
    });

    return response.data;
  }

  /**
   * Get quality gate decision
   */
  async getQualityGate(ocrResult: any): Promise<any> {
    const response = await this.aiApi.post('/ocr/quality-gate', ocrResult);
    return response.data;
  }
}

