export type User = {
  id: string; company_id: string; name: string; username: string; email: string;
  phone: string; role: 'admin' | 'operator'; is_active: boolean
}
export type Company = { id: string; name: string; slug: string; currency: string; timezone: string; is_active: boolean }
export type Token = { access_token: string; expires_at: string; token_type: string }
export type Identity = { user: User; company: Company }
