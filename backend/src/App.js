import "dotenv/config";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { prisma } from "./helpers/dbActions.js";
import authRouter from "./routes/auth.js";

import sharedTypeDefs from "./schema/shared.typeDefs.js";
import empresaTypeDefs from "./schema/empresa.typeDefs.js";
import catalogoTypeDefs from "./schema/catalogo.typeDefs.js";
import subcatalogoTypeDefs from "./schema/subcatalogo.typeDefs.js";
import grupoTypeDefs from "./schema/grupo.typeDefs.js";
import usuarioTypeDefs from "./schema/usuario.typeDefs.js";
import usuarioEmpresaTypeDefs from "./schema/usuarioEmpresa.typeDefs.js";
import terceroTypeDefs from "./schema/tercero.typeDefs.js";
import productoTypeDefs from "./schema/producto.typeDefs.js";
import piedraTypeDefs from "./schema/piedra.typeDefs.js";
import compraInsumoTypeDefs from "./schema/compraInsumo.typeDefs.js";
import ordenProduccionTypeDefs from "./schema/ordenProduccion.typeDefs.js";
import ventaTypeDefs from "./schema/venta.typeDefs.js";
import conversacionTypeDefs from "./schema/conversacion.typeDefs.js";
import dashboardTypeDefs from "./schema/dashboard.typeDefs.js";
import muestrarioTypeDefs from "./schema/muestrario.typeDefs.js";
import metaMensualTypeDefs from "./schema/metaMensual.typeDefs.js";
import cotizacionTypeDefs from "./schema/cotizacion.typeDefs.js";

import empresaResolvers from "./resolvers/empresa.resolvers.js";
import catalogoResolvers from "./resolvers/catalogo.resolvers.js";
import subcatalogoResolvers from "./resolvers/subcatalogo.resolvers.js";
import grupoResolvers from "./resolvers/grupo.resolvers.js";
import usuarioResolvers from "./resolvers/usuario.resolvers.js";
import usuarioEmpresaResolvers from "./resolvers/usuarioEmpresa.resolvers.js";
import terceroResolvers from "./resolvers/tercero.resolvers.js";
import productoResolvers from "./resolvers/producto.resolvers.js";
import piedraResolvers from "./resolvers/piedra.resolvers.js";
import compraInsumoResolvers from "./resolvers/compraInsumo.resolvers.js";
import ordenProduccionResolvers from "./resolvers/ordenProduccion.resolvers.js";
import ventaResolvers from "./resolvers/venta.resolvers.js";
import conversacionResolvers from "./resolvers/conversacion.resolvers.js";
import dashboardResolvers from "./resolvers/dashboard.resolvers.js";
import muestrarioResolvers from "./resolvers/muestrario.resolvers.js";
import metaMensualResolvers from "./resolvers/metaMensual.resolvers.js";
import cotizacionResolvers from "./resolvers/cotizacion.resolvers.js";
import perfilResolvers from "./resolvers/perfil.resolvers.js";

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://observant-success-production-90d3.up.railway.app",
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/auth", authRouter);

const rootSDL = /* GraphQL */ `
  type Query
  type Mutation
`;

const typeDefs = mergeTypeDefs([
  rootSDL,
  sharedTypeDefs,
  empresaTypeDefs,
  catalogoTypeDefs,
  subcatalogoTypeDefs,
  grupoTypeDefs,
  usuarioTypeDefs,
  usuarioEmpresaTypeDefs,
  terceroTypeDefs,
  productoTypeDefs,
  piedraTypeDefs,
  compraInsumoTypeDefs,
  ordenProduccionTypeDefs,
  ventaTypeDefs,
  conversacionTypeDefs,
  dashboardTypeDefs,
  muestrarioTypeDefs,
  metaMensualTypeDefs,
  cotizacionTypeDefs,
]);

const resolvers = mergeResolvers([
  empresaResolvers,
  catalogoResolvers,
  subcatalogoResolvers,
  grupoResolvers,
  usuarioResolvers,
  usuarioEmpresaResolvers,
  terceroResolvers,
  productoResolvers,
  piedraResolvers,
  compraInsumoResolvers,
  ordenProduccionResolvers,
  ventaResolvers,
  conversacionResolvers,
  dashboardResolvers,
  muestrarioResolvers,
  metaMensualResolvers,
  cotizacionResolvers,
  perfilResolvers,
]);

async function startServer() {
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: false,
    plugins: [ApolloServerPluginLandingPageLocalDefault()],
    formatError(err) {
      console.error("💥 GQL:", err.message);
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
          try {
            user = jwt.verify(
              authHeader.slice(7),
              process.env.JWT_SECRET || "dev_secret_cambia_esto",
            );
            user.empresaActualId = user.empresaId;
          } catch {
            throw new Error("UNAUTHENTICATED");
          }
        }
        return { prisma, user };
      },
    }),
  );
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 JoyeriaApp en http://localhost:${PORT}`);
  });
  process.on("SIGINT", async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
startServer();
