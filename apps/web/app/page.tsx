'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import ChatInterface from '@/components/ChatInterface';
import ScreenerResults from '@/components/ScreenerResults';
import StockAnalysis from '@/components/StockAnalysis';
import AdvancedScreener from '@/components/AdvancedScreener';
import { AppMode, ChatMessage } from '@/lib/types';
import { generateId, classifyInput } from '@/lib/utils';
import { parseIntent, screenStocks, analyzeStock } from '@/lib/api';

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [screenerResults, setScreenerResults] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [showAdvancedScreener, setShowAdvancedScreener] = useState(false);

  const handleSendMessage = useCallback(async (message: string) => {
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const inputType = classifyInput(message);
      
      if (inputType === 'ticker') {
        // Direct stock analysis
        const analysis = await analyzeStock(message.toUpperCase());
        if (analysis.success) {
          setAnalysisData(analysis.data);
          setMode('analysis');
          setSelectedStock(analysis.data);
        }
      } else {
        // Intent-based screening
        const intent = await parseIntent(message);
        if (intent.success) {
          const screening = await screenStocks(intent.data);
          if (screening.success) {
            setScreenerResults(screening.data);
            setMode('screener');
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStockSelect = useCallback(async (symbol: string) => {
    setIsLoading(true);
    try {
      const analysis = await analyzeStock(symbol);
      if (analysis.success) {
        setAnalysisData(analysis.data);
        setMode('analysis');
        setSelectedStock(analysis.data);
      }
    } catch (error) {
      console.error('Error analyzing stock:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleBackToResults = useCallback(() => {
    setMode('screener');
    setAnalysisData(null);
    setSelectedStock(null);
  }, []);

  const handleBackToChat = useCallback(() => {
    setMode('chat');
    setScreenerResults(null);
    setAnalysisData(null);
    setSelectedStock(null);
    setShowAdvancedScreener(false);
  }, []);

  const handleAdvancedScreenerSearch = useCallback(async (filters: any) => {
    setIsLoading(true);
    try {
      const screening = await screenStocks(filters);
      if (screening.success) {
        setScreenerResults(screening.data);
        setMode('screener');
        setShowAdvancedScreener(false);
      }
    } catch (error) {
      console.error('Error in advanced screening:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        mode={mode} 
        onModeChange={(newMode) => {
          if (newMode === 'screener') {
            setShowAdvancedScreener(true);
            setMode('screener');
          } else {
            setMode(newMode);
            setShowAdvancedScreener(false);
          }
        }}
        onMenuClick={() => {}} // TODO: Implement mobile menu
      />
      
      <main className="container mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {mode === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-4">
                  What would you like to analyze?
                </h1>
                <p className="text-lg text-muted-foreground">
                  Ask about stocks, get AI-powered analysis, or search for investment opportunities
                </p>
              </div>
              
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                showSuggestions={messages.length === 0}
              />
            </motion.div>
          )}

          {mode === 'screener' && screenerResults && (
            <motion.div
              key="screener"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ScreenerResults
                results={screenerResults}
                onStockSelect={handleStockSelect}
                onBack={handleBackToChat}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {mode === 'analysis' && analysisData && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <StockAnalysis
                data={analysisData}
                onBack={mode === 'screener' ? handleBackToResults : handleBackToChat}
                isLoading={isLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
