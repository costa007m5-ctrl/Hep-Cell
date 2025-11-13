# Overview

Relp Cell Pagamentos is a modern Progressive Web Application (PWA) for managing invoice payments and an integrated store system for Relp Cell customers. The application provides a customer-facing interface for viewing and paying invoices (via Pix or Boleto), tracking credit scores, managing profiles, and browsing products. It also includes a comprehensive admin dashboard for managing clients, processing sales, viewing financial metrics, and monitoring system health.

The application is built with React and TypeScript, uses Supabase for authentication and database management, integrates Mercado Pago for payment processing, and leverages Google's Gemini AI for generating personalized payment confirmations and performing credit analysis.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes (November 2025)

## PWA Implementation
- **Service Worker**: Configured with vite-plugin-pwa using dynamic import to avoid circular references
- **Manifest**: Complete PWA manifest with icons, theme colors, and display mode
- **Offline Support**: Workbox caching strategies for APIs (Supabase, MercadoPago, Gemini)
- **Install Prompt**: Custom PWAInstallPrompt component integrated in App.tsx
- **Update Flow**: Automatic service worker updates with user confirmation dialog
- **Registration**: Service worker successfully registered with proper lifecycle management

## Product Import Features
- **MercadoLivre Integration**: OAuth2-authenticated API for importing products via MLB codes
- **Shopee Integration**: Public API v4 for extracting product data from Shopee URLs
- **Admin Interface**: ProductsTab includes forms for importing from both platforms

## Payment System
- All payment methods (PIX, Boleto, Credit Card) verified and functional
- MercadoPago webhook integration operational
- AI-powered payment confirmations working correctly

# System Architecture

## Frontend Architecture

**Framework**: React 19 with TypeScript, bundled using Vite
- **State Management**: React hooks (useState, useEffect, useCallback, useMemo) for local state
- **Routing**: Tab-based navigation using an enum system (no traditional router)
- **Styling**: TailwindCSS via CDN with custom theme extensions for animations
- **PWA Features**: Service worker with Workbox for offline caching, manifest.json for installability
- **Component Structure**: 
  - Modular, reusable components in `/components` and `/src/components`
  - Separation of concerns between customer views and admin views
  - Shared UI components (Alert, LoadingSpinner, InputField, Modal)

**Key Design Decisions**:
- **Tab Navigation**: Uses an enum-based tab system (Tab.INICIO, Tab.FATURAS, Tab.LOJA, Tab.PERFIL) instead of URL-based routing for a more app-like experience
- **View Switching**: Admin and customer interfaces are separate views within the same app, controlled by authentication state
- **Progressive Enhancement**: Core functionality works without JavaScript, enhanced with animations and interactivity when available

## Backend Architecture

**API Layer**: Serverless functions deployed on Vercel
- **Server Files**:
  - `/server.ts`: Development Express server for local testing
  - `/api/*.ts`: Vercel serverless functions for production
- **API Endpoints**:
  - `/api/config`: Provides frontend configuration (Supabase URLs, Mercado Pago public key)
  - `/api/mercadopago`: Handles payment webhooks and preference creation
  - `/api/admin`: Admin operations (credit analysis, user management, logs)
  - `/api/products`: Product catalog management
  - `/api/ml-item`: Mercado Livre API integration for product data
  - `/api/shopee`: Shopee API integration for product scraping

**Authentication & Authorization**:
- Supabase Auth handles user authentication
- Row-Level Security (RLS) policies in Supabase for data access control
- Hardcoded admin user ID (`1da77e27-f1df-4e35-bcec-51dc2c5a9062`) for admin access
- Separate login flows for customers and administrators

**Data Models** (from `/src/types.ts`):
- **Invoice**: Tracks customer invoices with status (Paga, Em aberto, Boleto Gerado, etc.)
- **Profile**: Extended user profile with billing info, credit score, credit limit
- **Product**: Store inventory with pricing, images, categories
- **ActionLog**: System activity logging for admin monitoring

**Business Logic**:
- **Credit Analysis**: AI-powered (Gemini) credit scoring based on payment history
- **Early Payment Discounts**: Dynamic discount calculation (up to 15% for 30+ days early)
- **Payment Processing**: Multi-method support (Pix, Boleto, Credit Card via Mercado Pago)
- **Invoice Generation**: Automated boleto creation with barcode and PDF support

## Database Architecture

**Primary Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with email/password
- **Tables**:
  - `profiles`: User profile data including credit information
  - `invoices`: Invoice records with payment tracking
  - `products`: Store product catalog
  - `action_logs`: System activity audit trail
- **Security**: Row-Level Security (RLS) policies enforce data isolation
- **Triggers**: Database functions like `handle_new_user_creation` for automated profile setup

**Client Initialization**:
- Centralized in `/services/clients.ts`
- Fetches configuration from `/api/config` to avoid exposing secrets in frontend
- Lazy initialization pattern to ensure configuration is loaded before use

## Payment Integration

**Mercado Pago**:
- **Public Key**: Exposed in frontend for SDK initialization
- **Access Token**: Server-side only for API calls
- **Payment Methods**:
  - **Pix**: QR code generation and real-time status checking
  - **Boleto**: PDF generation with barcode and payment instructions
  - **Credit Card**: Checkout Pro integration with redirect flow
- **Webhook Handling**: `/api/mercadopago` processes payment notifications and updates invoice status

**Payment Flow**:
1. Customer selects invoice and payment method
2. Preference created via `/api/mercadopago/create-preference`
3. Payment processed through Mercado Pago SDK or redirect
4. Webhook updates invoice status in database
5. AI-generated confirmation message displayed to customer

## AI Integration

**Google Gemini AI**:
- **Model**: gemini-2.5-flash
- **Use Cases**:
  - Payment confirmation message generation (personalized thank-you messages)
  - Credit analysis (scoring based on payment history)
  - Database error diagnosis (developer tool for troubleshooting)
- **API Key**: Server-side only, accessed via environment variable `API_KEY`
- **Service Layer**: `/services/geminiService.ts` provides reusable AI functions

# External Dependencies

## Third-Party Services

**Supabase** (Authentication & Database):
- **Environment Variables**: 
  - `NEXT_PUBLIC_SUPABASE_URL`: Public Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anonymous key (safe for frontend)
  - `SUPABASE_SERVICE_ROLE_KEY`: Admin key (server-side only)
- **SDK**: `@supabase/supabase-js` v2.80.0
- **Features Used**: Auth, Database, RLS policies, Real-time subscriptions

**Mercado Pago** (Payment Processing):
- **Environment Variables**:
  - `MERCADO_PAGO_ACCESS_TOKEN`: Private access token (server-side)
  - `MERCADO_PAGO_PUBLIC_KEY`: Public key for frontend SDK (TEST key in code)
- **SDK**: `mercadopago` v2.10.0 (Node.js), SDK v2 (browser via CDN)
- **Integration**: Checkout Pro, Pix, Boleto generation

**Google Gemini AI** (Generative AI):
- **Environment Variables**: `API_KEY` (formerly `GEMINI_API_KEY`)
- **SDK**: `@google/genai` v1.29.0
- **Rate Limiting**: Not implemented, relies on Google's quotas

**Mercado Livre API** (Product Integration):
- **Environment Variables**: 
  - `ML_CLIENT_ID`: OAuth client ID
  - `ML_CLIENT_SECRET`: OAuth client secret
- **Purpose**: Fetch product data for store catalog

**Shopee API** (Product Scraping):
- **No Authentication Required**: Uses public API endpoints
- **Purpose**: Extract product information from Shopee links

## CDN-Loaded Libraries

- **Tailwind CSS**: `https://cdn.tailwindcss.com`
- **Mercado Pago SDK**: `https://sdk.mercadopago.com/js/v2`
- **React/React-DOM**: Via aistudiocdn.com (ES modules via importmap)

## Development Tools

- **Vite**: Build tool and dev server (v7.2.2)
- **TypeScript**: Type safety (v5.4.5)
- **tsx**: TypeScript execution for server (v4.20.6)
- **concurrently**: Parallel script execution (dev server + Vite)
- **vite-plugin-pwa**: PWA manifest and service worker generation

## Deployment Platform

**Vercel**:
- **Serverless Functions**: All `/api/*.ts` files deployed as serverless functions
- **Static Hosting**: Frontend built with Vite, served as static assets
- **Configuration**: `vercel.json` defines function memory limits and URL rewrites
- **Environment Variables**: Managed through Vercel dashboard