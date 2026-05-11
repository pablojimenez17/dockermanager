import { z } from 'zod';

// ── Password strength rule (shared) ──────────────────────────────────────────
const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-z]/, 'Password must contain lowercase letters')
    .regex(/[A-Z]/, 'Password must contain uppercase letters')
    .regex(/[0-9]/, 'Password must contain numbers')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain special characters');

// ── Register ─────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
    body: z.object({
        name: z
            .string({ required_error: 'Name is required' })
            .min(2, 'Name must be at least 2 characters')
            .max(80, 'Name must not exceed 80 characters')
            .trim(),
        email: z
            .string({ required_error: 'Email is required' })
            .email('Invalid email format')
            .max(254, 'Email too long')
            .toLowerCase(),
        password: passwordSchema,
    }).strict(), // rejects any extra fields not in schema
});

// ── Login ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
    body: z.object({
        email: z
            .string({ required_error: 'Email is required' })
            .email('Invalid email format')
            .max(254)
            .toLowerCase(),
        password: z
            .string({ required_error: 'Password is required' })
            .min(1, 'Password is required'),
    }).strict(),
});

// ── Verify OTP ────────────────────────────────────────────────────────────────
export const verifyCodeSchema = z.object({
    body: z.object({
        email: z
            .string({ required_error: 'Email is required' })
            .email('Invalid email format')
            .toLowerCase(),
        code: z
            .string({ required_error: 'Verification code is required' })
            .length(6, 'Code must be exactly 6 digits')
            .regex(/^\d+$/, 'Code must be numeric'),
    }).strict(),
});

// ── Forgot Password ───────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z
            .string({ required_error: 'Email is required' })
            .email('Invalid email format')
            .max(254)
            .toLowerCase(),
    }).strict(),
});

// ── Reset Password ────────────────────────────────────────────────────────────
export const resetPasswordSchema = z.object({
    body: z.object({
        email: z
            .string({ required_error: 'Email is required' })
            .email('Invalid email format')
            .toLowerCase(),
        code: z
            .string({ required_error: 'Code is required' })
            .length(6, 'Code must be exactly 6 digits')
            .regex(/^\d+$/, 'Code must be numeric'),
        newPassword: passwordSchema,
    }).strict(),
});
