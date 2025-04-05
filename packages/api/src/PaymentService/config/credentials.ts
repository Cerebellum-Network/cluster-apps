/**
 * Sistema seguro para gestión de credenciales de API.
 * Implementa la subtarea #4.2 - Implement Secure Credential Management for Stripe
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import logger from '../../utils/logger';

// Cargar variables de entorno
dotenv.config();

// Claves para el cifrado (derivadas de variables de entorno para mayor seguridad)
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
const IV_LENGTH = 16; // Para AES, el IV debe ser de 16 bytes
const ALGORITHM = 'aes-256-cbc';

// Configuración de reintentos
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

interface CredentialStore {
  [key: string]: {
    value: string;
    encrypted: boolean;
    lastUpdated: string;
    hash: string;
  };
}

interface CredentialOptions {
  encrypted?: boolean;
  expirationDays?: number;
}

/**
 * Clase para gestionar de forma segura las credenciales de API
 */
class CredentialManager {
  private store: CredentialStore = {};
  private filePath: string;
  private isInitialized: boolean = false;
  private readonly defaultOptions: CredentialOptions = {
    encrypted: true,
    expirationDays: 90
  };

  constructor(storeFile?: string) {
    // Si no se proporciona un archivo, usar uno por defecto en el directorio de datos
    this.filePath = storeFile || path.join(process.cwd(), 'data', 'credentials.json');
    
    // Crear directorio de datos si no existe
    const directory = path.dirname(this.filePath);
    if (!fs.existsSync(directory)) {
      try {
        fs.mkdirSync(directory, { recursive: true });
      } catch (error) {
        logger.error('Error creating data directory for credential storage', error);
      }
    }
    
    // Intentar cargar el almacenamiento de credenciales
    this.loadStore();
  }

  /**
   * Inicializar el sistema de credenciales
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      // Verificar si podemos acceder y escribir en el archivo de almacenamiento
      await fs.promises.access(path.dirname(this.filePath), fs.constants.W_OK)
        .catch(() => {
          throw new Error(`No write access to credential store directory: ${path.dirname(this.filePath)}`);
        });
      
      // Comprobar la integridad del almacenamiento
      this.verifyStoreIntegrity();
      
      // Si no existe, crear un almacenamiento vacío
      if (Object.keys(this.store).length === 0) {
        await this.saveStore();
      }
      
      // Verificar si podemos cifrar y descifrar correctamente
      const testValue = 'test-encryption-validation';
      const encrypted = this.encrypt(testValue);
      const decrypted = this.decrypt(encrypted);
      
      if (testValue !== decrypted) {
        throw new Error('Encryption/decryption test failed. Check your encryption keys.');
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to initialize credential manager', error);
      return false;
    }
  }

  /**
   * Verificar integridad del almacenamiento
   */
  private verifyStoreIntegrity(): void {
    // Verificar cada credencial para asegurarnos de que no haya sido manipulada
    for (const [key, credential] of Object.entries(this.store)) {
      const calculatedHash = this.calculateHash(
        key, 
        credential.value, 
        credential.encrypted, 
        credential.lastUpdated
      );
      
      if (calculatedHash !== credential.hash) {
        logger.warn(`Credential integrity check failed for "${key}". The credential may have been tampered with.`);
        // Eliminar la credencial comprometida
        delete this.store[key];
      }
    }
  }

  /**
   * Calcular hash para verificación de integridad
   */
  private calculateHash(key: string, value: string, encrypted: boolean, lastUpdated: string): string {
    const data = `${key}:${value}:${encrypted}:${lastUpdated}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Cargar el almacenamiento desde el archivo
   */
  private loadStore(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        this.store = JSON.parse(data);
      } else {
        this.store = {};
      }
    } catch (error) {
      logger.error(`Error loading credential store: ${(error as Error).message}`);
      this.store = {};
    }
  }

  /**
   * Guardar el almacenamiento en el archivo
   */
  private async saveStore(): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.filePath,
        JSON.stringify(this.store, null, 2),
        'utf8'
      );
    } catch (error) {
      logger.error(`Error saving credential store: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Cifrar un valor
   * @param text Texto a cifrar
   * @returns Texto cifrado en formato hex
   */
  private encrypt(text: string): string {
    try {
      // Generar IV aleatorio
      const iv = crypto.randomBytes(IV_LENGTH);
      // Crear un cifrador
      const cipher = crypto.createCipheriv(
        ALGORITHM, 
        Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), 
        iv
      );
      // Cifrar el texto
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      // Devolver IV + texto cifrado (IV como hex + texto cifrado como hex)
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Error encrypting credential', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Descifrar un valor
   * @param text Texto cifrado con formato 'iv:encryptedText'
   * @returns Texto descifrado
   */
  private decrypt(text: string): string {
    try {
      // Separar IV y texto cifrado
      const parts = text.split(':');
      if (parts.length !== 2) throw new Error('Invalid encrypted format');
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      
      // Crear un descifrador
      const decipher = crypto.createDecipheriv(
        ALGORITHM, 
        Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), 
        iv
      );
      
      // Descifrar el texto
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting credential', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Guardar una credencial de API
   * @param key Nombre de la credencial
   * @param value Valor de la credencial
   * @param options Opciones de configuración
   */
  async setCredential(key: string, value: string, options?: CredentialOptions): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      const opts = { ...this.defaultOptions, ...options };
      
      // Si se requiere cifrado, cifrar el valor
      const storedValue = opts.encrypted ? this.encrypt(value) : value;
      const now = new Date().toISOString();
      
      // Calcular el hash para verificación de integridad
      const hash = this.calculateHash(key, storedValue, !!opts.encrypted, now);
      
      // Almacenar la credencial
      this.store[key] = {
        value: storedValue,
        encrypted: !!opts.encrypted,
        lastUpdated: now,
        hash
      };
      
      await this.saveStore();
      logger.info(`Credential "${key}" has been updated`);
    } catch (error) {
      logger.error(`Error setting credential "${key}"`, error);
      throw error;
    }
  }

  /**
   * Obtener una credencial de API
   * @param key Nombre de la credencial
   * @returns Valor de la credencial
   */
  async getCredential(key: string): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const credential = this.store[key];
    
    if (!credential) {
      return null;
    }
    
    try {
      // Comprobar la integridad de la credencial
      const hash = this.calculateHash(
        key, 
        credential.value, 
        credential.encrypted, 
        credential.lastUpdated
      );
      
      if (hash !== credential.hash) {
        logger.warn(`Credential integrity check failed for "${key}". The credential may have been tampered with.`);
        return null;
      }
      
      // Si está cifrada, descifrarla
      return credential.encrypted ? this.decrypt(credential.value) : credential.value;
    } catch (error) {
      logger.error(`Error getting credential "${key}"`, error);
      return null;
    }
  }

  /**
   * Obtener una credencial de API con reintentos
   * @param key Nombre de la credencial
   * @returns Valor de la credencial
   */
  async getCredentialWithRetry(key: string): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const value = await this.getCredential(key);
        
        if (value !== null) {
          return value;
        }
        
        lastError = new Error(`Credential "${key}" not found`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
      
      // Esperar antes de reintentar
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt)));
      }
    }
    
    throw lastError || new Error(`Failed to retrieve credential "${key}" after ${MAX_RETRIES} attempts`);
  }

  /**
   * Eliminar una credencial
   * @param key Nombre de la credencial
   */
  async deleteCredential(key: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.store[key]) {
      delete this.store[key];
      await this.saveStore();
      logger.info(`Credential "${key}" has been deleted`);
      return true;
    }
    
    return false;
  }

  /**
   * Verificar si una credencial existe
   * @param key Nombre de la credencial
   */
  async hasCredential(key: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return key in this.store;
  }

  /**
   * Obtener la fecha de la última actualización de una credencial
   * @param key Nombre de la credencial
   */
  async getLastUpdated(key: string): Promise<Date | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const credential = this.store[key];
    
    if (!credential) {
      return null;
    }
    
    return new Date(credential.lastUpdated);
  }

  /**
   * Verificar si una credencial necesita ser rotada (basado en su tiempo de expiración)
   * @param key Nombre de la credencial
   * @param expirationDays Días para expiración (opcional, usa el valor predeterminado si no se proporciona)
   */
  async needsRotation(key: string, expirationDays?: number): Promise<boolean> {
    const lastUpdated = await this.getLastUpdated(key);
    
    if (!lastUpdated) {
      return true;
    }
    
    const days = expirationDays || this.defaultOptions.expirationDays || 90;
    const expirationDate = new Date(lastUpdated);
    expirationDate.setDate(expirationDate.getDate() + days);
    
    return new Date() >= expirationDate;
  }
  
  /**
   * Obtener todas las claves de credenciales
   */
  async getAllKeys(): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return Object.keys(this.store);
  }
  
  /**
   * Rotar todas las credenciales que necesitan rotación
   * @param rotationFunction Función para obtener el nuevo valor de cada credencial
   */
  async rotateExpiredCredentials(
    rotationFunction: (key: string) => Promise<string>
  ): Promise<{ rotated: string[], failed: string[] }> {
    const rotated: string[] = [];
    const failed: string[] = [];
    
    const keys = await this.getAllKeys();
    
    for (const key of keys) {
      try {
        if (await this.needsRotation(key)) {
          const newValue = await rotationFunction(key);
          await this.setCredential(key, newValue);
          rotated.push(key);
        }
      } catch (error) {
        logger.error(`Failed to rotate credential "${key}"`, error);
        failed.push(key);
      }
    }
    
    return { rotated, failed };
  }
}

// Exportar una instancia única (singleton)
export const credentialManager = new CredentialManager();

export default credentialManager; 