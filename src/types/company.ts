export interface Company {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompaniesResponse {
  companies: Company[];
} 