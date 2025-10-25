// Watchlist Module - Isolated for Future Use
// This module contains watchlist functionality that can be integrated later
// when database functionality is needed.

export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: Date;
  notes?: string;
}

export interface Watchlist {
  id: string;
  name: string;
  userId: string;
  items: WatchlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

// Future API functions for watchlist management
export interface WatchlistAPI {
  getWatchlist(userId: string): Promise<Watchlist[]>;
  addToWatchlist(userId: string, symbol: string, watchlistId?: string): Promise<void>;
  removeFromWatchlist(userId: string, symbol: string, watchlistId?: string): Promise<void>;
  createWatchlist(userId: string, name: string): Promise<Watchlist>;
  deleteWatchlist(userId: string, watchlistId: string): Promise<void>;
  updateWatchlistItem(userId: string, watchlistId: string, symbol: string, updates: Partial<WatchlistItem>): Promise<void>;
}

// Mock implementation for future use
export class MockWatchlistAPI implements WatchlistAPI {
  async getWatchlist(userId: string): Promise<Watchlist[]> {
    // Mock implementation
    return [];
  }

  async addToWatchlist(userId: string, symbol: string, watchlistId?: string): Promise<void> {
    // Mock implementation
  }

  async removeFromWatchlist(userId: string, symbol: string, watchlistId?: string): Promise<void> {
    // Mock implementation
  }

  async createWatchlist(userId: string, name: string): Promise<Watchlist> {
    // Mock implementation
    return {
      id: 'mock-id',
      name,
      userId,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async deleteWatchlist(userId: string, watchlistId: string): Promise<void> {
    // Mock implementation
  }

  async updateWatchlistItem(userId: string, watchlistId: string, symbol: string, updates: Partial<WatchlistItem>): Promise<void> {
    // Mock implementation
  }
}

// Export for future use
export const watchlistAPI = new MockWatchlistAPI();
