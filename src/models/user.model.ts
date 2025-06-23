export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  password: string;
  link_token?: string;
  token_expiration?: string;
  profile?: string;
  status?: string;
  is_agreed_to_terms?: string;
  last_access?: string;
}
