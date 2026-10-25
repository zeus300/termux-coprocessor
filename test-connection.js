// Script rápido en Node.js para probar la conexión TCP al puerto 5432
const net = require('net');

const HOST = '127.0.0.1';
const PORT = 5432;

console.log(`🔌 Probando socket TCP en ${HOST}:${PORT}...`);

const socket = new net.Socket();
socket.setTimeout(3000);

socket.connect(PORT, HOST, () => {
  console.log(`✅ ¡Conexión exitosa a ${HOST}:${PORT}! El forward de ADB y PostgreSQL están respondiendo.`);
  socket.destroy();
});

socket.on('error', (err) => {
  console.error(`❌ Error al conectar a ${HOST}:${PORT}:`, err.message);
  console.log(`💡 Pista: Verifica que el servicio de Postgres esté iniciado en Termux:`);
  console.log(`   pg_ctl -D $PREFIX/var/lib/postgresql start`);
});

socket.on('timeout', () => {
  console.error(`⏱️ Timeout de conexión a ${HOST}:${PORT}.`);
  socket.destroy();
});
