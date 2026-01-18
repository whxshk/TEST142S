import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MerchantSignupSchema = z.object({
  merchantName: z.string().min(1, 'Merchant name is required'),
  adminEmail: z.string().email('Invalid email format'),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  locationName: z.string().min(1, 'Location name is required'),
  locationAddress: z.string().optional(),
});

export class MerchantSignupDto extends createZodDto(MerchantSignupSchema) {}
