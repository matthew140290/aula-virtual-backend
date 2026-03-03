// src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodObject } from 'zod';

export const validateSchema = (schema: ZodObject) => 
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error: unknown) {
            next(error); // Pasa el error de Zod al Global Error Handler
        }
    };