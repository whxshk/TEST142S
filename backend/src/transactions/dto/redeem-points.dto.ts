import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RedeemPointsSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  rewardId: z.string().uuid('Invalid reward ID'),
});

export class RedeemPointsDto extends createZodDto(RedeemPointsSchema) {}
