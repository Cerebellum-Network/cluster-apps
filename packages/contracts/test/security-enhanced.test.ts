import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  SecurityManager,
  StablecoinPaymentHandler
} from "../typechain-types";

// Tests para las características avanzadas de seguridad
describe("Enhanced Security Features", function () {
  // Contract instances
  let securityManager: SecurityManager;
  let paymentHandler: StablecoinPaymentHandler;
  
  // Test accounts
  let deployer: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let operator: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;
  
  // Constants
  const MOCK_TOKEN_AMOUNT = ethers.parseUnits("1000", 6); // 1,000 USDC
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  const SECURITY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SECURITY_ROLE"));
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  
  beforeEach(async function () {
    // Get test accounts
    [deployer, admin, operator, user1, user2, attacker] = await ethers.getSigners();
    
    // Deploy security manager
    const SecurityManagerFactory = await ethers.getContractFactory("SecurityManager");
    securityManager = await SecurityManagerFactory.deploy(deployer.address);
    
    // Set up roles
    await securityManager.addAdmin(admin.address);
    await securityManager.addOperator(operator.address);
    await securityManager.addSecurityRole(admin.address);
    
    // Deploy a minimal StablecoinPaymentHandler for integration testing
    const PaymentHandlerFactory = await ethers.getContractFactory("StablecoinPaymentHandler");
    paymentHandler = await PaymentHandlerFactory.deploy();
    
    // Configure security manager in payment handler
    await paymentHandler.setSecurityManager(await securityManager.getAddress());
  });
  
  describe("Anti-MEV Protección", function () {
    it("debería prevenir transacciones rápidas del mismo usuario", async function () {
      // Configurar un intervalo de tiempo mínimo entre transacciones
      await securityManager.connect(admin).setMinTimeBetweenTransactions(5); // 5 segundos
      
      // Primera transacción debería ser exitosa
      await securityManager.connect(operator).recordTransaction(user1.address, ethers.parseUnits("10", 6));
      
      // Segunda transacción inmediata debería fallar (rate limited)
      await expect(
        securityManager.connect(operator).recordTransaction(user1.address, ethers.parseUnits("10", 6))
      ).to.be.revertedWith("Rate limited");
      
      // Esperamos 6 segundos
      await ethers.provider.send("evm_increaseTime", [6]);
      await ethers.provider.send("evm_mine", []);
      
      // Ahora debería funcionar
      await securityManager.connect(operator).recordTransaction(user1.address, ethers.parseUnits("10", 6));
    });
    
    it("debería bloquear transacciones demasiado rápidas a nivel de payment handler", async function () {
      // Configurar un intervalo de tiempo mínimo entre transacciones
      await securityManager.connect(admin).setMinTimeBetweenTransactions(3); // 3 segundos
      
      // Verificar que inicialmente la transacción es permitida
      expect(await paymentHandler.canTransact(user1.address, ethers.parseUnits("10", 6))).to.be.true;
      
      // Registrar una transacción
      await securityManager.connect(operator).recordTransaction(user1.address, ethers.parseUnits("10", 6));
      
      // Ahora la transacción debe ser bloqueada por el límite de velocidad
      expect(await paymentHandler.canTransact(user1.address, ethers.parseUnits("10", 6))).to.be.false;
      
      // Esperamos 4 segundos
      await ethers.provider.send("evm_increaseTime", [4]);
      await ethers.provider.send("evm_mine", []);
      
      // Ahora debería ser permitida de nuevo
      expect(await paymentHandler.canTransact(user1.address, ethers.parseUnits("10", 6))).to.be.true;
    });
  });
  
  describe("Detección de Anomalías", function () {
    it("debería detectar transacciones de alto valor", async function () {
      // Configurar umbrales de detección de anomalías
      await securityManager.connect(admin).setAnomalyThresholds(
        ethers.parseUnits("50", 6), // 50 USDC como umbral de alto valor
        5,                         // 5 transacciones rápidas
        300,                       // en un período de 5 minutos
        ethers.parseUnits("100", 6) // 100 USDC volumen diario
      );
      
      // Vigilar el evento de detección de anomalía
      const tx = await securityManager.connect(operator).recordTransaction(
        user1.address, 
        ethers.parseUnits("60", 6) // 60 USDC (por encima del umbral de 50)
      );
      
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        log => securityManager.interface.parseLog(log as any)?.name === "AnomalyDetected"
      );
      
      expect(event).to.not.be.undefined;
      
      // Verificar contador de actividades sospechosas
      expect(await securityManager.suspiciousActivityCount()).to.be.gt(0);
    });
    
    it("debería detectar múltiples transacciones en un período corto", async function () {
      // Configurar umbrales de detección de anomalías
      await securityManager.connect(admin).setAnomalyThresholds(
        ethers.parseUnits("1000", 6), // 1000 USDC como umbral de alto valor
        3,                           // 3 transacciones rápidas
        300,                         // en un período de 5 minutos
        ethers.parseUnits("100", 6)   // 100 USDC volumen diario
      );
      
      // Realizar múltiples transacciones
      for (let i = 0; i < 2; i++) {
        await securityManager.connect(operator).recordTransaction(
          user1.address, 
          ethers.parseUnits("10", 6)
        );
        
        // Pequeño incremento de tiempo entre transacciones para evitar rate limit
        await ethers.provider.send("evm_increaseTime", [3]);
        await ethers.provider.send("evm_mine", []);
      }
      
      // Contador inicial de actividades sospechosas
      const initialCount = await securityManager.suspiciousActivityCount();
      
      // La tercera transacción debería disparar la detección de anomalía
      const tx = await securityManager.connect(operator).recordTransaction(
        user1.address, 
        ethers.parseUnits("10", 6)
      );
      
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        log => securityManager.interface.parseLog(log as any)?.name === "AnomalyDetected"
      );
      
      expect(event).to.not.be.undefined;
      
      // Verificar que el contador aumentó
      expect(await securityManager.suspiciousActivityCount()).to.be.gt(initialCount);
    });
    
    it("debería detectar alto volumen diario", async function () {
      // Configurar umbrales
      await securityManager.connect(admin).setAnomalyThresholds(
        ethers.parseUnits("1000", 6), // 1000 USDC como umbral de alto valor
        10,                          // 10 transacciones rápidas
        300,                         // en un período de 5 minutos
        ethers.parseUnits("75", 6)    // 75 USDC volumen diario
      );
      
      // Configurar un intervalo mínimo bajo para las pruebas
      await securityManager.connect(admin).setMinTimeBetweenTransactions(1);
      
      // Realizar transacciones que sumen más del límite diario
      await securityManager.connect(operator).recordTransaction(
        user1.address, 
        ethers.parseUnits("40", 6)
      );
      
      // Incrementar tiempo para evitar rate limit
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      
      // La segunda transacción debería llevar el total a más del umbral diario
      const tx = await securityManager.connect(operator).recordTransaction(
        user1.address, 
        ethers.parseUnits("40", 6)
      );
      
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        log => {
          const parsedLog = securityManager.interface.parseLog(log as any);
          return parsedLog?.name === "AnomalyDetected" && 
                 parsedLog.args[1] === "HIGH_DAILY_VOLUME";
        }
      );
      
      expect(event).to.not.be.undefined;
    });
  });
  
  describe("Gestión de Administradores de Confianza", function () {
    it("debería permitir agregar y eliminar administradores de confianza", async function () {
      // Agregar administrador de confianza
      await securityManager.connect(admin).addTrustedAdmin(user1.address);
      
      // Configurar requisito de múltiples firmas
      await securityManager.connect(admin).setRequiredSignatures(2);
      
      // Verificar que el evento se emitió
      const tx = await securityManager.connect(admin).removeTrustedAdmin(user1.address);
      
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        log => securityManager.interface.parseLog(log as any)?.name === "RoleRevoked"
      );
      
      expect(event).to.not.be.undefined;
    });
    
    it("debería permitir configurar el número requerido de firmas", async function () {
      // Valor inicial
      expect(await securityManager.requiredAdminSignatures()).to.equal(1);
      
      // Cambiar el valor
      await securityManager.connect(admin).setRequiredSignatures(3);
      
      // Verificar nuevo valor
      expect(await securityManager.requiredAdminSignatures()).to.equal(3);
    });
  });
  
  describe("Configuración de Parámetros de Seguridad", function () {
    it("debería permitir configurar umbrales de detección de anomalías", async function () {
      // Configurar umbrales
      await securityManager.connect(admin).setAnomalyThresholds(
        ethers.parseUnits("500", 6),  // highValueThreshold
        8,                            // rapidTransactionCount
        600,                          // rapidTransactionWindow
        ethers.parseUnits("2000", 6)   // dailyVolumeThreshold
      );
      
      // Verificar que se actualizaron correctamente
      const thresholds = await securityManager.anomalyThresholds();
      expect(thresholds[0]).to.equal(ethers.parseUnits("500", 6));
      expect(thresholds[1]).to.equal(8);
      expect(thresholds[2]).to.equal(600);
      expect(thresholds[3]).to.equal(ethers.parseUnits("2000", 6));
    });
    
    it("debería permitir actualizar el tiempo mínimo entre transacciones", async function () {
      // Configurar tiempo
      const tx = await securityManager.connect(admin).setMinTimeBetweenTransactions(10); // 10 segundos
      
      // Verificar evento
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        log => {
          const parsedLog = securityManager.interface.parseLog(log as any);
          return parsedLog?.name === "SecurityParametersUpdated" && 
                 parsedLog.args[0] === "MIN_TIME_BETWEEN_TXS";
        }
      );
      
      expect(event).to.not.be.undefined;
      
      // Verificar nuevo valor
      expect(await securityManager.minTimeBetweenTxs()).to.equal(10);
    });
    
    it("no debería permitir un tiempo entre transacciones demasiado alto", async function () {
      // Intentar establecer un valor demasiado alto
      await expect(
        securityManager.connect(admin).setMinTimeBetweenTransactions(61) // Más de 60 segundos
      ).to.be.revertedWith("Maximum value is 60 seconds");
    });
  });
}); 