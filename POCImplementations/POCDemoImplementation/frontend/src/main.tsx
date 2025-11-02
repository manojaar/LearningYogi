import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { ResultsPage } from '@/pages/ResultsPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LLMProvider } from '@/context/LLMContext';
import '@/styles/index.css';

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

