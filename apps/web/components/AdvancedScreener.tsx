'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScreenerFilters } from '@/lib/types';

interface AdvancedScreenerProps {
  onBack: () => void;
  onSearch: (filters: ScreenerFilters) => void;
  isLoading?: boolean;
}

export default function AdvancedScreener({ onBack, onSearch, isLoading = false }: AdvancedScreenerProps) {
  const [filters, setFilters] = useState<ScreenerFilters>({
    sectors: [],
    market_cap_preference: undefined,
    pe_ratio: { min: undefined, max: undefined },
    pb_ratio: { min: undefined, max: undefined },
    dividend_yield: { min: undefined, max: undefined },
    price: { min: undefined, max: undefined },
    revenue_growth: { min: undefined },
    strategy: undefined,
  });

  const sectors = [
    'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
    'Consumer Defensive', 'Energy', 'Industrials', 'Communication Services',
    'Utilities', 'Real Estate', 'Basic Materials'
  ];

  const strategies = [
    { value: 'growth', label: 'Growth' },
    { value: 'value', label: 'Value' },
    { value: 'income', label: 'Income' },
    { value: 'momentum', label: 'Momentum' },
    { value: 'balanced', label: 'Balanced' },
  ];

  const marketCapOptions = [
    { value: 'small', label: 'Small Cap (<$2B)' },
    { value: 'mid', label: 'Mid Cap ($2B-$10B)' },
    { value: 'large', label: 'Large Cap ($10B-$200B)' },
    { value: 'mega', label: 'Mega Cap (>$200B)' },
  ];

  const handleSectorToggle = (sector: string) => {
    setFilters(prev => ({
      ...prev,
      sectors: prev.sectors?.includes(sector)
        ? prev.sectors.filter(s => s !== sector)
        : [...(prev.sectors || []), sector]
    }));
  };

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleReset = () => {
    setFilters({
      sectors: [],
      market_cap_preference: undefined,
      pe_ratio: { min: undefined, max: undefined },
      pb_ratio: { min: undefined, max: undefined },
      dividend_yield: { min: undefined, max: undefined },
      price: { min: undefined, max: undefined },
      revenue_growth: { min: undefined },
      strategy: undefined,
    });
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
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Filter className="h-6 w-6" />
              Advanced Stock Screener
            </h1>
            <p className="text-muted-foreground">
              Filter stocks using advanced criteria
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleSearch} disabled={isLoading}>
            <Search className="h-4 w-4 mr-2" />
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Filters Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Strategy */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Investment Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {strategies.map((strategy) => (
                <Button
                  key={strategy.value}
                  variant={filters.strategy === strategy.value ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    strategy: prev.strategy === strategy.value ? undefined : strategy.value as any
                  }))}
                >
                  {strategy.label}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Sectors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sectors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {sectors.map((sector) => (
                  <Badge
                    key={sector}
                    variant={filters.sectors?.includes(sector) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => handleSectorToggle(sector)}
                  >
                    {sector}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Market Cap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Market Cap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {marketCapOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={filters.market_cap_preference === option.value ? 'default' : 'outline'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    market_cap_preference: prev.market_cap_preference === option.value ? undefined : option.value as any
                  }))}
                >
                  {option.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Advanced Filters */}
        <div className="lg:col-span-2 space-y-6">
          {/* Valuation Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Valuation Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">P/E Ratio</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.pe_ratio?.min || ''}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        pe_ratio: { ...prev.pe_ratio, min: e.target.value ? Number(e.target.value) : undefined }
                      }))}
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.pe_ratio?.max || ''}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        pe_ratio: { ...prev.pe_ratio, max: e.target.value ? Number(e.target.value) : undefined }
                      }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">P/B Ratio</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.pb_ratio?.min || ''}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        pb_ratio: { ...prev.pb_ratio, min: e.target.value ? Number(e.target.value) : undefined }
                      }))}
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.pb_ratio?.max || ''}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        pb_ratio: { ...prev.pb_ratio, max: e.target.value ? Number(e.target.value) : undefined }
                      }))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price & Growth */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Price & Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Stock Price</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min Price"
                      value={filters.price?.min || ''}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        price: { ...prev.price, min: e.target.value ? Number(e.target.value) : undefined }
                      }))}
                    />
                    <Input
                      type="number"
                      placeholder="Max Price"
                      value={filters.price?.max || ''}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        price: { ...prev.price, max: e.target.value ? Number(e.target.value) : undefined }
                      }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Revenue Growth (%)</label>
                  <Input
                    type="number"
                    placeholder="Min Growth"
                    value={filters.revenue_growth?.min || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      revenue_growth: { min: e.target.value ? Number(e.target.value) : undefined }
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dividend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dividend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dividend Yield (%)</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min Yield"
                    value={filters.dividend_yield?.min || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dividend_yield: { ...prev.dividend_yield, min: e.target.value ? Number(e.target.value) : undefined }
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Max Yield"
                    value={filters.dividend_yield?.max || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dividend_yield: { ...prev.dividend_yield, max: e.target.value ? Number(e.target.value) : undefined }
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Filters Summary */}
      {(filters.sectors?.length || filters.strategy || filters.market_cap_preference) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {filters.strategy && (
                <Badge variant="secondary">
                  Strategy: {strategies.find(s => s.value === filters.strategy)?.label}
                </Badge>
              )}
              {filters.market_cap_preference && (
                <Badge variant="secondary">
                  Market Cap: {marketCapOptions.find(m => m.value === filters.market_cap_preference)?.label}
                </Badge>
              )}
              {filters.sectors?.map(sector => (
                <Badge key={sector} variant="secondary">
                  {sector}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
