/**
 * Controlador para la gestión de credenciales de servicios externos
 * Parte de la subtarea #4.2 - Implement Secure Credential Management for Stripe
 */

import { Request, Response } from 'express';
import credentialService from '../services/CredentialService';
import logger, { logError } from '../../utils/logger';

class CredentialController {
  /**
   * Verificar el estado de las credenciales de Stripe
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async verifyStripeCredentials(req: Request, res: Response): Promise<void> {
    try {
      const result = await credentialService.verifyStripeCredentials();
      
      res.status(200).json({
        success: true,
        data: {
          isValid: result.isValid,
          missing: result.missing,
          needsRotation: result.needsRotation
        }
      });
    } catch (error) {
      logger.error('Error verifying Stripe credentials', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Actualizar las credenciales de Stripe
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async updateStripeCredentials(req: Request, res: Response): Promise<void> {
    try {
      const { secretKey, webhookSecret } = req.body;
      
      // Validar que al menos una credencial sea proporcionada
      if (!secretKey && !webhookSecret) {
        res.status(400).json({
          success: false,
          message: 'No credentials provided. At least one credential (secretKey or webhookSecret) must be provided.'
        });
        return;
      }
      
      // Actualizar las credenciales
      const result = await credentialService.updateStripeCredentials(secretKey, webhookSecret);
      
      if (result) {
        res.status(200).json({
          success: true,
          message: 'Stripe credentials updated successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update Stripe credentials'
        });
      }
    } catch (error) {
      logger.error('Error updating Stripe credentials', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Obtener información de las credenciales
   * @param req Solicitud HTTP
   * @param res Respuesta HTTP
   */
  async getCredentialInfo(req: Request, res: Response): Promise<void> {
    try {
      const info = await credentialService.getCredentialInfo();
      
      res.status(200).json({
        success: true,
        data: {
          total: info.total,
          stripeValid: info.stripeValid,
          needsRotation: info.needsRotation
        }
      });
    } catch (error) {
      logger.error('Error getting credential info', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new CredentialController(); 