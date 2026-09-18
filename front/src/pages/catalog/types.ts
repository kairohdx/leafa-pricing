export type CatalogKind = 'materials' | 'services' | 'products'
export type CatalogBase = { id: string; company_id: string; name: string; archived_at: string | null }
export type Material = CatalogBase & {
  sku: string | null; notes: string | null; purchase_unit_code: string
  purchase_quantity: string; purchase_cost: string
}
export type Service = CatalogBase & { description: string | null; base_price: string }
export type Component = { id: string; material_id: string; product_id: string; quantity: string; unit_code: string }
export type Product = CatalogBase & { sku: string | null; description: string | null; materials: Component[] }
export type CatalogItem = Material | Service | Product
export type MaterialPackage = CatalogBase & { material_id: string; quantity: string; unit_code: string }
export type Unit = { id: string; code: string; name: string; symbol: string; dimension_id: string }
export const catalog = {
  materials: { title: 'Materiais', singular: 'material', route: '/materiais', description: 'Organize seus insumos, unidades de compra e embalagens.' },
  services: { title: 'Serviços', singular: 'serviço', route: '/servicos', description: 'Os serviços e preços base da sua empresa.' },
  products: { title: 'Produtos', singular: 'produto', route: '/produtos', description: 'Cadastre produtos e organize sua composição de materiais.' },
} satisfies Record<CatalogKind, { title: string; singular: string; route: string; description: string }>
