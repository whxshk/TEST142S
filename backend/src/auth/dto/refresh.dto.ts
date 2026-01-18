import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RefreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export class RefreshDto extends createZodDto(RefreshSchema) {}
