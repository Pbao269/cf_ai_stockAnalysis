# Stock Analysis AI - Frontend

A modern, responsive React/Next.js frontend for the Stock Analysis AI platform.

## Features

- **Chatbot-First Interface**: Natural language input for stock analysis
- **Real-time Analysis**: Live streaming of analysis results
- **Advanced Screener**: Finviz-style stock filtering and screening
- **Comprehensive Analysis**: DCF valuation, technical analysis, DCA strategies
- **Responsive Design**: Mobile-first approach with smooth animations
- **Modern UI**: Built with ShadCN UI components and Tailwind CSS

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + ShadCN UI
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **State Management**: React hooks

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start development server:
   ```bash
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
apps/web/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # ShadCN UI components
│   ├── Header.tsx        # App header
│   ├── ChatInterface.tsx # Chat interface
│   ├── ScreenerResults.tsx # Stock screener results
│   └── StockAnalysis.tsx # Detailed stock analysis
├── lib/                  # Utilities and types
│   ├── types.ts          # TypeScript type definitions
│   ├── utils.ts          # Utility functions
│   ├── mockData.ts       # Mock data for development
│   └── api.ts            # API integration layer
└── public/               # Static assets
```

## API Integration

The frontend is designed to integrate with the backend API gateway. Currently using mock data for development.

### API Endpoints (TODO: Wire up)

- `POST /intent` - Parse natural language queries
- `POST /screen` - Screen stocks based on filters
- `GET /analyze?ticker={symbol}` - Analyze specific stock (SSE stream)
- `POST /watchlist` - Manage user watchlists
- `GET /healthz` - Health check

### Mock Data

The application currently uses mock data for:
- Stock screener results
- Detailed stock analysis
- DCF valuations
- Technical indicators
- DCA strategy analysis

## Design System

Built with ShadCN UI components and custom Tailwind CSS configuration:

- **Colors**: Primary, success, warning, error variants
- **Components**: Button, Card, Input, Badge, Tabs
- **Animations**: Smooth transitions and micro-interactions
- **Responsive**: Mobile-first design with breakpoints

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Tailwind CSS for styling

## Deployment

The application can be deployed to any platform that supports Next.js:

- Vercel (recommended)
- Netlify
- AWS Amplify
- Self-hosted

## Contributing

1. Follow the existing code style
2. Use TypeScript for all new code
3. Add proper error handling
4. Test on multiple screen sizes
5. Ensure accessibility compliance

## License

Private - Stock Analysis AI Platform
