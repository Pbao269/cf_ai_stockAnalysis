'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import ScreenerResults from '@/components/ScreenerResults';
import AdvancedScreener from '@/components/AdvancedScreener';
import { ScreenerFilters, ScreenerResult } from '@/lib/types';
import { screenStocks } from '@/lib/api';

function ScreenerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [results, setResults] = useState<{ hits: ScreenerResult[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (filters: ScreenerFilters) => {
    setIsLoading(true);
    try {
      const screening = await screenStocks(filters);
      if (screening.success) {
        setResults(screening.data);
        setShowAdvanced(false);
      }
    } catch (error) {
      console.error('Error in screening:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStockSelect = (symbol: string) => {
    router.push(`/analysis?ticker=${symbol}`);
  };

  const handleBack = () => {
    if (showAdvanced) {
      router.push('/landing');
    } else {
      setShowAdvanced(true);
      setResults(null);
    }
  };

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
            <span className="text-sm text-muted-foreground">• Advanced Screener</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/landing')}
              className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors hover-glow"
            >
              💬 Return to Chat
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <motion.div
          key={showAdvanced ? 'advanced' : 'results'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          {showAdvanced ? (
            <AdvancedScreener
              onBack={handleBack}
              onSearch={handleSearch}
              isLoading={isLoading}
            />
          ) : results ? (
            <ScreenerResults
              results={results}
              onStockSelect={handleStockSelect}
              onBack={handleBack}
              isLoading={isLoading}
            />
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No results found. Please try different filters.
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

export default function ScreenerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading screener...</p>
        </div>
      </div>
    }>
      <ScreenerContent />
    </Suspense>
  );
}
