/**
 * Script para sincronizar los archivos modulares de src/in_game a public
 * Este script observa cambios en archivos HTML y JS (no TypeScript) 
 * en la carpeta src/in_game y los copia a public.
 */

const fs = require('fs');
const path = require('path');

// Rutas
const sourceDir = path.resolve(__dirname, '../src/in_game');
const targetDir = path.resolve(__dirname, '../public');

// Extensiones a sincronizar
const validExtensions = ['.html', '.js'];

// Archivos a excluir de la sincronización
const excludedFiles = ['in_game.html'];

// Función para copiar un archivo
function copyFile(sourcePath, targetPath) {
  console.log(`Copiando ${path.basename(sourcePath)} a public/`);
  
  // Asegurar que el directorio de destino exista
  if (!fs.existsSync(path.dirname(targetPath))) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }
  
  // Copiar el archivo
  fs.copyFileSync(sourcePath, targetPath);
}

// Función para sincronizar los archivos
function syncModularFiles() {
  // Leer todos los archivos en el directorio fuente
  fs.readdirSync(sourceDir).forEach(file => {
    // Ignorar archivos TypeScript, directorios y archivos excluidos
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    const ext = path.extname(file);
    
    if (fs.statSync(sourcePath).isFile() && 
        validExtensions.includes(ext) && 
        !excludedFiles.includes(file)) {
      // Copiar el archivo
      copyFile(sourcePath, targetPath);
    }
  });
  
  console.log('Sincronización inicial completa!');
}

// Función para observar cambios
function watchModularFiles() {
  console.log('Observando cambios en src/in_game...');
  
  fs.watch(sourceDir, (eventType, filename) => {
    if (!filename) return;
    
    const ext = path.extname(filename);
    
    // Solo procesar archivos HTML y JS (no TypeScript) que no estén excluidos
    if (validExtensions.includes(ext) && 
        ext !== '.ts' && 
        !excludedFiles.includes(filename)) {
      const sourcePath = path.join(sourceDir, filename);
      const targetPath = path.join(targetDir, filename);
      
      // Verificar que el archivo existe antes de copiarlo (puede ser un evento de eliminación)
      if (fs.existsSync(sourcePath)) {
        copyFile(sourcePath, targetPath);
      }
    }
  });
}

// Ejecutar sincronización inicial
syncModularFiles();

// Iniciar el observador si no estamos en modo build
if (process.argv.includes('--watch')) {
  watchModularFiles();
} 