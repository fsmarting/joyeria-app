import { ApolloProvider as Provider } from '@apollo/client';
import { apolloClient } from './apolloClient';

export function ApolloProvider({ children }) {
  return <Provider client={apolloClient}>{children}</Provider>;
}
