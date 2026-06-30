# JoyeriaApp — Esqueleto inicial

Sistema de gestión para Río Rayo (costeo, inventario, ventas con comisión,
producción/maquila, CRM y KPIs), construido con la misma arquitectura
probada en FinanzasApp: Node/Express/GraphQL/Prisma/PostgreSQL en el
backend y React/Vite/Apollo Client en el frontend.

## Estado actual

Esto es solo el esqueleto: carpetas, configuración y boilerplate mínimo
para que el proyecto arranque. **No incluye todavía los modelos de
dominio** (Producto, OrdenProduccion, Joyero, Cliente, Venta, etc.) —
esos se agregan en la siguiente fase a `backend/prisma/schema.prisma`.

## Primeros pasos

```bash
# Backend
cd backend
cp .env.example .env   # completar DATABASE_URL y demas variables
npm install
npm run prisma:generate
npm run dev

# Frontend (en otra terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Convención de carpetas (igual que FinanzasApp)

- `backend/prisma` — schema y migraciones
- `backend/src/schema` y `backend/src/resolvers` — GraphQL
- `backend/src/routes` — endpoints REST (auth, webhooks)
- `backend/src/helpers` — acceso a datos (Prisma client)
- `backend/src/utils` — utilidades (correo, PDF, etc.)
- `backend/src/PostGresql` — scripts SQL directos (DBeaver), fuera de Prisma
- `frontend/src/modules/pages` — vistas
- `frontend/src/modules/utils` — utilidades de frontend (ej. `buildInput.js`)
- `frontend/src/graphql` — queries y mutations

## Próximo paso

Definir `schema.prisma` con los modelos de dominio acordados y poblar
`resolvers/` y `modules/pages/` con el primer módulo (Inventario & Costeo).
