'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ChatMessage } from '@/lib/types';
import { cn, classifyInput } from '@/lib/utils';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  isMinimized?: boolean;
  placeholder?: string;
  showSuggestions?: boolean;
  className?: string;
}

const suggestions = [
  "undervalued tech stocks",
  "AAPL",
  "growth stocks with high momentum", 
  "TSLA analysis",
  "dividend stocks in healthcare",
  "MSFT",
];

const recentQueries = [
  "undervalued healthcare stocks",
  "GOOGL",
  "value stocks with low P/E",
  "NVDA analysis",
  "momentum stocks",
];

export default function ChatInterface({ 
  messages, 
  onSendMessage, 
  isLoading = false,
  isMinimized = false,
  placeholder = "Ask anything...",
  showSuggestions = true,
  className,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      // Don't clear input - keep it like a search engine
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSendMessage(suggestion);
  };

  return (
    <div className={cn(
      "flex flex-col transition-all duration-300",
      isMinimized ? "h-auto" : "h-full",
      className
    )}>
      {/* Messages */}
      <AnimatePresence mode="wait">
        {messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-1 overflow-y-auto px-4 py-2 space-y-4"
          >
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <Card
                  className={cn(
                    "max-w-[80%] p-4 shadow-elevated",
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </Card>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="px-4 py-4">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center">
                <Input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Try: 'AAPL' or 'undervalued tech stocks'"
                  disabled={isLoading}
                  className="pr-16 h-14 text-lg shadow-elevated hover:shadow-elevated-lg focus:shadow-elevated-lg transition-shadow"
                />
            <div className="absolute right-2 flex items-center gap-1">
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 shadow-elevated hover-lift"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </form>

            {/* Suggestions */}
            {showSuggestions && messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6 space-y-4"
              >
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground w-full">💡 Try:</span>
                  {suggestions.map((suggestion, index) => {
                    const isTicker = classifyInput(suggestion) === 'ticker';
                    return (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="h-9 text-sm shadow-elevated hover-lift"
                      >
                        {isTicker ? '📊' : '🔍'} {suggestion}
                      </Button>
                    );
                  })}
                </div>

                {recentQueries.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground w-full">Recent queries:</span>
                    {recentQueries.map((query, index) => {
                      const isTicker = classifyInput(query) === 'ticker';
                      return (
                        <Button
                          key={index}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSuggestionClick(query)}
                          className="h-8 text-sm text-muted-foreground hover:text-primary hover-glow"
                        >
                          {isTicker ? '📊' : '🔍'} {query}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
      </div>
    </div>
  );
}

