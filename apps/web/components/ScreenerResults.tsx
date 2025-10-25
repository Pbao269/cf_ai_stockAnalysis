'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScreenerResult } from '@/lib/types';
import { formatCurrency, formatPercentage, formatMarketCap, getChangeColor } from '@/lib/utils';

interface ScreenerResultsProps {
  results: { hits: ScreenerResult[] };
  onStockSelect: (symbol: string) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export default function ScreenerResults({ 
  results, 
  onStockSelect, 
  onBack, 
  isLoading = false 
}: ScreenerResultsProps) {
  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-success-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-error-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success-600';
    if (score >= 60) return 'text-warning-600';
    return 'text-error-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Stock Results</h1>
            <p className="text-muted-foreground">
              Found {results.hits.length} stocks matching your criteria
            </p>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {results.hits.map((stock, index) => (
          <motion.div
            key={stock.symbol}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card 
              className="cursor-pointer shadow-elevated hover-lift"
              onClick={() => onStockSelect(stock.symbol)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{stock.symbol}</CardTitle>
                    <p className="text-sm text-muted-foreground truncate">
                      {stock.name}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {stock.sector}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Price and Change */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(stock.price)}</p>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(stock.change)}
                      <span className={`text-sm font-medium ${getChangeColor(stock.change)}`}>
                        {formatPercentage(stock.changePercent)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${getScoreColor(stock.overall_score)}`}>
                      {stock.overall_score}
                    </p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Market Cap</p>
                    <p className="font-medium">{formatMarketCap(stock.marketCap)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">P/E Ratio</p>
                    <p className="font-medium">{stock.pe_ratio?.toFixed(1) || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Volume</p>
                    <p className="font-medium">{stock.volume.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dividend</p>
                    <p className="font-medium">
                      {stock.dividend_yield ? `${(stock.dividend_yield * 100).toFixed(2)}%` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Rationale */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Why this stock?</p>
                  <p className="text-sm line-clamp-2">{stock.rationale}</p>
                </div>

                {/* Style Scores */}
                {stock.style_scores && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Style Scores</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(stock.style_scores).map(([style, score]) => (
                        score && (
                          <Badge 
                            key={style} 
                            variant="secondary" 
                            className="text-xs px-2 py-0.5"
                          >
                            {style}: {score}
                          </Badge>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <Button 
                  className="w-full shadow-elevated hover-lift" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Analyzing...' : 'Analyze Stock'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {results.hits.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <p className="text-muted-foreground text-lg">
            No stocks found matching your criteria
          </p>
          <Button 
            variant="outline" 
            onClick={onBack}
            className="mt-4"
          >
            Try Different Search
          </Button>
        </motion.div>
      )}
    </div>
  );
}
