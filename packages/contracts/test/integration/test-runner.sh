#!/bin/bash

# Script para ejecutar todas las pruebas de integración
echo "=== Compilando contratos ==="
npx hardhat compile --force

echo "=== Ejecutando pruebas de integración ==="
echo "1. Prueba flujo de pagos"
npx hardhat test test/integration/payment-flow.test.ts --no-compile

echo "2. Prueba token swapper"
npx hardhat test test/integration/token-swapper.test.ts --no-compile

echo "3. Prueba hyperbridge teleport"
npx hardhat test test/integration/hyperbridge-teleport.test.ts --no-compile

echo "=== Ejecutando pruebas de seguridad ==="
npx hardhat test test/security-integration.test.ts --no-compile

echo "=== Pruebas completadas ===" 