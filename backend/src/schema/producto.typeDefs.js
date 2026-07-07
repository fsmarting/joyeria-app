export default /* GraphQL */ `
  type ProductoPiedra {
    id: Int! productoId: Int! piedraId: Int!
    cantidad: Float! costoEstandardUnitario: Float!
    costoEstandardTotal: Float! desperdicio: Float! version: Int!
    piedra: Piedra
  }
  type Producto {
    id: Int! empresaId: Int! referencia: String! nombre: String!
    descripcion: String foto: String
    gramosOro: Float! costoGramoOroUsado: Float!
    costoManoObra: Float! costoOtros: Float! precioVenta: Float!
    activo: Boolean! enStock: Int! version: Int!
    categoria: Grupo costoTotal: Float margen: Float
    piedras: [ProductoPiedra!]!
  }
  type ProductoEdge { node: Producto! cursor: ID! }
  type ProductoConnection { edges: [ProductoEdge!]! pageInfo: PageInfo! }

  input ProductoInput {
    empresaId: Int! referencia: String! nombre: String!
    categoriaId: Int descripcion: String foto: String
    gramosOro: Float! costoGramoOroUsado: Float!
    costoManoObra: Float! costoOtros: Float! precioVenta: Float! version: Int!
  }
  input ProductoUpdateInput {
    id: Int! referencia: String! nombre: String!
    categoriaId: Int descripcion: String foto: String
    gramosOro: Float! costoGramoOroUsado: Float!
    costoManoObra: Float! costoOtros: Float! precioVenta: Float! version: Int!
  }
  input ProductoPiedraInput {
    productoId: Int! piedraId: Int! cantidad: Float!
    costoEstandardUnitario: Float! desperdicio: Float
  }
  input ProductoPiedraUpdateInput {
    id: Int! cantidad: Float! costoEstandardUnitario: Float!
    desperdicio: Float version: Int!
  }

  extend type Query {
    productosFiltradosCursor(
      first: Int after: String orden: [String] direccion: [String] busqueda: String
    ): ProductoConnection!
    obtenerProductos: [Producto!]!
  }
  extend type Mutation {
    crearProducto(input: ProductoInput!): Producto
    actualizarProducto(input: ProductoUpdateInput!): Producto!
    eliminarProducto(id: Int!): Boolean!
    agregarInsumoProducto(input: ProductoPiedraInput!): ProductoPiedra!
    actualizarInsumoProducto(input: ProductoPiedraUpdateInput!): ProductoPiedra!
    eliminarInsumoProducto(id: Int!): Boolean!
  }
`;
