import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { typeDefs } from './src/schema/index.js';
import { resolvers } from './src/resolvers/index.js';
import authRoutes from './src/routes/index.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);

const server = new ApolloServer({ typeDefs, resolvers });
await server.start();
app.use('/graphql', expressMiddleware(server));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`JoyeriaApp backend escuchando en puerto ${PORT}`));
