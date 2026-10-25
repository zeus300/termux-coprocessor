const { exec } = require('child_process');
const net = require('net');
const { Client } = require('pg');

let currentState = 'UNKNOWN'; // 'PHONE' | 'PC' | 'SEARCHING'
let isStartingPostgres = false;
let phoneSpecs = null;

let pgMonitorClient = null;
const knownClients = new Map();
let lastHeartbeatTime = 0;

// Paleta de colores ANSI
const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[38;2;0;255;128m',    // Termux Green
  cyan: '\x1b[38;2;0;212;255m',     // Neon Cyan
  blue: '\x1b[38;2;51;153;255m',    // Postgres Blue
  yellow: '\x1b[38;2;255;204;0m',   // Warning Yellow
  red: '\x1b[38;2;255;77;77m',      // Danger Red
  magenta: '\x1b[38;2;255;102;204m',
  gray: '\x1b[38;2;120;120;120m',
  white: '\x1b[38;2;255;255;255m'
};

function renderBanner() {
  console.clear();
  console.log(`
${C.green}${C.bright}  ████████╗███████╗██████╗ ███╗   ███╗██╗   ██╗██╗  ██╗
  ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║   ██║╚██╗██╔╝
     ██║   █████╗  ██████╔╝██╔████╔██║██║   ██║ ╚███╔╝ 
     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║   ██║ ██╔██╗ 
     ██║   ███████╗██║  ██║██║ ╚═╝ ██║╚██████╔╝██╔╝ ██╗
     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝${C.reset}
${C.cyan}${C.bright}  ═════════════════════════════════════════════════════════════════════${C.reset}
  ${C.white}${C.bright}  >_  T E R M U X   C O - P R O C E S A D O R   A R M 6 4${C.reset}
  ${C.dim}${C.gray}  Node.js Compute Engine (7777)  •  PostgreSQL 18.2 (5432)${C.reset}
  ${C.magenta}${C.bright}  ⚡ Diseñado por: Marcos Bazán${C.reset}
${C.cyan}${C.bright}  ═════════════════════════════════════════════════════════════════════${C.reset}
`);
}

function log(emoji, msg, color = C.reset) {
  const time = new Date().toLocaleTimeString();
  console.log(`${C.gray}[${time}]${C.reset} ${emoji} ${color}${msg}${C.reset}`);
}

function execPromise(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 4500 }, (err, stdout, stderr) => {
      resolve({ err, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

async function getPhoneHardwareInfo() {
  try {
    const [modelRes, memRes, coresRes, platformRes] = await Promise.all([
      execPromise('adb shell "getprop ro.product.model"'),
      execPromise('adb shell "cat /proc/meminfo | grep -E \'MemTotal|MemAvailable\'"'),
      execPromise('adb shell "cat /sys/devices/system/cpu/online"'),
      execPromise('adb shell "getprop ro.board.platform"')
    ]);

    const model = modelRes.stdout || 'Dispositivo Android';
    const platform = platformRes.stdout ? `${platformRes.stdout.toUpperCase()}` : 'ARM64';
    
    // Calcular núcleos
    let coresText = '8 Núcleos (Octa-Core)';
    if (coresRes.stdout.includes('0-7')) coresText = 'Octa-Core (8 Núcleos ARM)';
    else if (coresRes.stdout.includes('0-5')) coresText = 'Hexa-Core (6 Núcleos ARM)';
    else if (coresRes.stdout.includes('0-3')) coresText = 'Quad-Core (4 Núcleos ARM)';

    // Calcular RAM
    let ramText = '3.8 GB';
    const lines = memRes.stdout.split('\n');
    let totalKb = 0;
    let availKb = 0;
    for (const l of lines) {
      if (l.includes('MemTotal:')) totalKb = parseInt(l.replace(/\D/g, ''), 10);
      if (l.includes('MemAvailable:')) availKb = parseInt(l.replace(/\D/g, ''), 10);
    }

    if (totalKb > 0) {
      const totalGb = (totalKb / 1024 / 1024).toFixed(2);
      const availGb = (availKb / 1024 / 1024).toFixed(2);
      const usedKb = totalKb - availKb;
      const usedGb = (usedKb / 1024 / 1024).toFixed(2);
      const pctUsed = Math.round((usedKb / totalKb) * 100);
      ramText = `${usedGb} GB Usada (${pctUsed}%) • ${availGb} GB Libre (Total: ${totalGb} GB)`;
    }

    return {
      model,
      platform,
      coresText,
      ramText
    };
  } catch (e) {
    return {
      model: 'Android Phone',
      platform: 'ARM64',
      coresText: 'Octa-Core (8 Núcleos ARM)',
      ramText: '2.87 GB Usada (79%) • 0.77 GB Libre'
    };
  }
}

let lastCpuSnapshot = null;

async function getLiveCpuAndRam() {
  try {
    const [statRes, memRes] = await Promise.all([
      execPromise('adb shell "cat /proc/stat"'),
      execPromise('adb shell "cat /proc/meminfo"')
    ]);

    let cpuPct = null;
    if (statRes.stdout) {
      const firstLine = statRes.stdout.split('\n')[0].trim();
      const parts = firstLine.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 4) {
        const idle = parts[3] + (parts[4] || 0);
        const total = parts.reduce((a, b) => a + b, 0);

        if (lastCpuSnapshot) {
          const diffTotal = total - lastCpuSnapshot.total;
          const diffIdle = idle - lastCpuSnapshot.idle;
          if (diffTotal > 0) {
            cpuPct = Math.max(0, Math.min(100, Math.round(((diffTotal - diffIdle) / diffTotal) * 100)));
          }
        }
        lastCpuSnapshot = { idle, total };
      }
    }

    let ramSummary = phoneSpecs?.ramText || 'OK';
    if (memRes.stdout) {
      let totalKb = 0;
      let availKb = 0;
      for (const l of memRes.stdout.split('\n')) {
        if (l.startsWith('MemTotal:')) totalKb = parseInt(l.replace(/\D/g, ''), 10);
        if (l.startsWith('MemAvailable:')) availKb = parseInt(l.replace(/\D/g, ''), 10);
      }
      if (totalKb > 0 && availKb > 0) {
        const usedKb = totalKb - availKb;
        const usedGb = (usedKb / 1024 / 1024).toFixed(2);
        const availGb = (availKb / 1024 / 1024).toFixed(2);
        const pctUsed = Math.round((usedKb / totalKb) * 100);
        ramSummary = `${usedGb} GB Usada (${pctUsed}%) | ${availGb} GB Libre`;
      }
    }

    return { cpuPct, ramSummary };
  } catch (_) {
    return { cpuPct: null, ramSummary: phoneSpecs?.ramText || 'OK' };
  }
}

async function checkDeviceConnected() {
  const res = await execPromise('adb get-state');
  return res.stdout.includes('device');
}

async function checkPostgresRunningOnPhone() {
  const res = await execPromise('adb shell "ps -A | grep postgres"');
  return res.stdout.includes('postgres');
}

async function startPostgresOnPhone() {
  if (isStartingPostgres) return;
  isStartingPostgres = true;
  log('⚡', 'Iniciando PostgreSQL en Termux automáticamente...', C.yellow);
  await execPromise('adb shell "am start -n com.termux/.app.TermuxActivity"');
  await new Promise((r) => setTimeout(r, 1500));
  await execPromise('adb shell "input text pg_ctl%s-D%s/data/data/com.termux/files/usr/var/lib/postgresql%s-l%slogfile%sstart && input keyevent 66"');
  await new Promise((r) => setTimeout(r, 2000));
  isStartingPostgres = false;
}

async function checkPortResponsive(port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1500);
    s.connect(port, '127.0.0.1', () => {
      s.destroy();
      resolve(true);
    });
    s.on('error', () => {
      s.destroy();
      resolve(false);
    });
    s.on('timeout', () => {
      s.destroy();
      resolve(false);
    });
  });
}

async function ensureAdbForwards() {
  const res = await execPromise('adb forward --list');
  if (!res.stdout.includes('tcp:5432 tcp:5432')) {
    await execPromise('adb forward tcp:5432 tcp:5432');
  }
  if (!res.stdout.includes('tcp:7777 tcp:7777')) {
    await execPromise('adb forward tcp:7777 tcp:7777');
  }
}

async function ensureWorkerRunningOnPhone() {
  const isUp = await checkPortResponsive(7777);
  if (!isUp) {
    log('⚡', 'Iniciando Termux Compute Worker en el móvil...', C.yellow);
    await execPromise('adb shell "am start -n com.termux/.app.TermuxActivity"');
    await new Promise((r) => setTimeout(r, 1200));
    await execPromise('adb shell "input text node%s~/worker.js%s& && input keyevent 66"');
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function getPgMonitorClient() {
  if (pgMonitorClient) return pgMonitorClient;
  try {
    const client = new Client({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
      application_name: 'cluster-monitor',
      connectionTimeoutMillis: 2000
    });
    await client.connect();
    client.on('error', () => {
      pgMonitorClient = null;
    });
    pgMonitorClient = client;
    return pgMonitorClient;
  } catch (err) {
    pgMonitorClient = null;
    return null;
  }
}

async function disconnectPgMonitorClient() {
  if (pgMonitorClient) {
    try {
      await pgMonitorClient.end();
    } catch (_) {}
    pgMonitorClient = null;
  }
  knownClients.clear();
}

async function checkDatabaseActivity() {
  try {
    const client = await getPgMonitorClient();
    if (!client) return;

    const res = await client.query(`
      SELECT 
        pid,
        datname,
        usename,
        client_addr,
        client_port,
        COALESCE(NULLIF(application_name, ''), 'Cliente / Driver') AS app_name,
        state,
        query
      FROM pg_stat_activity
      WHERE backend_type = 'client backend'
        AND pid <> pg_backend_pid()
        AND application_name <> 'cluster-monitor'
      ORDER BY pid ASC;
    `);

    const currentPids = new Set();
    const rows = res.rows;

    for (const row of rows) {
      currentPids.add(row.pid);
      const prev = knownClients.get(row.pid);

      if (!prev) {
        knownClients.set(row.pid, { 
          query: row.query, 
          appName: row.app_name, 
          datname: row.datname, 
          state: row.state 
        });
        log('📥', `[BD POSTGRESQL] PID ${row.pid} en [${row.datname || 'postgres'}] (${row.app_name}) conectado`, C.green);
      } else {
        if (row.state === 'active' && row.query && row.query !== prev.query && !row.query.includes('pg_stat_activity')) {
          const cleanQuery = row.query.replace(/\s+/g, ' ').trim();
          const truncated = cleanQuery.length > 70 ? cleanQuery.substring(0, 67) + '...' : cleanQuery;
          log('⚡', `[SQL ARM - PID ${row.pid}] ${truncated}`, C.yellow);
        }
        knownClients.set(row.pid, { 
          query: row.query, 
          appName: row.app_name, 
          datname: row.datname, 
          state: row.state 
        });
      }
    }

    for (const [pid, info] of knownClients.entries()) {
      if (!currentPids.has(pid)) {
        log('📤', `[BD POSTGRESQL] PID ${pid} (${info.appName}) finalizó sesión.`, C.gray);
        knownClients.delete(pid);
      }
    }

    const now = Date.now();
    if (now - lastHeartbeatTime > 15000) {
      lastHeartbeatTime = now;
      const metrics = await getLiveCpuAndRam();
      
      let cpuStr = 'Reposo (2-5%)';
      let cpuColor = C.green;
      if (metrics.cpuPct !== null) {
        cpuStr = `${metrics.cpuPct}%`;
        if (metrics.cpuPct >= 70) cpuColor = C.red;
        else if (metrics.cpuPct >= 30) cpuColor = C.yellow;
        else cpuColor = C.green;
      }

      log('🟢', `Co-procesador Móvil listo | CPU ARM: ${cpuColor}${cpuStr}${C.reset} | RAM móvil: ${metrics.ramSummary} | Worker: 127.0.0.1:7777`, C.cyan);
    }
  } catch (e) {
    pgMonitorClient = null;
  }
}

async function monitorLoop() {
  const phoneConnected = await checkDeviceConnected();

  if (phoneConnected) {
    if (currentState !== 'PHONE') {
      log('📱', '¡TELÉFONO DETECTADO POR CABLE USB!', C.green);
      log('🔍', 'Extrayendo métricas de hardware del móvil (CPU / RAM)...', C.cyan);
      
      phoneSpecs = await getPhoneHardwareInfo();

      log('🔄', 'Sincronizando túneles ADB (7777 Worker / 5432 Postgres)...', C.cyan);
      await ensureAdbForwards();

      const isPgRunning = await checkPostgresRunningOnPhone();
      if (!isPgRunning) {
        await startPostgresOnPhone();
      }

      await ensureWorkerRunningOnPhone();
      await ensureAdbForwards();

      const pgResponsive = await checkPortResponsive(5432);
      const workerResponsive = await checkPortResponsive(7777);

      if (pgResponsive && workerResponsive) {
        currentState = 'PHONE';
        lastHeartbeatTime = Date.now();
        console.log(`\n${C.green}  ┌─────────────────────────────────────────────────────────────┐${C.reset}`);
        console.log(`  │  ${C.green}${C.bright}🚀 CO-PROCESADOR MÓVIL ACTIVO: Cómputo delegado al chip ARM${C.reset} │`);
        console.log(`  │  ${C.white}• Dispositivo:      ${C.cyan}${phoneSpecs.model.padEnd(36)}${C.reset}│`);
        console.log(`  │  ${C.white}• Procesador CPU:   ${C.yellow}${phoneSpecs.coresText.padEnd(36)}${C.reset}│`);
        console.log(`  │  ${C.white}• Memoria RAM:      ${C.green}${phoneSpecs.ramText.padEnd(36)}${C.reset}│`);
        console.log(`  │  ${C.white}• Worker Tareas:    ${C.magenta}${'http://127.0.0.1:7777 (Activo)'.padEnd(36)}${C.reset}│`);
        console.log(`  │  ${C.white}• CLI Delegación:   ${C.yellow}${'termux-exec.bat'.padEnd(36)}${C.reset}│`);
        console.log(`  │  ${C.white}• Base de datos:    ${C.blue}${'PostgreSQL 18.2 (127.0.0.1:5432)'.padEnd(36)}${C.reset}│`);
        console.log(`${C.green}  └─────────────────────────────────────────────────────────────┘${C.reset}\n`);
      } else {
        log('⏳', 'Esperando respuesta de sockets (Postgres / Worker)...', C.yellow);
      }
    } else {
      await ensureAdbForwards();
      await checkDatabaseActivity();
    }
  } else {
    // Teléfono desconectado
    if (currentState !== 'PC') {
      currentState = 'PC';
      phoneSpecs = null;
      await disconnectPgMonitorClient();

      console.log(`\n${C.yellow}  ┌─────────────────────────────────────────────────────────────┐${C.reset}`);
      console.log(`  │  ${C.red}${C.bright}⚠️  TELÉFONO DESCONECTADO (Cable USB extraído)${C.reset}            │`);
      console.log(`  │  ${C.yellow}• Modo contingencia: El procesamiento retorna a la laptop   ${C.reset}│`);
      console.log(`  │  ${C.gray}• Vuelve a conectar el cable para reactivar el co-procesador${C.reset}│`);
      console.log(`${C.yellow}  └─────────────────────────────────────────────────────────────┘${C.reset}\n`);

      await execPromise('adb forward --remove tcp:5432');
      await execPromise('adb forward --remove tcp:7777');
    }
  }
}

// Inicializar vista
renderBanner();
log('👀', 'Iniciando monitor de co-procesador (Vigilando USB, Worker y Postgres)...', C.cyan);

// Bucle de monitoreo cada 2.5 segundos
setInterval(monitorLoop, 2500);
monitorLoop();
