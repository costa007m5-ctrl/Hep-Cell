# Relp Cell - Payment Management App

## Overview
This is a Progressive Web App (PWA) for managing invoices, credit limits, and purchases at Relp Cell. Built with React, TypeScript, Vite, and integrates with Supabase for authentication/database, Gemini AI for intelligent features, and Mercado Pago for payments.

## Project Structure
- **Frontend**: React + TypeScript + Vite application in `/src`
- **Backend APIs**: Serverless functions in `/api` folder (designed for Vercel deployment)
- **Services**: Supabase (auth/database), Gemini AI, Mercado Pago

## Recent Changes
- **2025-11-22**: Initial Replit setup
  - Configured Vite to bind to 0.0.0.0:5000 for Replit environment
  - Installed dependencies
  - Set up workflow for development server

## Configuration
- **Dev Server**: Runs on port 5000 (0.0.0.0:5000)
- **Supabase**: Credentials are hardcoded in `src/services/clients.ts` (public anon key is safe for frontend)
- **Mercado Pago**: Public key is hardcoded in `src/App.tsx`

## Environment Variables Needed
The following environment variables are required for full functionality:

### Backend APIs (optional - app works without them)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (admin access)
- `MERCADO_PAGO_ACCESS_TOKEN`: Mercado Pago access token for backend
- `API_KEY`: Gemini API key for AI features
- `ML_CLIENT_ID`: Mercado Livre client ID
- `ML_CLIENT_SECRET`: Mercado Livre client secret

Note: Backend APIs are serverless functions designed for Vercel. The frontend PWA works independently for viewing and authentication.

## Development
- Run: `npm run dev` (configured in workflow)
- Build: `npm run build`

## Technology Stack
- React 19.2.0
- TypeScript 5.4.5
- Vite 7.2.2
- Tailwind CSS (via CDN)
- Supabase (auth & database)
- Mercado Pago SDK
- Gemini AI
- Service Worker (PWA support)
