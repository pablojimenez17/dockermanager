import { z } from 'zod';

export const createVolumeSchema = z.object({
    body: z.object({
        name: z
            .string({ required_error: 'Volume name is required' })
            .min(1)
            .max(128)
            .regex(/^[a-zA-Z0-9_\-]+$/, 'Name can only contain letters, numbers, underscores and hyphens'),
        driver: z
            .string()
            .max(64)
            .optional(),
        sizeMb: z
            .number()
            .int()
            .min(1, 'Minimum volume size is 1 MB')
            .max(102400, 'Maximum volume size is 100 GB')
            .optional(),
    }).strict(),
});
