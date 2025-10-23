'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Star, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StockAnalysis as StockAnalysisType } from '@/lib/types';
import { formatCurrency, formatPercentage, formatMarketCap, getChangeColor, getTrendColor, getTrendBadgeColor } from '@/lib/utils';

interface StockAnalysisProps {
  data: StockAnalysisType;
  onBack: () => void;
  isLoading?: boolean;
}

export default function StockAnalysis({ data, onBack, isLoading = false }: StockAnalysisProps) {
  const getTrendIcon = (trend: string) => {
    switch (trend.toLowerCase()) {
      case 'very_bullish':
      case 'bullish':
        return <TrendingUp className="h-4 w-4 text-success-600" />;
      case 'very_bearish':
      case 'bearish':
        return <TrendingDown className="h-4 w-4 text-error-600" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
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
            <h1 className="text-2xl font-bold">{data.symbol} - {data.name}</h1>
            <p className="text-muted-foreground">{data.sector} • {formatMarketCap(data.marketCap)}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          {data.sector}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-elevated hover-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Current Price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.price)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-elevated hover-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">52W High</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.overview.week52High)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-elevated hover-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">52W Low</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.overview.week52Low)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-elevated hover-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.overview.volume.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
          <TabsTrigger value="dcf">DCF</TabsTrigger>
          <TabsTrigger value="dca">DCA</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{data.overview.summary}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-success-600" />
                  Bull Case
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.overview.bullPoints.map((point, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-success-600 mt-1">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-error-600" />
                  Bear Case
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.overview.bearPoints.map((point, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-error-600 mt-1">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Catalysts */}
          <Card>
            <CardHeader>
              <CardTitle>Key Catalysts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.overview.catalysts.map((catalyst, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{catalyst.event}</p>
                      {catalyst.date && (
                        <p className="text-sm text-muted-foreground">{catalyst.date}</p>
                      )}
                    </div>
                    <Badge 
                      variant={catalyst.impact === 'high' ? 'destructive' : 
                              catalyst.impact === 'medium' ? 'default' : 'secondary'}
                    >
                      {catalyst.impact} impact
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fundamentals Tab */}
        <TabsContent value="fundamentals" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Valuation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">P/E Ratio</span>
                  <span className="font-medium">{data.fundamentals.pe_ratio?.toFixed(1) || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">P/B Ratio</span>
                  <span className="font-medium">{data.fundamentals.pb_ratio?.toFixed(1) || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">P/S Ratio</span>
                  <span className="font-medium">{data.fundamentals.ps_ratio?.toFixed(1) || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Profitability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">ROE</span>
                  <span className="font-medium">{data.fundamentals.roe?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">ROA</span>
                  <span className="font-medium">{data.fundamentals.roa?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Gross Margin</span>
                  <span className="font-medium">{data.fundamentals.gross_margin?.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Growth</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Revenue Growth</span>
                  <span className="font-medium">{formatPercentage(data.fundamentals.revenue_growth || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Earnings Growth</span>
                  <span className="font-medium">{formatPercentage(data.fundamentals.earnings_growth || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Dividend Yield</span>
                  <span className="font-medium">{formatPercentage((data.fundamentals.dividend_yield || 0) * 100)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Technical Tab */}
        <TabsContent value="technical" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Trend Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Short Term</span>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(data.technical.trend.short_term)}
                      <Badge className={getTrendBadgeColor(data.technical.trend.short_term)}>
                        {data.technical.trend.short_term}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Medium Term</span>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(data.technical.trend.medium_term)}
                      <Badge className={getTrendBadgeColor(data.technical.trend.medium_term)}>
                        {data.technical.trend.medium_term}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Long Term</span>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(data.technical.trend.long_term)}
                      <Badge className={getTrendBadgeColor(data.technical.trend.long_term)}>
                        {data.technical.trend.long_term}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm">Trend Strength</span>
                    <span className="font-medium">{(data.technical.trend.strength * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Levels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Support Levels</p>
                  <div className="space-y-1">
                    {data.technical.support_levels.map((level, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>Support {index + 1}</span>
                        <span className="font-medium">{formatCurrency(level)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Resistance Levels</p>
                  <div className="space-y-1">
                    {data.technical.resistance_levels.map((level, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>Resistance {index + 1}</span>
                        <span className="font-medium">{formatCurrency(level)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Technical Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">RSI</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{data.technical.indicators.rsi.value}</span>
                    <Badge variant={data.technical.indicators.rsi.overbought ? 'destructive' : 
                                   data.technical.indicators.rsi.oversold ? 'default' : 'secondary'}>
                      {data.technical.indicators.rsi.signal}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">MACD</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>MACD Line</span>
                      <span>{data.technical.indicators.macd.macd_line.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Signal Line</span>
                      <span>{data.technical.indicators.macd.signal_line.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Histogram</span>
                      <span>{data.technical.indicators.macd.histogram.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DCF Tab */}
        <TabsContent value="dcf" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Valuation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-success-600">
                    {formatCurrency(data.dcf.fair_value)}
                  </p>
                  <p className="text-sm text-muted-foreground">Fair Value</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{formatCurrency(data.dcf.current_price)}</p>
                  <p className="text-sm text-muted-foreground">Current Price</p>
                </div>
                <div className="text-center">
                  <p className={`text-xl font-bold ${getChangeColor(data.dcf.upside_downside)}`}>
                    {formatPercentage(data.dcf.upside_downside)}
                  </p>
                  <p className="text-sm text-muted-foreground">Upside/Downside</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{(data.dcf.confidence_level * 100).toFixed(0)}%</p>
                  <p className="text-sm text-muted-foreground">Confidence Level</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Scenario Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-2 border rounded">
                  <span className="text-sm">Bull Case</span>
                  <div className="text-right">
                    <p className="font-bold text-success-600">{formatCurrency(data.dcf.scenarios.bull.price)}</p>
                    <p className="text-xs text-muted-foreground">{(data.dcf.scenarios.bull.probability * 100).toFixed(0)}%</p>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 border rounded">
                  <span className="text-sm">Base Case</span>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(data.dcf.scenarios.base.price)}</p>
                    <p className="text-xs text-muted-foreground">{(data.dcf.scenarios.base.probability * 100).toFixed(0)}%</p>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 border rounded">
                  <span className="text-sm">Bear Case</span>
                  <div className="text-right">
                    <p className="font-bold text-error-600">{formatCurrency(data.dcf.scenarios.bear.price)}</p>
                    <p className="text-xs text-muted-foreground">{(data.dcf.scenarios.bear.probability * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Key Drivers & Risks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium mb-2">Key Drivers</p>
                  <ul className="space-y-1">
                    {data.dcf.key_drivers.map((driver, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-success-600 mt-1">•</span>
                        {driver}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Key Risks</p>
                  <ul className="space-y-1">
                    {data.dcf.key_risks.map((risk, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-error-600 mt-1">•</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DCA Tab */}
        <TabsContent value="dca" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DCA Strategy Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{data.dca.recommended_strategy}</p>
                <p className="text-sm text-muted-foreground">Recommended Strategy</p>
              </div>
              
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  <p className="text-lg font-bold">{data.dca.frequency}</p>
                  <p className="text-sm text-muted-foreground">Frequency</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{data.dca.position_size_recommendation}</p>
                  <p className="text-sm text-muted-foreground">Position Size</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold capitalize">{data.dca.risk_level}</p>
                  <p className="text-sm text-muted-foreground">Risk Level</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strategy Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.dca.strategies.map((strategy, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{strategy.name}</p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-bold">{formatPercentage(strategy.total_return)}</p>
                        <p className="text-xs text-muted-foreground">Return</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{strategy.sharpe_ratio.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Sharpe</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{formatPercentage(strategy.max_drawdown)}</p>
                        <p className="text-xs text-muted-foreground">Max DD</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{(strategy.win_rate * 100).toFixed(0)}%</p>
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Key Risks</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {data.overview.keyRisks.map((risk, index) => (
                  <li key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-error-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{risk}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
