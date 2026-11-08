const { exec } = require('child_process');
const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

let currentState = 'UNKNOWN'; // 'PHONE' | 'PC'
let pgMonitorClient = null;
const knownClients = new Map();
let lastHeartbeatTime = 0;
let lastSeenWorkerTaskId = 0;
let lastKnownAuditId = 0;

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
  ${C.dim}${C.gray}  Node.js Compute Engine (7777)  •  PostgreSQL 18.2 Híbrido (5432)${C.reset}
  ${C.green}${C.bright}  ⚡ Modo Pasivo Eficiente (0% CPU en PC - Cero Procesos en Bucle)${C.reset}
${C.cyan}${C.bright}  ═════════════════════════════════════════════════════════════════════${C.reset}
`);
}

function log(emoji, msg, color = C.reset) {
  const time = new Date().toLocaleTimeString();
  console.log(`${C.gray}[${time}]${C.reset} ${emoji} ${color}${msg}${C.reset}`);
}

function ensureAdbForwards() {
  return new Promise((resolve) => {
    exec('adb forward tcp:7777 tcp:7777 && adb forward tcp:5432 tcp:5432', { timeout: 3000 }, (err) => {
      resolve(!err);
    });
  });
}

function fetchWorkerStatus(sinceId = 0) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:7777/status?since=${sinceId}`, { timeout: 2000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          resolve(parsed && parsed.status === 'ONLINE' ? parsed : null);
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function getPgMonitorClient() {
  if (pgMonitorClient) return pgMonitorClient;
  try {
    const client = new Client({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
      application_name: 'cluster-monitor-passive',
      connectionTimeoutMillis: 2000
    });
    await client.connect();
    client.on('error', () => {
      pgMonitorClient = null;
    });

    const maxRes = await client.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM gds_seguridad.hybrid_compute_audit').catch(() => ({ rows: [] }));
    if (lastKnownAuditId === 0 && maxRes.rows && maxRes.rows[0]) {
      lastKnownAuditId = Number(maxRes.rows[0].max_id) || 0;
    }

    pgMonitorClient = client;
    return pgMonitorClient;
  } catch (_) {
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
        AND application_name <> 'cluster-monitor-passive'
      ORDER BY pid ASC;
    `);

    const currentPids = new Set();
    for (const row of res.rows) {
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
          log('⚡', `[SQL ARM - ${row.app_name}] ${truncated}`, C.yellow);
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

    const auditRes = await client.query(
      'SELECT id, project_name, task_label, duration_ms FROM gds_seguridad.hybrid_compute_audit WHERE id > $1 ORDER BY id ASC LIMIT 5',
      [lastKnownAuditId]
    ).catch(() => ({ rows: [] }));

    for (const a of auditRes.rows) {
      lastKnownAuditId = Math.max(lastKnownAuditId, Number(a.id));
      log('🗄️', `[PG 18.2 ARM • ${a.project_name}] Audit #${a.id}: ${a.task_label} (${a.duration_ms}ms)`, C.blue);
    }
  } catch (_) {
    pgMonitorClient = null;
  }
}

async function monitorLoop() {
  const workerStatus = await fetchWorkerStatus(lastSeenWorkerTaskId);

  if (workerStatus && workerStatus.status === 'ONLINE') {
    if (currentState !== 'PHONE') {
      currentState = 'PHONE';
      lastHeartbeatTime = Date.now();
      if (workerStatus.stats && workerStatus.stats.lastTaskId) {
        lastSeenWorkerTaskId = workerStatus.stats.lastTaskId;
      }
      await getPgMonitorClient();

      console.log(`\n${C.green}  ┌─────────────────────────────────────────────────────────────┐${C.reset}`);
      console.log(`  │  ${C.green}${C.bright}🚀 CO-PROCESADOR MÓVIL ENLAZADO (0% Carga en PC)${C.reset}            │`);
      console.log(`  │  ${C.white}• Dispositivo:      ${C.cyan}${String(workerStatus.device).padEnd(36)}${C.reset}│`);
      console.log(`  │  ${C.white}• Procesador CPU:   ${C.yellow}${String(workerStatus.model).padEnd(36)}${C.reset}│`);
      console.log(`  │  ${C.white}• Memoria RAM:      ${C.green}${(`${workerStatus.ramUsedMb || 0} MB Usada | ${workerStatus.ramFreeMb || 0} MB Libre`).padEnd(36)}${C.reset}│`);
      console.log(`  │  ${C.white}• Worker Tareas:    ${C.magenta}${'http://127.0.0.1:7777 (Activo)'.padEnd(36)}${C.reset}│`);
      console.log(`  │  ${C.white}• Base de datos:    ${C.blue}${'PostgreSQL 18.2 (127.0.0.1:5432)'.padEnd(36)}${C.reset}│`);
      console.log(`  │  ${C.white}• Estado:           ${C.green}${'En reposo (Listo para tareas reales)'.padEnd(36)}${C.reset}│`);
      console.log(`${C.green}  └─────────────────────────────────────────────────────────────┘${C.reset}\n`);
    }

    // Monitorear si entraron tareas bajo demanda enviadas por termux-exec o scripts reales
    if (Array.isArray(workerStatus.recentTasks) && workerStatus.recentTasks.length > 0) {
      for (const t of workerStatus.recentTasks) {
        if (t.id > lastSeenWorkerTaskId) {
          lastSeenWorkerTaskId = t.id;
          const statusColor = t.success ? C.green : C.red;
          const previewText = t.preview ? ` ➔ ${C.white}${t.preview}${C.reset}` : '';
          log('🔥', `[ARM64 #${t.id} • ${t.project}] ${t.label} (${t.durationMs}ms)${previewText}`, statusColor);
        }
      }
    }
    if (workerStatus.stats && workerStatus.stats.lastTaskId > lastSeenWorkerTaskId) {
      lastSeenWorkerTaskId = workerStatus.stats.lastTaskId;
    }

    await checkDatabaseActivity();

    // Heartbeat ligero cada 30 segundos
    const now = Date.now();
    if (now - lastHeartbeatTime > 30000) {
      lastHeartbeatTime = now;
      log('🟢', `Enlace Co-Procesador OK | CPU ARM: ${workerStatus.cpuPct || 5}% | RAM Libre: ${workerStatus.ramFreeMb} MB | Tareas ejecutadas: ${workerStatus.stats?.totalTasksRun || 0}`, C.cyan);
    }
  } else {
    // Si el worker no respondió por HTTP, verificar túnel ADB una sola vez
    if (currentState === 'PHONE') {
      currentState = 'PC';
      await disconnectPgMonitorClient();
      console.log(`\n${C.yellow}  ┌─────────────────────────────────────────────────────────────┐${C.reset}`);
      console.log(`  │  ${C.red}${C.bright}⚠️  TELÉFONO EN REPOSO O DESCONECTADO${C.reset}                        │`);
      console.log(`  │  ${C.yellow}• Esperando reconexión por cable USB / ADB                  ${C.reset}│`);
      console.log(`${C.yellow}  └─────────────────────────────────────────────────────────────┘${C.reset}\n`);
    }
    await ensureAdbForwards();
  }
}

// Inicializar vista limpia
renderBanner();
log('👀', 'Iniciando monitor pasivo (Sondeo HTTP cada 8s, 0% CPU en Windows)...', C.cyan);

ensureAdbForwards().then(() => {
  monitorLoop();
  // Sondeo espaciado a 8 segundos para consumo 0% absoluto de CPU
  setInterval(monitorLoop, 8000);
});
