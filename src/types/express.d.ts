// src/types/express.d.ts

import type { DecodedUserToken } from './auth';

// Sobrescribimos el namespace global de Express de forma segura
declare global {
    namespace Express {
        interface Request {
            user?: DecodedUserToken;
            tenantId?: string;
        }
    }
}
