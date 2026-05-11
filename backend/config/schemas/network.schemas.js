import { z } from 'zod';

export const createNetworkSchema = z.object({
    body: z.object({
        name: z
            .string({ required_error: 'Network name is required' })
            .min(1)
            .max(128)
            .regex(/^[a-zA-Z0-9_\-]+$/, 'Name can only contain letters, numbers, underscores and hyphens'),
        driver: z
            .enum(['bridge', 'overlay', 'host', 'none'])
            .default('bridge'),
        internal: z.boolean().optional(),
        subnet: z
            .string()
            .regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/, 'Invalid subnet CIDR notation')
            .optional(),
    }).strict(),
});
