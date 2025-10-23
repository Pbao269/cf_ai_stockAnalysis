'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import ChatInterface from '@/components/ChatInterface';
import { ChatMessage } from '@/lib/types';
import { generateId, classifyInput } from '@/lib/utils';
import { parseIntent, screenStocks, analyzeStock } from '@/lib/api';

export default function LandingPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
          router.push(`/analysis?ticker=${message.toUpperCase()}`);
        }
      } else {
        // Intent-based screening
        const intent = await parseIntent(message);
        if (intent.success) {
          const screening = await screenStocks(intent.data);
          if (screening.success) {
            router.push('/screener');
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
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg shadow-elevated">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center shadow-elevated">
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </div>
            <h1 className="text-lg font-semibold">Stock Analysis AI</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/screener')}
              className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors hover-glow"
            >
              Advanced Search
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold mb-4">
              What would you like to analyze?
            </h1>
            <p className="text-lg text-muted-foreground">
              Ask about stocks, get AI-powered analysis, or search for investment opportunities
            </p>
          </motion.div>
          
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            showSuggestions={messages.length === 0}
            className="max-w-2xl mx-auto"
          />
        </div>
      </main>
    </div>
  );
}
