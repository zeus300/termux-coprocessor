// Termux ARM Compute Worker (Micro-Daemon)
// Escucha en el puerto 7777 y ejecuta tareas delegadas desde la PC
const http = require('http');
const { exec } = require('child_process');
const os = require('os');

const PORT = 7777;

const server = http.createServer((req, res) => {
  // CORS para permitir peticiones locales
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Endpoint de Salud / Estado del móvil
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health' || req.url === '/status')) {
    const memFree = (os.freemem() / 1024 / 1024).toFixed(1);
    const memTotal = (os.totalmem() / 1024 / 1024).toFixed(1);
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ONLINE',
      device: 'Moto G(9) Play (ARM64)',
      cpus: os.cpus().length,
      model: os.cpus()[0]?.model || 'Qualcomm Kryo ARM',
      ramFreeMb: memFree,
      ramTotalMb: memTotal,
      uptimeSeconds: os.uptime(),
      nodeVersion: process.version
    }, null, 2));
    return;
  }

  // 2. Endpoint de Ejecución de Tareas en CPU ARM
  if (req.method === 'POST' && req.url === '/run') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const command = payload.command;

        if (!command) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Falta el campo "command"' }));
          return;
        }

        const startTime = Date.now();
        console.log(`[WORKER] 🚀 Ejecutando comando delegado: ${command}`);

        exec(command, { 
          timeout: payload.timeout || 60000, 
          maxBuffer: 10 * 1024 * 1024,
          cwd: payload.cwd || process.env.HOME 
        }, (err, stdout, stderr) => {
          const durationMs = Date.now() - startTime;
          const exitCode = err ? (err.code || 1) : 0;

          console.log(`[WORKER] ✅ Tarea completada en ${durationMs}ms (Código: ${exitCode})`);

          res.writeHead(200);
          res.end(JSON.stringify({
            success: !err,
            exitCode,
            durationMs,
            stdout: stdout || '',
            stderr: stderr || '',
            error: err ? err.message : null
          }));
        });
      } catch (parseErr) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'JSON inválido: ' + parseErr.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================================`);
  console.log(`⚡ TERMUX COMPUTE WORKER ACTIVO EN PUERTO ${PORT}`);
  console.log(`   Procesador ARM listo para recibir tareas de la laptop`);
  console.log(`========================================================\n`);
});
