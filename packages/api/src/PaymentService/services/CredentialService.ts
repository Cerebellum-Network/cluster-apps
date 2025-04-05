/**
 * Servicio para gestionar credenciales de servicios externos
 * Parte de la implementación de la subtarea #4.2 - Implement Secure Credential Management for Stripe
 */

import credentialManager from '../config/credentials';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../config/env';
import logger from '../../utils/logger';

// Constantes para nombres de credenciales
export const STRIPE_SECRET_KEY_NAME = 'stripe_secret_key';
export const STRIPE_WEBHOOK_SECRET_NAME = 'stripe_webhook_secret';

// Lista de credenciales requeridas por Stripe
const REQUIRED_STRIPE_CREDENTIALS = [
  STRIPE_SECRET_KEY_NAME,
  STRIPE_WEBHOOK_SECRET_NAME
];

/**
 * Servicio para gestión de credenciales de APIs y servicios externos
 */
class CredentialService {
  private initialized = false;

  /**
   * Inicializar el servicio con valores por defecto
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    
    try {
      await credentialManager.initialize();
      
      // Comprobar si las credenciales de Stripe ya están almacenadas
      const missingCredentials = [];
      
      for (const credentialName of REQUIRED_STRIPE_CREDENTIALS) {
        if (!(await credentialManager.hasCredential(credentialName))) {
          missingCredentials.push(credentialName);
        }
      }
      
      // Si faltan credenciales, inicializar con valores del archivo .env
      if (missingCredentials.length > 0) {
        logger.info(`Initializing missing credentials: ${missingCredentials.join(', ')}`);
        
        // Inicializar credenciales de Stripe
        if (!await credentialManager.hasCredential(STRIPE_SECRET_KEY_NAME) && STRIPE_SECRET_KEY) {
          await credentialManager.setCredential(STRIPE_SECRET_KEY_NAME, STRIPE_SECRET_KEY);
        }
        
        if (!await credentialManager.hasCredential(STRIPE_WEBHOOK_SECRET_NAME) && STRIPE_WEBHOOK_SECRET) {
          await credentialManager.setCredential(STRIPE_WEBHOOK_SECRET_NAME, STRIPE_WEBHOOK_SECRET);
        }
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to initialize CredentialService', error);
      return false;
    }
  }

  /**
   * Obtener la clave secreta de Stripe
   */
  async getStripeSecretKey(): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Intentar obtener del almacenamiento seguro
      const key = await credentialManager.getCredentialWithRetry(STRIPE_SECRET_KEY_NAME);
      return key;
    } catch (error) {
      // Si falla, intentar obtener del .env (menos seguro)
      if (STRIPE_SECRET_KEY) {
        logger.warn('Using Stripe Secret Key from environment variables as fallback');
        return STRIPE_SECRET_KEY;
      }
      
      logger.error('Failed to retrieve Stripe Secret Key', error);
      throw new Error('Stripe Secret Key not available');
    }
  }

  /**
   * Obtener el secreto de webhooks de Stripe
   */
  async getStripeWebhookSecret(): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Intentar obtener del almacenamiento seguro
      const secret = await credentialManager.getCredentialWithRetry(STRIPE_WEBHOOK_SECRET_NAME);
      return secret;
    } catch (error) {
      // Si falla, intentar obtener del .env (menos seguro)
      if (STRIPE_WEBHOOK_SECRET) {
        logger.warn('Using Stripe Webhook Secret from environment variables as fallback');
        return STRIPE_WEBHOOK_SECRET;
      }
      
      logger.error('Failed to retrieve Stripe Webhook Secret', error);
      throw new Error('Stripe Webhook Secret not available');
    }
  }

  /**
   * Actualizar las credenciales de Stripe
   * @param secretKey Nueva clave secreta de Stripe
   * @param webhookSecret Nuevo secreto de webhook de Stripe
   */
  async updateStripeCredentials(secretKey?: string, webhookSecret?: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      if (secretKey) {
        await credentialManager.setCredential(STRIPE_SECRET_KEY_NAME, secretKey);
      }
      
      if (webhookSecret) {
        await credentialManager.setCredential(STRIPE_WEBHOOK_SECRET_NAME, webhookSecret);
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to update Stripe credentials', error);
      return false;
    }
  }

  /**
   * Verificar que todas las credenciales de Stripe estén disponibles
   */
  async verifyStripeCredentials(): Promise<{
    isValid: boolean;
    missing: string[];
    needsRotation: string[];
  }> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const missing: string[] = [];
    const needsRotation: string[] = [];
    
    for (const credentialName of REQUIRED_STRIPE_CREDENTIALS) {
      if (!(await credentialManager.hasCredential(credentialName))) {
        missing.push(credentialName);
        continue;
      }
      
      // Verificar si la credencial necesita ser rotada
      if (await credentialManager.needsRotation(credentialName)) {
        needsRotation.push(credentialName);
      }
    }
    
    return {
      isValid: missing.length === 0,
      missing,
      needsRotation
    };
  }

  /**
   * Obtener información sobre todas las credenciales almacenadas
   */
  async getCredentialInfo(): Promise<{
    total: number;
    stripeValid: boolean;
    needsRotation: string[];
  }> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const keys = await credentialManager.getAllKeys();
    const stripeVerification = await this.verifyStripeCredentials();
    
    return {
      total: keys.length,
      stripeValid: stripeVerification.isValid,
      needsRotation: stripeVerification.needsRotation
    };
  }
}

// Exportar una instancia única del servicio (singleton)
export const credentialService = new CredentialService();

export default credentialService; 