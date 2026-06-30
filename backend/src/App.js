// backend/src/App.js
import "dotenv/config";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { prisma } from "./helpers/dbActions.js";

// ---------- Rutas REST ----------
import authRouter from "./routes/auth.js";

// ---------- TypeDefs por módulo ----------
import empresaTypeDefs from "./schema/empresa.typeDefs.js";
import catalogoTypeDefs from "./schema/catalogo.typeDefs.js";
import subcatalogoTypeDefs from "./schema/subcatalogo.typeDefs.js";
import grupoTypeDefs from "./schema/grupo.typeDefs.js";
import usuarioTypeDefs from "./schema/usuario.typeDefs.js";
// A medida que construyamos cada módulo nuevo (Producto, OrdenProduccion,
// Cliente, Venta...) se agrega aquí su propio archivo de typeDefs.

// ---------- Resolvers por módulo ----------
import empresaResolvers from "./resolvers/empresa.resolvers.js";
import catalogoResolvers from "./resolvers/catalogo.resolvers.js";
import subcatalogoResolvers from "./resolvers/subcatalogo.resolvers.js";
import grupoResolvers from "./resolvers/grupo.resolvers.js";
import usuarioResolvers from "./resolvers/usuario.resolvers.js";

// --- Sentry (opcional) ---
// JoyeriaApp necesita su PROPIO proyecto en Sentry — no reutilizar el DSN
// de FinanzasApp, o los errores de ambos sistemas se mezclarían en el
// mismo dashboard. Cuando tenga el DSN de Joyería, descomente este bloque:
//
// import * as Sentry from '@sentry/node';
// Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/auth", authRouter);

// ---------- GraphQL ----------
const rootSDL = /* GraphQL */ `
  type Query
`;

const typeDefs = mergeTypeDefs([
  rootSDL,
  empresaTypeDefs,
  catalogoTypeDefs,
  subcatalogoTypeDefs,
  grupoTypeDefs,
  usuarioTypeDefs,
]);

const resolvers = mergeResolvers([
  empresaResolvers,
  catalogoResolvers,
  subcatalogoResolvers,
  grupoResolvers,
  usuarioResolvers,
]);

async function startServer() {
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: false,
    plugins: [ApolloServerPluginLandingPageLocalDefault()],
    formatError(err) {
      console.error("💥 GQL formatError:", {
        message: err.message,
        path: err.path,
        extensions: err.extensions,
      });
      return err;
    },
  });

  await apolloServer.start();

  app.use(
    "/graphql",
    cors(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        const authHeader = req.headers.authorization || "";
        let user = null;

        if (authHeader.startsWith("Bearer ")) {
          const token = authHeader.slice(7);
          try {
            user = jwt.verify(
              token,
              process.env.JWT_SECRET || "dev_secret_cambia_esto",
            );
          } catch (e) {
            console.log("❌ TOKEN INVÁLIDO:", e.message);
            throw new Error("UNAUTHENTICATED");
          }
        }

        return { prisma, user };
      },
    }),
  );

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 JoyeriaApp backend en http://localhost:${PORT}`);
    console.log(`📡 GraphQL disponible en http://localhost:${PORT}/graphql`);
  });

  const shutdown = async (signal) => {
    console.log(`\n🛑 Señal recibida: ${signal}. Cerrando servidor...`);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer();
