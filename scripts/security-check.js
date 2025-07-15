#!/usr/bin/env node
/**
 * Script de verificación de seguridad
 * Busca credenciales hardcodeadas y otros problemas de seguridad
 */

const fs = require('fs');
const path = require('path');

// Patrones peligrosos a buscar
const dangerousPatterns = [
  // Tokens de Telegram
  { pattern: /\d+:[A-Za-z0-9_-]{35}/, type: 'Telegram Bot Token', severity: 'CRITICAL' },
  
  // API Keys de OpenAI
  { pattern: /sk-[A-Za-z0-9]{20,}/, type: 'OpenAI API Key', severity: 'CRITICAL' },
  
  // URLs con tokens
  { pattern: /token_1000_anios_jehova/, type: 'Hardcoded API Token', severity: 'CRITICAL' },
  
  // IDs de grupos hardcodeados
  { pattern: /-100\d{10,}/, type: 'Hardcoded Group ID', severity: 'HIGH' },
  
  // Credenciales genéricas
  { pattern: /password\s*[:=]\s*['"]\w+['"]/, type: 'Hardcoded Password', severity: 'HIGH' },
  { pattern: /secret\s*[:=]\s*['"]\w+['"]/, type: 'Hardcoded Secret', severity: 'HIGH' },
  { pattern: /api[_-]?key\s*[:=]\s*['"]\w+['"]/, type: 'Hardcoded API Key', severity: 'HIGH' },
  
  // URLs privadas
  { pattern: /https:\/\/.*\.railway\.app/, type: 'Hardcoded Private URL', severity: 'MEDIUM' },
  
  // IPs privadas
  { pattern: /192\.168\.\d+\.\d+/, type: 'Private IP Address', severity: 'LOW' },
  { pattern: /10\.\d+\.\d+\.\d+/, type: 'Private IP Address', severity: 'LOW' }
];

// Archivos a excluir del escaneo
const excludedFiles = [
  'node_modules',
  '.git',
  'coverage',
  '.env.example',
  'security-check.js',
  'package-lock.json'
];

function scanFile(filePath) {
  const violations = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, lineNumber) => {
      dangerousPatterns.forEach(({ pattern, type, severity }) => {
        if (pattern.test(line)) {
          violations.push({
            file: filePath,
            line: lineNumber + 1,
            content: line.trim(),
            type,
            severity
          });
        }
      });
    });
  } catch (error) {
    // Ignorar errores de archivos binarios o no legibles
  }
  
  return violations;
}

function scanDirectory(dirPath) {
  const violations = [];
  
  function scan(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const relativePath = path.relative(process.cwd(), itemPath);
      
      // Saltar archivos excluidos
      if (excludedFiles.some(excluded => relativePath.includes(excluded))) {
        continue;
      }
      
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        scan(itemPath);
      } else if (stat.isFile()) {
        const fileViolations = scanFile(itemPath);
        violations.push(...fileViolations);
      }
    }
  }
  
  scan(dirPath);
  return violations;
}

function generateReport(violations) {
  console.log('\n🔍 REPORTE DE SEGURIDAD - CREDENCIALES HARDCODEADAS\n');
  console.log('=' .repeat(60));
  
  if (violations.length === 0) {
    console.log('✅ No se encontraron credenciales hardcodeadas');
    return true;
  }
  
  // Agrupar por severidad
  const bySeverity = violations.reduce((acc, violation) => {
    if (!acc[violation.severity]) acc[violation.severity] = [];
    acc[violation.severity].push(violation);
    return acc;
  }, {});
  
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  let hasCritical = false;
  
  severityOrder.forEach(severity => {
    if (bySeverity[severity]) {
      console.log(`\n🚨 ${severity} (${bySeverity[severity].length} problemas):`);
      console.log('-'.repeat(40));
      
      if (severity === 'CRITICAL') hasCritical = true;
      
      bySeverity[severity].forEach(violation => {
        console.log(`📁 ${violation.file}:${violation.line}`);
        console.log(`   Tipo: ${violation.type}`);
        console.log(`   Código: ${violation.content}`);
        console.log();
      });
    }
  });
  
  // Resumen
  console.log('\n📊 RESUMEN:');
  console.log(`   Total de violaciones: ${violations.length}`);
  severityOrder.forEach(severity => {
    if (bySeverity[severity]) {
      console.log(`   ${severity}: ${bySeverity[severity].length}`);
    }
  });
  
  if (hasCritical) {
    console.log('\n❌ FALLÓ: Se encontraron problemas CRÍTICOS de seguridad');
    console.log('   Acción requerida: Mover todas las credenciales a variables de entorno');
    return false;
  } else {
    console.log('\n⚠️  ADVERTENCIA: Se encontraron problemas de seguridad menores');
    return true;
  }
}

// Ejecutar escaneo
console.log('🔍 Iniciando escaneo de seguridad...');
const violations = scanDirectory(process.cwd());
const passed = generateReport(violations);

// Salir con código de error si hay problemas críticos
process.exit(passed ? 0 : 1);