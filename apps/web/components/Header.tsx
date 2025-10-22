'use client';

import { Settings, HelpCircle, Menu } from 'lucide-react';
import { AppMode } from '@/lib/types';

interface HeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onMenuClick?: () => void;
}

export default function Header({ mode, onModeChange, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Logo and Menu */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold">Stock Analysis AI</h1>
              {mode === 'screener' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Advanced Screener</p>
              )}
            </div>
          </div>
        </div>

        {/* Center: Mode indicator (on mobile) */}
        <div className="sm:hidden">
          {mode === 'chat' && <span className="text-sm text-gray-500">Chat</span>}
          {mode === 'screener' && <span className="text-sm text-gray-500">Screener</span>}
          {mode === 'analysis' && <span className="text-sm text-gray-500">Analysis</span>}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {mode === 'screener' && (
            <button
              onClick={() => onModeChange('chat')}
              className="px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              💬 Return to Chat
            </button>
          )}
          
          {mode !== 'screener' && (
            <button
              onClick={() => onModeChange('screener')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Advanced Screener"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}
          
          <button
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

