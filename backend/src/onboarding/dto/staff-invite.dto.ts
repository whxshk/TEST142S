import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const StaffInviteSchema = z.object({
  email: z.string().email('Invalid email format'),
  scopes: z.array(z.string()).default(['scan:*']),
});

export class StaffInviteDto extends createZodDto(StaffInviteSchema) {}
