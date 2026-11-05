# StudioSpace API (server)

Express + MongoDB backend for StudioSpace.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env`, then add your MongoDB Atlas URI and a JWT secret (same value as the client).
3. `npm run seed` (optional demo studios), then `npm run dev`.

## Endpoints
| Method | Route | Auth |
|---|---|---|
| GET | /api/studios?category=&search=&sort=&limit= | public |
| GET | /api/studios/:id | public |
| GET | /api/studios/mine | cookie JWT |
| POST / PUT / DELETE | /api/studios, /api/studios/:id | cookie JWT (owner) |
| POST | /api/bookings (rejects overlaps with Confirmed bookings, 409) | cookie JWT |
| GET | /api/bookings/mine, /api/bookings/incoming | cookie JWT |
| PATCH | /api/bookings/:id (Pending to Confirmed, Completed, Cancelled) | cookie JWT |

The JWT lives in an HTTPOnly cookie named `ss_token`, issued by the Next.js client after Better Auth login. Missing or invalid tokens get `401`.
