import { ZodError } from 'zod';

/**
 * Central validation middleware factory.
 * Usage: router.post('/route', validate(myZodSchema), handler)
 *
 * The schema should have the shape:
 *   z.object({ body: z.object({...}), params: z.object({...}), query: z.object({...}) })
 *
 * Any unrecognised field (when using .strict()) will cause a 400 error,
 * effectively enforcing a strict DTO whitelist on every validated endpoint.
 */
const validate = (schema) => (req, res, next) => {
    try {
        // Only validate the parts of the schema that are defined
        const toValidate = {};
        if (schema.shape?.body)   toValidate.body   = req.body;
        if (schema.shape?.params) toValidate.params = req.params;
        if (schema.shape?.query)  toValidate.query  = req.query;

        const result = schema.parse(toValidate);

        // Replace req.body/params/query with the parsed (coerced + sanitised) output
        if (result.body)   req.body   = result.body;
        if (result.params) req.params = result.params;
        if (result.query)  req.query  = result.query;

        next();
    } catch (err) {
        if (err instanceof ZodError) {
            const errors = err.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            }));
            return res.status(400).json({
                message: 'Validation error',
                errors,
            });
        }
        // Unexpected error — pass it forward
        next(err);
    }
};

export default validate;
