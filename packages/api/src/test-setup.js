// Este archivo se ejecuta antes de cada test
jest.setTimeout(30000); // Establece un timeout global para las pruebas

// Evita mensajes de advertencia sobre la falta de implementación de TextEncoder/TextDecoder
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder; 