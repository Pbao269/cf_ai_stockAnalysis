'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import StockAnalysis from '@/components/StockAnalysis';
import { StockAnalysis as StockAnalysisType } from '@/lib/types';
import { analyzeStock } from '@/lib/api';

function AnalysisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticker = searchParams.get('ticker');
  const [analysisData, setAnalysisData] = useState<StockAnalysisType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (ticker) {
      loadAnalysis(ticker);
    } else {
      router.push('/landing');
    }
  }, [ticker, router]);

  const loadAnalysis = async (symbol: string) => {
    setIsLoading(true);
    try {
      const analysis = await analyzeStock(symbol);
      if (analysis.success) {
        setAnalysisData(analysis.data);
      } else {
        router.push('/landing');
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
      router.push('/landing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Analyzing {ticker}...</p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Analysis not found</p>
          <button
            onClick={() => router.push('/landing')}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Return to Landing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg shadow-elevated">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/landing')}
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center shadow-elevated hover-lift"
            >
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </button>
            <h1 className="text-lg font-semibold">Stock Analysis AI</h1>
            <span className="text-sm text-muted-foreground">• Analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors hover-glow"
            >
              ← Back
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <StockAnalysis
            data={analysisData}
            onBack={handleBack}
            isLoading={isLoading}
          />
        </motion.div>
      </main>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analysis...</p>
        </div>
      </div>
    }>
      <AnalysisContent />
    </Suspense>
  );
}
