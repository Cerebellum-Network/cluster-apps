import { PaymentStatus } from '../models';
import PaymentRepository from '../repositories/PaymentRepository';
import ContractService from './ContractService';
import logger from '../utils/logger';

/**
 * Servicio para gestionar la teleportación de tokens entre redes
 */
class TeleportService {
  private paymentRepository: PaymentRepository;
  private contractService: ContractService;
  private monitoringTimers: Map<string, NodeJS.Timeout>;

  constructor() {
    this.paymentRepository = new PaymentRepository();
    this.contractService = new ContractService();
    this.monitoringTimers = new Map();
  }

  /**
   * Inicia el proceso de teleportación de tokens
   * @param paymentId ID del pago
   * @returns Información sobre la teleportación
   */
  async teleportTokens(paymentId: string): Promise<{ teleportTxId: string }> {
    try {
      // Buscar pago
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new Error(`Pago ${paymentId} no encontrado`);
      }

      // Verificar estado correcto
      if (payment.status !== PaymentStatus.TOKENS_SWAPPED) {
        throw new Error(`Estado incorrecto para teleport: ${payment.status}`);
      }

      // Iniciar teleport mediante ContractService
      const teleportTxId = await this.contractService.teleportTokens(
        payment.cereAmount,
        payment.cereNetworkAddress
      );

      // Actualizar estado del pago
      await this.paymentRepository.updateStatus(payment.id, PaymentStatus.TELEPORTING, {
        teleportTxId,
        teleportStartedAt: new Date().toISOString()
      });

      // Iniciar monitoreo asíncrono del teleport
      this.monitorTeleport(paymentId, teleportTxId);

      return { teleportTxId };
    } catch (error) {
      logger.error(`Error al teleportar tokens para pago ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Monitorea el estado de una teleportación
   * @param paymentId ID del pago
   * @param teleportTxId ID de transacción de teleport
   */
  async monitorTeleport(paymentId: string, teleportTxId: string): Promise<void> {
    // Verificamos si ya hay un monitoreo activo para este pago
    if (this.monitoringTimers.has(paymentId)) {
      clearTimeout(this.monitoringTimers.get(paymentId)!);
    }

    try {
      // Verificar estado del teleport
      const teleportStatus = await this.contractService.checkTeleportStatus(teleportTxId);

      if (teleportStatus === 'COMPLETED') {
        // Teleport completado, actualizar estado
        await this.paymentRepository.updateStatus(paymentId, PaymentStatus.TELEPORTED, {
          teleportCompletedAt: new Date().toISOString()
        });
        return;
      } else if (teleportStatus === 'FAILED') {
        // Teleport fallido
        await this.paymentRepository.updateStatus(paymentId, PaymentStatus.FAILED, {
          failureReason: 'Teleport failed',
          failureStep: 'teleport'
        });
        return;
      }

      // Teleport aún en progreso, programar nueva verificación
      const timer = setTimeout(() => {
        this.monitoringTimers.delete(paymentId);
        this.monitorTeleport(paymentId, teleportTxId);
      }, 30000); // Verificar cada 30 segundos

      this.monitoringTimers.set(paymentId, timer);
    } catch (error) {
      logger.error(`Error al monitorear teleport ${teleportTxId}:`, error);
      
      // Programar reintento
      const timer = setTimeout(() => {
        this.monitoringTimers.delete(paymentId);
        this.monitorTeleport(paymentId, teleportTxId);
      }, 60000); // Reintento en 1 minuto

      this.monitoringTimers.set(paymentId, timer);
    }
  }

  /**
   * Simula la confirmación de un teleport (para propósitos de la demo)
   * @param paymentId ID del pago
   */
  async confirmTeleport(paymentId: string): Promise<void> {
    // Simular confirmación de teleport (en producción esto sería detectado por monitorTeleport)
    await this.paymentRepository.updateStatus(paymentId, PaymentStatus.TELEPORTED, {
      teleportCompletedAt: new Date().toISOString()
    });
  }

  /**
   * Limpia los temporizadores de monitoreo
   * Útil para pruebas y cierre limpio de la aplicación
   */
  cleanupTimers(): void {
    for (const timer of this.monitoringTimers.values()) {
      clearTimeout(timer);
    }
    this.monitoringTimers.clear();
  }
}

export default TeleportService; 