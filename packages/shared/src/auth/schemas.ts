import { z } from 'zod';

/** Body for POST /api/auth/login */
export const loginRequestSchema = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
