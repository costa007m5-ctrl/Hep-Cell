# Relp Cell - Payment System

## Overview
Relp Cell is a comprehensive payment and credit management system built with React, TypeScript, and Vite. The application allows users to manage invoices, make purchases, and handle credit analysis. It features integration with MercadoPago for payments, Supabase for backend services, and Google Gemini AI for credit analysis.

## Project Architecture

### Frontend
- **Framework**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 7.2.4
- **Styling**: TailwindCSS (via CDN)
- **State Management**: React hooks and Supabase client
- **PWA**: Service Worker with offline support

### Backend (Vercel Serverless Functions)
Located in `/api` directory:
- `admin.ts` - Admin dashboard and credit analysis
- `mercadopago.ts` - Payment processing
- `products.ts` - Product management
- `ml-item.ts` - Mercado Livre integration
- `shopee.ts` - Shopee integration
- `cron.ts` - Scheduled tasks

### Key Services
- **Supabase**: Database and authentication
- **Google Gemini AI**: Credit analysis and AI features
- **MercadoPago**: Payment processing
- **Mercado Livre**: Product listings
- **Shopee**: E-commerce integration

## Current State
- ✅ Frontend configured to run on port 5000 with Replit proxy support
- ✅ Dependencies installed
- ✅ Vite configured with HMR for Replit environment
- ✅ Workflow configured for development server
- ⚠️ Backend API functions require Vercel environment (not running locally)

## Environment Variables Required

### Frontend (Public - already in code)
- `NEXT_PUBLIC_SUPABASE_URL`: Already hardcoded in src/services/clients.ts
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Already hardcoded in src/services/clients.ts

### Backend (API Functions - for Vercel deployment)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (admin access)
- `API_KEY`: Google Gemini API key
- `MERCADO_PAGO_ACCESS_TOKEN`: MercadoPago access token
- `ML_CLIENT_ID`: Mercado Livre client ID
- `ML_CLIENT_SECRET`: Mercado Livre client secret

**Note**: The backend API functions are designed for Vercel serverless environment. In Replit, only the frontend will run. To use backend features, deploy to Vercel or adapt the API functions to run as a Node.js server.

## Development

### Running the Application
The frontend development server is configured to run automatically via the "Frontend Server" workflow on port 5000.

### Project Structure
```
/src                    - React application source
  /components          - React components
    /store            - Store-specific components
  /services           - Service clients (Supabase, etc.)
  App.tsx             - Main app component
  main.tsx            - Entry point
/api                   - Vercel serverless functions
/public                - Static assets
/components            - Legacy components (some duplicates)
/services              - Legacy services (some duplicates)
```

### Known Issues
- Some duplicate files exist in root `/components` and `/services` vs `/src/components` and `/src/services`
- API functions require Vercel deployment to work properly
- Some npm vulnerabilities present (can be addressed with `npm audit fix`)

## Recent Changes
- **2024-11-24**: Configured for Replit environment
  - Updated vite.config.ts to bind to 0.0.0.0:5000
  - Added HMR configuration for Replit proxy
  - Set up workflow for frontend server
  - Created project documentation

## User Preferences
Not yet established.

## Next Steps
1. Consider deploying to Vercel for backend API functionality
2. Set up environment variables for backend features
3. Address npm security vulnerabilities
4. Clean up duplicate files in project structure
5. Consider migrating API functions to a dedicated Express server for Replit compatibility
