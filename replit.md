# Relp Cell - Payment Management App

## Overview
This is a Progressive Web App (PWA) for managing invoices, credit limits, and purchases at Relp Cell. Built with React, TypeScript, Vite, and integrates with Supabase for authentication/database, Gemini AI for intelligent features, and Mercado Pago for payments.

## Project Structure
- **Frontend**: React + TypeScript + Vite application in `/src`
- **Backend APIs**: Serverless functions in `/api` folder (designed for Vercel deployment - not required for basic app functionality)
- **Services**: Supabase (auth/database), Gemini AI, Mercado Pago

## Recent Changes
- **2025-11-22**: Initial Replit setup
  - Configured Vite to bind to 0.0.0.0:5000 for Replit environment
  - Installed Node.js dependencies with npm
  - Set up workflow "Start application" for development server
  - Fixed Supabase auth event handling for TOKEN_REFRESHED
  - Configured deployment as static site with `dist` output directory

## Getting Started in Replit

### Prerequisites
- Node.js 20 (already installed via Replit modules)
- Dependencies installed via `npm install` (already done)

### Running the Application
1. The workflow "Start application" is configured to run `npm run dev`
2. It automatically starts when you open the Repl
3. The dev server binds to 0.0.0.0:5000 for Replit's web preview
4. Access the app through the Replit webview

### Monitoring the Application
- Check workflow logs in the Replit interface or use the logs panel
- Browser console logs are available in the webview developer tools
- The workflow status shows if the server is running correctly

### Building for Production
- Run `npm run build` to create production build
- Output goes to `dist/` directory
- Deployment is configured as static site

## Configuration

### Development Server
- **Host**: 0.0.0.0 (required for Replit webview)
- **Port**: 5000 (required for Replit webview)
- **HMR**: Configured with clientPort 5000

### Frontend Credentials (Safe - Already Configured)
- **Supabase**: Public URL and anon key hardcoded in `src/services/clients.ts`
- **Mercado Pago**: Public test key hardcoded in `src/App.tsx`

### Environment Variables for Backend APIs (Optional)
The frontend PWA works without these. Only needed if deploying backend API functions:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (admin/server access)
- `MERCADO_PAGO_ACCESS_TOKEN`: Mercado Pago private access token
- `API_KEY`: Gemini API key for AI-powered features
- `ML_CLIENT_ID`: Mercado Livre client ID
- `ML_CLIENT_SECRET`: Mercado Livre client secret

**Setting Environment Variables in Replit:**
1. Open the "Secrets" tab in Replit
2. Add each key-value pair
3. Backend APIs in `/api` folder are Vercel serverless functions and won't run in Replit without additional setup

## Deployment

### Replit Deployment (Configured)
- **Type**: Static site
- **Build Command**: `npm run build`
- **Public Directory**: `dist`
- **Configuration File**: `.replit` (lines 40-43 contain deployment settings)
- **Note**: Only the frontend PWA is deployed. Backend APIs (`/api` folder) are excluded and designed for Vercel.

### Vercel Deployment (Original Platform)
- Backend APIs are designed as Vercel serverless functions
- See `vercel.json` for routing and function configuration
- Requires all environment variables listed above

## Technology Stack
- React 19.2.0
- TypeScript 5.4.5
- Vite 7.2.2
- Tailwind CSS (via CDN)
- Supabase (auth & database)
- Mercado Pago SDK
- Gemini AI
- Service Worker (PWA support)

## Troubleshooting

### Workflow Won't Start
- Check that Node.js is installed
- Run `npm install` to ensure dependencies are present
- Check workflow logs for error messages

### Can't See Changes
- Vite has HMR enabled - changes should auto-reload
- Try a hard refresh in the browser
- Check that the workflow is running

### TypeScript Errors
- LSP diagnostics are available in the editor
- Run `npm run build` to see all TypeScript errors
- Most errors won't prevent the dev server from running
