// Termux ARM Compute Worker v3.1 (Direct Terminal Screen Output & Live HUD)
// Escucha en el puerto 7777, ejecuta tareas reales delegadas desde la PC y muestra todo en vivo en la pantalla de Termux
const http = require('http');
const { exec, execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Ignorar SIGHUP para no necesitar redirección nohup y mantener stdout conectado a la pantalla de Termux
process.on('SIGHUP', () => {});

const PORT = 7777;
const HOME_DIR = process.env.HOME || '/data/data/com.termux/files/home';
const TASKS_DIR = path.join(HOME_DIR, 'tasks');
const LOG_FILE = path.join(HOME_DIR, 'worker.log');

if (!fs.existsSync(TASKS_DIR)) {
  try { fs.mkdirSync(TASKS_DIR, { recursive: true }); } catch (_) {}
}

// Paleta ANSI para la pantalla de Termux en el celular
const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[38;2;0;255;128m',
  cyan: '\x1b[38;2;0;212;255m',
  blue: '\x1b[38;2;51;153;255m',
  yellow: '\x1b[38;2;255;204;0m',
  red: '\x1b[38;2;255;77;77m',
  magenta: '\x1b[38;2;255;102;204m',
  gray: '\x1b[38;2;130;130;130m',
  white: '\x1b[38;2;255;255;255m'
};

// Descubrir todos los descriptores de terminal activa en Termux (/proc/<bash_pid>/fd/1 y /dev/pts/0)
function getActiveTerminalFds() {
  const targets = new Set();
  if (process.ppid) {
    targets.add(`/proc/${process.ppid}/fd/1`);
  }
  try {
    const out = execSync('pgrep -x bash', { encoding: 'utf-8', timeout: 500 });
    for (const pid of out.split(/\s+/).filter(Boolean)) {
      targets.add(`/proc/${pid}/fd/1`);
    }
  } catch (_) {}
  return Array.from(targets);
}

let cachedTtyTargets = getActiveTerminalFds();
setInterval(() => {
  cachedTtyTargets = getActiveTerminalFds();
}, 10000);

// Escribir directamente en la pantalla física de Termux sin usar fs.existsSync('/dev/pts/0') (bloqueado por SELinux stat)
function printToPhoneScreen(msg) {
  const line = msg + '\n';
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (_) {}

  let wroteToTty = false;
  for (const fdPath of cachedTtyTargets) {
    try {
      fs.appendFileSync(fdPath, line);
      wroteToTty = true;
    } catch (_) {}
  }

  if (!wroteToTty) {
    try {
      fs.appendFileSync('/dev/pts/0', line);
      wroteToTty = true;
    } catch (_) {}
  }

  if (!wroteToTty) {
    try {
      process.stdout.write(line);
    } catch (_) {}
  }
}

function phoneLog(emoji, tag, text, color = C.green) {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  printToPhoneScreen(`${C.gray}[${timeStr}]${C.reset} ${emoji} ${C.bright}${color}[${tag}]${C.reset} ${C.white}${text}${C.reset}`);
}

// Estado y telemetría real en memoria de tareas ejecutadas en el chip ARM
let taskCounter = 0;
let activeTasks = 0;
let totalDurationMs = 0;
let totalBytesProcessed = 0;
const recentTasks = [];
let lastCpuStat = null;

function getRealCpuPct() {
  try {
    const stat = fs.readFileSync('/proc/stat', 'utf-8').split('\n')[0].trim();
    const parts = stat.split(/\s+/).slice(1).map(Number);
    if (parts.length >= 4) {
      const idle = parts[3] + (parts[4] || 0);
      const total = parts.reduce((a, b) => a + b, 0);
      let pct = 8;
      if (lastCpuStat) {
        const dTotal = total - lastCpuStat.total;
        const dIdle = idle - lastCpuStat.idle;
        if (dTotal > 0) {
          pct = Math.max(1, Math.min(100, Math.round(((dTotal - dIdle) / dTotal) * 100)));
        }
      }
      lastCpuStat = { idle, total };
      return pct;
    }
  } catch (_) {}
  return 5;
}

function getRealMemoryMb() {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8');
    let totalKb = 0;
    let availKb = 0;
    for (const line of meminfo.split('\n')) {
      if (line.startsWith('MemTotal:')) totalKb = parseInt(line.replace(/\D/g, ''), 10);
      if (line.startsWith('MemAvailable:')) availKb = parseInt(line.replace(/\D/g, ''), 10);
    }
    if (totalKb > 0) {
      const usedKb = totalKb - availKb;
      return {
        ramTotalMb: (totalKb / 1024).toFixed(0),
        ramFreeMb: (availKb / 1024).toFixed(0),
        ramUsedMb: (usedKb / 1024).toFixed(0),
        ramPct: Math.round((usedKb / totalKb) * 100)
      };
    }
  } catch (_) {}
  const total = os.totalmem() / 1024 / 1024;
  const free = os.freemem() / 1024 / 1024;
  return {
    ramTotalMb: total.toFixed(0),
    ramFreeMb: free.toFixed(0),
    ramUsedMb: (total - free).toFixed(0),
    ramPct: Math.round(((total - free) / total) * 100)
  };
}

function recordTask(entry) {
  recentTasks.push(entry);
  if (recentTasks.length > 50) {
    recentTasks.shift();
  }
}

function renderPhoneBanner() {
  const mem = getRealMemoryMb();
  const banner = [
    '\x1b[2J\x1b[H',
    `${C.green}${C.bright}========================================================${C.reset}`,
    `${C.cyan}${C.bright}⚡ CO-PROCESADOR ARM64 ACTIVO (ENLACE REAL CON PC)${C.reset}`,
    `${C.white}• Chip:       Snapdragon 662 (8 Núcleos ARM64 • ${process.arch})${C.reset}`,
    `${C.white}• RAM Móvil:  ${mem.ramUsedMb}/${mem.ramTotalMb} MB (${mem.ramPct}%) | Libre: ${mem.ramFreeMb} MB${C.reset}`,
    `${C.white}• Servicios:  Worker HTTP :7777  |  PostgreSQL 18.2 :5432${C.reset}`,
    `${C.magenta}• Proyectos:  GD Segurity SAC • Master Hub • Dataxperu${C.reset}`,
    `${C.green}${C.bright}========================================================${C.reset}`,
    `${C.yellow}📡 Recibiendo transferencia continua de cómputo desde PC...${C.reset}\n`
  ].join('\n');
  printToPhoneScreen(banner);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Endpoint de Salud / Estado del móvil y cola de tareas
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/health') || req.url.startsWith('/status') || req.url.startsWith('/tasks'))) {
    const mem = getRealMemoryMb();
    const cpuPct = getRealCpuPct();
    const urlObj = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const sinceId = parseInt(urlObj.searchParams.get('since') || '0', 10);
    const newTasks = sinceId > 0 ? recentTasks.filter(t => t.id > sinceId) : recentTasks.slice(-10);

    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ONLINE',
      version: '3.1.0',
      device: 'Moto G(9) Play (ARM64)',
      arch: process.arch,
      cpus: 8,
      cpuPct,
      model: 'Qualcomm Snapdragon 662 (Kryo 260 Octa-Core ARM64)',
      ramFreeMb: mem.ramFreeMb,
      ramTotalMb: mem.ramTotalMb,
      ramUsedMb: mem.ramUsedMb,
      ramPct: mem.ramPct,
      uptimeSeconds: os.uptime(),
      nodeVersion: process.version,
      stats: {
        totalTasksRun: taskCounter,
        activeTasks,
        totalComputeTimeMs: totalDurationMs,
        totalBytesProcessed,
        lastTaskId: taskCounter
      },
      recentTasks: newTasks
    }, null, 2));
    return;
  }

  // 2. Endpoint de Ejecución de Tareas en CPU ARM
  if (req.method === 'POST' && req.url === '/run') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const rawBuf = Buffer.concat(chunks);
        totalBytesProcessed += rawBuf.length;
        const body = rawBuf.toString('utf-8');
        const payload = JSON.parse(body || '{}');
        let command = payload.command;
        const project = payload.project || 'PC-Host';
        const label = payload.label || command || payload.scriptName || 'task';

        if (payload.scriptContent && payload.scriptName) {
          const isModule = Boolean(payload.isModule);
          let safeName = path.basename(payload.scriptName);
          if (isModule && safeName.endsWith('.js')) {
            safeName = safeName.slice(0, -3) + '.mjs';
          }
          const targetPath = path.join(TASKS_DIR, safeName);
          fs.writeFileSync(targetPath, payload.scriptContent, 'utf-8');

          const escapedArgs = Array.isArray(payload.scriptArgs)
            ? payload.scriptArgs.map(a => `"${String(a).replace(/"/g, '\\"')}"`).join(' ')
            : '';
          command = `node "${targetPath}" ${escapedArgs}`.trim();
        }

        if (!command) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Falta el campo "command" o "scriptContent"' }));
          return;
        }

        const taskId = ++taskCounter;
        activeTasks++;
        const startTime = Date.now();
        const memBefore = getRealMemoryMb();
        const cpuBefore = getRealCpuPct();

        // Mostrar en vivo en la pantalla del celular la recepción del paquete desde la PC
        phoneLog(
          '📥',
          `PC ➔ MÓVIL #${taskId}`,
          `${C.cyan}${project}${C.white} • ${label} ${C.gray}(${rawBuf.length}B | CPU:${cpuBefore}% | Libre:${memBefore.ramFreeMb}MB)${C.reset}`,
          C.cyan
        );

        const execEnv = {
          ...process.env,
          ...(payload.env && typeof payload.env === 'object' ? payload.env : {}),
          TERMUX_ARM_WORKER: '1',
          TERMUX_PROJECT: project
        };

        exec(command, {
          timeout: payload.timeout || 60000,
          maxBuffer: 15 * 1024 * 1024,
          cwd: payload.cwd || TASKS_DIR,
          env: execEnv
        }, (err, stdout, stderr) => {
          activeTasks = Math.max(0, activeTasks - 1);
          const durationMs = Date.now() - startTime;
          totalDurationMs += durationMs;
          const exitCode = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
          const outText = (stdout || '').trim();
          const outBytes = Buffer.byteLength(stdout || '') + Buffer.byteLength(stderr || '');
          totalBytesProcessed += outBytes;

          const firstLine = outText.split('\n').filter(Boolean)[0] || 'OK';
          const shortPreview = firstLine.length > 58 ? firstLine.substring(0, 55) + '...' : firstLine;

          const taskRecord = {
            id: taskId,
            project,
            label: String(label).substring(0, 100),
            preview: shortPreview,
            durationMs,
            bytes: rawBuf.length + outBytes,
            exitCode,
            success: !err,
            timestamp: new Date().toISOString()
          };
          recordTask(taskRecord);

          // Mostrar en vivo en la pantalla del celular el resultado procesado y devuelto a la PC
          phoneLog(
            err ? '❌' : '📤',
            `MÓVIL ➔ PC #${taskId}`,
            `${C.green}${durationMs}ms${C.white} • ${shortPreview}`,
            err ? C.red : C.green
          );

          res.writeHead(200);
          res.end(JSON.stringify({
            success: !err,
            taskId,
            project,
            arch: process.arch,
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
  renderPhoneBanner();
});
