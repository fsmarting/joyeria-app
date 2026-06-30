import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const graphqlURL = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql';

const httpLink = new HttpLink({ uri: graphqlURL });

const authLink = setContext((_, { headers }) => {
  const token           = localStorage.getItem('token');
  const empresaActualId = localStorage.getItem('empresaActualId');
  const rolId           = localStorage.getItem('rolId');
  return {
    headers: {
      ...headers,
      authorization:   token           ? `Bearer ${token}` : '',
      empresaactualid: empresaActualId || '',
      rolid:           rolId           || '',
    },
  };
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  connectToDevTools: import.meta.env.MODE !== 'production',
});
