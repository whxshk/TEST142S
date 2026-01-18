import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const IssuePointsSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  amount: z.number().positive('Amount must be positive'),
  deviceId: z.string().uuid('Invalid device ID').optional().nullable(),
});

export class IssuePointsDto extends createZodDto(IssuePointsSchema) {}
