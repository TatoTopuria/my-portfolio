export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  verifyUrl?: string;
  logoUrl?: string;
  badgeUrl?: string;
}
