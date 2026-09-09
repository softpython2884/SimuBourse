/** Stable error codes shared by the API and the client so messages can be localized. */
export const ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INSUFFICIENT_QUANTITY: 'INSUFFICIENT_QUANTITY',
  MARKET_CLOSED: 'MARKET_CLOSED',
  ASSET_NOT_TRADABLE: 'ASSET_NOT_TRADABLE',
  ORDER_LIMIT_REACHED: 'ORDER_LIMIT_REACHED',
  PRICE_OUT_OF_BAND: 'PRICE_OUT_OF_BAND',
  SLIPPAGE_EXCEEDED: 'SLIPPAGE_EXCEEDED',
  SELF_TRADE: 'SELF_TRADE',
  DUPLICATE: 'DUPLICATE',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Thrown by domain services; the Fastify error handler maps it to an HTTP status. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static unauthenticated(message = 'Connexion requise.') {
    return new AppError(ERROR_CODES.UNAUTHENTICATED, message, 401);
  }
  static forbidden(message = "Vous n'avez pas la permission d'effectuer cette action.") {
    return new AppError(ERROR_CODES.FORBIDDEN, message, 403);
  }
  static notFound(message = 'Ressource introuvable.') {
    return new AppError(ERROR_CODES.NOT_FOUND, message, 404);
  }
  static conflict(message: string) {
    return new AppError(ERROR_CODES.CONFLICT, message, 409);
  }
  static validation(message: string, details?: unknown) {
    return new AppError(ERROR_CODES.VALIDATION, message, 422, details);
  }
  static insufficientFunds(message = 'Fonds insuffisants.') {
    return new AppError(ERROR_CODES.INSUFFICIENT_FUNDS, message, 400);
  }
  static insufficientQuantity(message = 'Quantité détenue insuffisante.') {
    return new AppError(ERROR_CODES.INSUFFICIENT_QUANTITY, message, 400);
  }
}

export const HTTP_MESSAGE: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Connexion requise.',
  FORBIDDEN: 'Action non autorisée.',
  NOT_FOUND: 'Ressource introuvable.',
  VALIDATION: 'Données invalides.',
  CONFLICT: 'Conflit avec l’état actuel.',
  RATE_LIMITED: 'Trop de requêtes, réessayez dans un instant.',
  INSUFFICIENT_FUNDS: 'Fonds insuffisants.',
  INSUFFICIENT_QUANTITY: 'Quantité insuffisante.',
  MARKET_CLOSED: 'Ce marché est fermé.',
  ASSET_NOT_TRADABLE: 'Cet actif n’est pas négociable.',
  ORDER_LIMIT_REACHED: 'Trop d’ordres ouverts.',
  PRICE_OUT_OF_BAND: 'Prix hors des limites autorisées.',
  SLIPPAGE_EXCEEDED: 'Slippage trop important, ordre annulé.',
  SELF_TRADE: 'Vous ne pouvez pas exécuter un ordre contre vous-même.',
  DUPLICATE: 'Cette opération a déjà été effectuée.',
  ACCOUNT_SUSPENDED: 'Ce compte est suspendu.',
  INTERNAL: 'Erreur interne, réessayez.',
};
