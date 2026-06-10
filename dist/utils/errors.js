"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorMessage = exports.isSqlErrorLike = void 0;
const isSqlErrorLike = (error) => {
    if (typeof error !== 'object' || error === null)
        return false;
    const candidate = error;
    return typeof candidate.number === 'number' && typeof candidate.message === 'string';
};
exports.isSqlErrorLike = isSqlErrorLike;
const getErrorMessage = (error, fallback) => error instanceof Error ? error.message : fallback;
exports.getErrorMessage = getErrorMessage;
