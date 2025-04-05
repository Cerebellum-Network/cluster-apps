import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import { ValidationRequestError } from './error.middleware';

/**
 * Middleware para validar peticiones basadas en las reglas definidas con express-validator
 * @param validations Cadena de validaciones a aplicar
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Ejecutar todas las validaciones
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Obtener resultados de validación
    const errors = validationResult(req);
    
    // Si hay errores, lanzar un error de validación
    if (!errors.isEmpty()) {
      next(new ValidationRequestError(errors.array()));
      return;
    }
    
    // Si no hay errores, continuar
    next();
  };
};

/**
 * Validaciones comunes para reutilizar en diferentes rutas
 */
export const validationRules = {
  // Reglas para stablecoin
  stablecoin: {
    symbol: {
      in: ['body'],
      isIn: {
        options: [['USDC', 'USDT']],
        errorMessage: 'Stablecoin no soportada. Use USDC o USDT'
      }
    },
    amount: {
      in: ['body'],
      isFloat: {
        options: { min: 0.01 },
        errorMessage: 'La cantidad debe ser un número positivo mayor a 0.01'
      }
    },
    address: {
      in: ['body'],
      isEthereumAddress: {
        errorMessage: 'Dirección Ethereum inválida'
      }
    }
  },
  
  // Reglas para direcciones Cere Network
  cereNetwork: {
    address: {
      in: ['body'],
      isString: {
        errorMessage: 'La dirección de Cere Network debe ser una cadena de texto'
      },
      isLength: {
        options: { min: 42, max: 42 },
        errorMessage: 'La dirección de Cere Network debe tener 42 caracteres'
      },
      matches: {
        options: /^(cere|CERE)[a-zA-Z0-9]{38}$/,
        errorMessage: 'Formato de dirección Cere Network inválido'
      }
    }
  },
  
  // Reglas para IDs de transacciones
  transaction: {
    id: {
      in: ['params'],
      isUUID: {
        options: 4,
        errorMessage: 'ID de transacción inválido'
      }
    },
    txHash: {
      in: ['body'],
      isString: {
        errorMessage: 'Hash de transacción debe ser una cadena de texto'
      },
      isLength: {
        options: { min: 66, max: 66 },
        errorMessage: 'Hash de transacción debe tener 66 caracteres'
      },
      matches: {
        options: /^0x[a-fA-F0-9]{64}$/,
        errorMessage: 'Formato de hash de transacción inválido'
      }
    }
  },
  
  // Reglas para paginación
  pagination: {
    limit: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 1, max: 100 },
        errorMessage: 'Límite debe ser un entero entre 1 y 100'
      },
      toInt: true
    },
    offset: {
      in: ['query'],
      optional: true,
      isInt: {
        options: { min: 0 },
        errorMessage: 'Offset debe ser un entero positivo'
      },
      toInt: true
    }
  },
  
  // Reglas para Stripe
  stripe: {
    amountUsd: {
      in: ['body'],
      isFloat: {
        options: { min: 1 },
        errorMessage: 'La cantidad en USD debe ser un número positivo mayor a 1'
      }
    }
  }
};

export default validate; 