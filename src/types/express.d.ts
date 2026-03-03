// src/types/express.d.ts

import { DecodedUserToken } from '../middleware/auth.middleware';

// Sobrescribimos el namespace global de Express de forma segura
declare global {
    namespace Express {
        interface Request {
            user?: DecodedUserToken;
        }
    }
}