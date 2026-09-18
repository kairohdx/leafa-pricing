export type Rule = {
  id: string; name: string; description: string | null; strategy_key: string
  parameters: Record<string, unknown>; is_default: boolean; version: number; archived_at: string | null
}
export type LineInput = {
  kind: 'material' | 'product' | 'service'; material_id?: string | null
  product_id?: string | null; service_id?: string | null; quantity: string; unit_code?: string | null
}
export type SaleLine = LineInput & {
  id: string; description_snapshot: string; unit_cost_snapshot: string | null
  unit_price_snapshot: string | null; line_total: string | null
}
export type Sale = {
  id: string; description: string; occurred_at: string; status: 'draft' | 'completed' | 'cancelled'
  created_by_id: string; pricing_rule_id: string | null; rule_version: number | null
  suggested_total: string | null; final_total: string; cost_total: string | null
  pricing_snapshot: Record<string, unknown> | null; currency: string; lines: SaleLine[]
}
export const saleStatus = { draft: 'Rascunho', completed: 'Concluída', cancelled: 'Cancelada' }
