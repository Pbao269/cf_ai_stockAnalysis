'use client';

import { Settings, HelpCircle, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppMode } from '@/lib/types';

interface HeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onMenuClick?: () => void;
}

export default function Header({ mode, onModeChange, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Logo and Menu */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold">Stock Analysis AI</h1>
              {mode === 'screener' && (
                <Badge variant="secondary" className="text-xs">
                  Advanced Screener
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Center: Mode indicator (on mobile) */}
        <div className="sm:hidden">
          <Badge variant="outline">
            {mode === 'chat' && 'Chat'}
            {mode === 'screener' && 'Screener'}
            {mode === 'analysis' && 'Analysis'}
          </Badge>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {mode === 'screener' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onModeChange('chat')}
              className="gap-2"
            >
              💬 Return to Chat
            </Button>
          )}
          
          {mode !== 'screener' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onModeChange('screener')}
              aria-label="Advanced Screener"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

