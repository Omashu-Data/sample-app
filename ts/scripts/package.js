const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Crear directorio scripts si no existe
if (!fs.existsSync(path.join(__dirname))) {
  fs.mkdirSync(path.join(__dirname), { recursive: true });
}

// Obtener información del package.json
const packageJson = require('../package.json');
const appName = packageJson.name;
const version = packageJson.version;

// Nombre del archivo OPK
const opkFileName = `${appName}-${version}.opk`;
const opkPath = path.join(__dirname, '..', opkFileName);

// Crear un stream de escritura para el archivo OPK
const output = fs.createWriteStream(opkPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Nivel de compresión máximo
});

// Escuchar eventos del stream
output.on('close', () => {
  console.log(`Archivo OPK creado: ${opkFileName}`);
  console.log(`Tamaño: ${archive.pointer()} bytes`);
});

archive.on('error', (err) => {
  throw err;
});

// Conectar el archivo al stream
archive.pipe(output);

// Añadir el directorio dist al archivo
archive.directory(path.join(__dirname, '..', 'dist'), false);

// Finalizar el archivo
archive.finalize(); 