# Jowelery Backend (NestJS)

Standalone NestJS REST API — migration of the Next.js API routes to a dedicated backend service.

## Tech Stack

- **Framework**: NestJS 10, TypeScript
- **Database**: MongoDB via Prisma ORM (`prisma/schema.prisma`)
- **Auth**: JWT Bearer token — works for both mobile and web clients
- **Payments**: Adyen (`src/payments/`)
- **Images**: Cloudinary (`src/upload/`)
- **Docs**: Swagger UI at `/docs`
- **Port**: 4000 (dev), configurable via `PORT` env var

## Project Structure

```
src/
  auth/             # Login, register, JWT strategy + guards
  users/            # User CRUD, profile management
  products/         # Product CRUD, price recalculation
  shops/            # Shop management
  orders/           # Order lifecycle
  cart/             # Cart items (upsert by userId+productId)
  wishlist/         # Wishlist items
  gold-rates/       # Gold rate CRUD and history
  payments/         # Adyen payment sessions + webhook
  upload/           # Cloudinary image upload
  system-config/    # Platform config (singleShopMode, paymentMethods)
  analytics/        # Dashboard metrics (orders, revenue, top products)
  address/          # User address book
  prisma/           # PrismaService (global module)
  common/
    decorators/     # @CurrentUser(), @Roles()
    guards/         # RolesGuard
    filters/        # AllExceptionsFilter
    interceptors/   # TransformInterceptor (wraps responses in { data: ... })
```

## Running

```bash
npm install
cp .env.example .env    # fill in your values
npm run db:push         # sync Prisma schema to MongoDB (no migration files)
npm run start:dev       # hot reload dev server on port 4000
npm run build           # production build
npm run start:prod      # run production build
```

## API Base

All routes prefixed with `/api`:
- Auth: `POST /api/auth/login`, `POST /api/auth/register`
- Products: `GET /api/products`, `GET /api/products/:id`
- Orders: `GET /api/orders`, `POST /api/orders`
- Cart: `GET /api/cart`, `POST /api/cart`
- Wishlist: `GET /api/wishlist`, `POST /api/wishlist`
- Gold rates: `GET /api/gold-rates`, `POST /api/gold-rates` (SUPER_ADMIN)
- Analytics: `GET /api/analytics/dashboard` (SHOP_ADMIN+)
- Upload: `POST /api/upload/image`

Swagger docs: `http://localhost:4000/docs`

## Auth Pattern

All protected routes require: `Authorization: Bearer <token>`

Get token from `POST /api/auth/login` → `{ token, user }`.

Role hierarchy: `SUPER_ADMIN (3) > SHOP_ADMIN (2) > CLIENT (1)`

`@Roles('SHOP_ADMIN')` means "SHOP_ADMIN or higher" (RolesGuard uses hierarchy comparison).

## Key Conventions

**Every module** exports a service, controller, and module file. Module is registered in `app.module.ts`.

**PrismaService** is global — inject it directly without importing PrismaModule.

**Response shape**: TransformInterceptor wraps all successful responses as `{ data: ... }`. Errors from AllExceptionsFilter are `{ error: "message" }`.

**Gold pricing rule** (critical — never store a fixed price):
```
finalPrice = (goldRatePerGram × karat_purity × weight) + (makingCharges × weight)
```
Karat purities: K24=1.0, K22=0.9167, K21=0.875, K18=0.75, K14=0.5833

Use `POST /api/products/recalculate` (SUPER_ADMIN) to recalculate all prices after a gold rate update.

## Environment Variables

```
DATABASE_URL=mongodb+srv://...
JWT_SECRET=<min 32 chars>
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ADYEN_API_KEY=
ADYEN_MERCHANT_ACCOUNT=
ADYEN_CLIENT_KEY=
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## Seeded Test Accounts

After running `npm run db:seed` (copy seed.ts from `../jowelery/prisma/seed.ts`):

| Email | Password | Role |
|-------|----------|------|
| admin@jowelery.com | admin123 | SUPER_ADMIN |
| shop1@jowelery.com | shop123 | SHOP_ADMIN |
| client@jowelery.com | base123 | CLIENT |

## Deployment

This service can be deployed to:
- **Railway / Render** — connect GitHub repo, set env vars, auto-deploy on push
- **Docker** — `docker build -t jowelery-backend . && docker run -p 4000:4000 jowelery-backend`
- **Vercel** (not recommended — NestJS is not serverless-friendly, prefer Railway)
