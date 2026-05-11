import { z } from 'zod';

// ── Create Container ──────────────────────────────────────────────────────────
export const createContainerSchema = z.object({
    body: z.object({
        image: z
            .string({ required_error: 'Image is required' })
            .min(1, 'Image cannot be empty')
            .max(512, 'Image name too long')
            // Allow: ubuntu, nginx:latest, ghcr.io/user/image:tag — block path traversal
            .regex(/^[a-zA-Z0-9\-_./:@]+$/, 'Invalid image name format'),
        name: z
            .string({ required_error: 'Container name is required' })
            .min(1)
            .max(128)
            .regex(/^[a-zA-Z0-9_\-]+$/, 'Name can only contain letters, numbers, underscores and hyphens'),
        subdomain: z
            .string()
            .max(63)
            .regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric with hyphens')
            .optional(),
        exposedPort: z
            .number()
            .int()
            .min(1)
            .max(65535)
            .optional(),
        envVars: z
            .array(
                z.object({
                    key: z.string().max(256).regex(/^[A-Z0-9_]+$/i, 'Invalid env var key'),
                    value: z.string().max(4096),
                })
            )
            .max(64, 'Too many environment variables')
            .optional(),
        volumes: z
            .array(
                z.object({
                    volumeName: z.string().max(128).regex(/^[a-zA-Z0-9_\-]+$/),
                    mountPath: z.string().max(512).startsWith('/', 'Mount path must be absolute'),
                })
            )
            .max(16, 'Too many volume mounts')
            .optional(),
        ramMb: z
            .number()
            .int()
            .min(64, 'Minimum RAM is 64 MB')
            .max(65536, 'Maximum RAM is 64 GB')
            .optional(),
        cpuCores: z
            .number()
            .min(0.1)
            .max(32)
            .optional(),
        isPublic: z.boolean().optional(),
        networkId: z.string().max(64).optional(),
        command: z.string().max(1024).optional(),
        templateId: z.string().max(64).optional(),
    }).strict(),
});

// ── Update Container (partial — only allowed mutable fields) ──────────────────
export const updateContainerSchema = z.object({
    body: z.object({
        ramMb: z.number().int().min(64).max(65536).optional(),
        cpuCores: z.number().min(0.1).max(32).optional(),
        envVars: z
            .array(z.object({
                key: z.string().max(256).regex(/^[A-Z0-9_]+$/i),
                value: z.string().max(4096),
            }))
            .max(64)
            .optional(),
    }).strict(),
    params: z.object({
        id: z.string().min(1).max(128),
    }),
});
