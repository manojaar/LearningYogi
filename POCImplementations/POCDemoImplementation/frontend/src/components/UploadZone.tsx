import React, { useCallback, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, File, AlertCircle } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, isUploading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PNG, JPG, or PDF files.');
      return false;
    }

    if (file.size > maxSize) {
      setError('File size exceeds 50MB limit.');
      return false;
    }

    setError(null);
    return true;
  };

  const handleFileSelect = useCallback((file: File) => {
    if (validateFile(file)) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-12 transition-all duration-300
          ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary-400'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isUploading}
        />

        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
            <div className={`
              p-4 rounded-full transition-colors duration-300
              ${isDragging ? 'bg-primary-100' : 'bg-gray-100'}
            `}>
              <Upload className="w-12 h-12 text-primary-600" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900">
              {isDragging ? 'Drop your timetable here' : 'Upload your Timetable'}
            </h3>
            <p className="text-gray-600">
              Drag and drop your file, or click to browse
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
              <ImageIcon className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">PNG / JPG</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
              <File className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">PDF</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
              <FileText className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">Max 50MB</span>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
        </div>
      </div>

      {isUploading && (
        <p className="mt-4 text-center text-gray-600 animate-pulse">
          Uploading and processing your timetable...
        </p>
      )}
    </div>
  );
};

