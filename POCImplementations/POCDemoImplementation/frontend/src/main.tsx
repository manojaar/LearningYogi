import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { ResultsPage } from '@/pages/ResultsPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LLMProvider } from '@/context/LLMContext';
import '@/styles/index.css';

// Global error handlers to prevent unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Filter out browser extension errors
  const errorMessage = event.reason?.message || String(event.reason || '');
  const errorStack = event.reason?.stack || '';
  
  // Ignore errors from browser extensions
  const extensionErrors = [
    'Could not establish connection',
    'Receiving end does not exist',
    'message channel closed',
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'Teflon',
    'contentscript',
    'content-all.js',
    'content.js',
    'Video element not found',
  ];
  
  const isExtensionError = extensionErrors.some(pattern => 
    errorMessage.includes(pattern) || errorStack.includes(pattern)
  );
  
  if (isExtensionError) {
    // Prevent default handling and suppress console error for extension errors
    event.preventDefault();
    return;
  }
  
  // Log actual application errors for debugging
  console.error('Unhandled promise rejection:', event.reason);
});

// Suppress console errors from browser extensions
const originalError = console.error;
console.error = (...args: any[]) => {
  const errorStr = args.join(' ');
  const extensionPatterns = [
    'Teflon',
    'contentscript',
    'content-all.js',
    'content.js',
    'Could not establish connection',
    'Receiving end does not exist',
    'message channel closed',
    'Video element not found',
    'chrome-extension://',
  ];
  
  const isExtensionError = extensionPatterns.some(pattern => 
    errorStr.includes(pattern)
  );
  
  if (!isExtensionError) {
    originalError.apply(console, args);
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LLMProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/results/:documentId" element={<ResultsPage />} />
          </Routes>
        </BrowserRouter>
      </LLMProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

