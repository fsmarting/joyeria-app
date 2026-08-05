import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";

const graphqlURL =
  import.meta.env.VITE_GRAPHQL_URL || "http://localhost:4000/graphql";

const httpLink = new HttpLink({ uri: graphqlURL });

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem("token");
  const empresaActualId = localStorage.getItem("empresaActualId");
  const rolId = localStorage.getItem("rolId");
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
      empresaactualid: empresaActualId || "",
      rolid: rolId || "",
    },
  };
});

// ── Interceptor de sesión expirada ───────────────────────────
// Detecta UNAUTHENTICATED y dispara el modal desde App.jsx
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      if (
        err.extensions?.code === "UNAUTHENTICATED" ||
        err.message === "UNAUTHENTICATED"
      ) {
        // Emitir evento global — App.jsx lo escucha
        window.dispatchEvent(new CustomEvent("SESSION_EXPIRED"));
        break;
      }
    }
  }
});

export const apolloClient = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
  connectToDevTools: import.meta.env.MODE !== "production",
});
