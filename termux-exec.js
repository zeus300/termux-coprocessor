const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 7777;
const HOST = '127.0.0.1';

// Asegurar que el túnel ADB esté activo
function ensureTunnel() {
  try {
    const list = execSync('adb forward --list', { encoding: 'utf-8' });
    if (!list.includes(`tcp:${PORT} tcp:${PORT}`)) {
      execSync(`adb forward tcp:${PORT} tcp:${PORT}`);
    }
  } catch (err) {
    console.error('❌ Error asegurando el túnel ADB:', err.message);
  }
}

function requestWorker(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    ensureTunnel();
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: endpoint,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      },
      timeout: 60000
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (_) {
          resolve({ raw });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout de 60s superado en el móvil'));
    });

    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);

  // Si no hay argumentos, mostrar estado del procesador móvil
  if (args.length === 0) {
    try {
      const status = await requestWorker('/status');
      console.log('\n=============================================================');
      console.log('📱 CO-PROCESADOR MÓVIL TERMUX (ARM64) ACTIVO');
      console.log('=============================================================');
      console.log(`• Dispositivo:      ${status.device}`);
      console.log(`• Procesador:       ${status.model} (ARM64)`);
      const totalMb = parseFloat(status.ramTotalMb || 3800);
      const freeMb = parseFloat(status.ramFreeMb || 750);
      const usedMb = Math.max(0, totalMb - freeMb);
      const usedGb = (usedMb / 1024).toFixed(2);
      const freeGb = (freeMb / 1024).toFixed(2);
      const totalGb = (totalMb / 1024).toFixed(2);
      const pctUsed = Math.round((usedMb / totalMb) * 100);
      console.log(`• Memoria RAM:      ${usedGb} GB Usados (${pctUsed}%) | ${freeGb} GB Libres (Total: ${totalGb} GB)`);
      console.log(`• Node.js en Móvil: ${status.nodeVersion}`);
      console.log(`• Tiempo Activo:    ${Math.floor(status.uptimeSeconds / 3600)} horas`);
      console.log('=============================================================');
      console.log('💡 Uso:');
      console.log('  termux-exec "comando a ejecutar en el móvil"');
      console.log('  termux-exec ruta/a/archivo.js (para correr un script local en el chip ARM)\n');
    } catch (e) {
      console.error('❌ No se pudo conectar al Worker del móvil:', e.message);
    }
    return;
  }

  const target = args.join(' ');

  // Caso 1: Es un archivo local existente que se quiere enviar al móvil para correrlo
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    const filename = path.basename(target);
    const code = fs.readFileSync(target, 'utf-8');
    console.log(`\n📤 Enviando script [${filename}] a la CPU ARM del celular...`);

    // Escribir el archivo en el móvil y ejecutarlo con node
    const base64Code = Buffer.from(code).toString('base64');
    const writeAndRunCmd = `mkdir -p ~/tasks && echo "${base64Code}" | base64 -d > ~/tasks/${filename} && node ~/tasks/${filename}`;

    const res = await requestWorker('/run', 'POST', { command: writeAndRunCmd });

    if (res.stdout) console.log(res.stdout);
    if (res.stderr) console.error(res.stderr);
    console.log(`\n⚡ [CPU ARM]: Completado en ${res.durationMs}ms (Código de salida: ${res.exitCode})\n`);
    process.exit(res.exitCode);
  }

  // Caso 2: Es un comando directo de terminal
  console.log(`\n🚀 Delegando comando al procesador ARM: "${target}"`);
  try {
    const res = await requestWorker('/run', 'POST', { command: target });
    if (res.stdout) console.log(res.stdout);
    if (res.stderr) console.error(res.stderr);
    console.log(`\n⚡ [CPU ARM]: Ejecutado en ${res.durationMs}ms (Código: ${res.exitCode})\n`);
    process.exit(res.exitCode);
  } catch (err) {
    console.error('❌ Error ejecutando en el móvil:', err.message);
    process.exit(1);
  }
}

main();
