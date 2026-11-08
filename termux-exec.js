const http = require('http');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const PORT = 7777;
const HOST = '127.0.0.1';

// Detectar proyecto origen automáticamente según directorio actual o ruta del script
function detectProjectContext(scriptPath = '') {
  const cwd = process.cwd();
  const fullRef = `${cwd} ${scriptPath}`.toLowerCase();
  if (fullRef.includes('gd segurity') || fullRef.includes('gdsegurity') || fullRef.includes('appsecuritypro')) {
    return { name: 'GD Segurity SAC', appName: 'gd-segurity-sac', dir: 'c:\\Proyectos\\GD Segurity SAC' };
  }
  if (fullRef.includes('saas-master-hub')) {
    return { name: 'SaaS Master Hub', appName: 'saas-master-hub', dir: 'c:\\Proyectos\\SaaS-Master-Hub-main' };
  }
  if (fullRef.includes('dataxperu')) {
    return { name: 'Dataxperu.com', appName: 'dataxperu', dir: 'c:\\Proyectos\\Dataxperu.com' };
  }
  if (fullRef.includes('negocioerp')) {
    return { name: 'NegocioERP', appName: 'negocio-erp', dir: 'c:\\Proyectos\\NegocioERP' };
  }
  // Intentar leer package.json del cwd
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) {
        return { name: pkg.name, appName: pkg.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-'), dir: cwd };
      }
    }
  } catch (_) {}
  return { name: path.basename(cwd) || 'Termux-Client', appName: 'termux-client', dir: cwd };
}

// Cargar variables .env del proyecto para inyectarlas en la ejecución ARM
function loadProjectEnv(projectDir) {
  const envVars = {};
  const candidates = [
    path.join(process.cwd(), '.env'),
    projectDir ? path.join(projectDir, '.env') : null
  ].filter(Boolean);

  for (const envFile of candidates) {
    if (fs.existsSync(envFile)) {
      try {
        const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
        for (const line of lines) {
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            let val = (match[2] || '').trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            envVars[match[1]] = val;
          }
        }
        break;
      } catch (_) {}
    }
  }
  return envVars;
}

// Asegurar que los túneles ADB estén activos (7777 Worker + 5432 Postgres)
function ensureTunnel() {
  try {
    const list = execSync('adb forward --list', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2500 });
    if (!list.includes(`tcp:${PORT} tcp:${PORT}`)) {
      execSync(`adb forward tcp:${PORT} tcp:${PORT}`, { stdio: 'ignore', timeout: 2500 });
    }
    if (!list.includes('tcp:5432 tcp:5432')) {
      execSync('adb forward tcp:5432 tcp:5432', { stdio: 'ignore', timeout: 2500 });
    }
    return true;
  } catch (_) {
    return false;
  }
}

function requestWorker(endpoint, method = 'GET', body = null, timeoutMs = 60000) {
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
      timeout: timeoutMs
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
      reject(new Error(`Timeout de ${timeoutMs / 1000}s superado en el móvil`));
    });

    if (data) req.write(data);
    req.end();
  });
}

// Registrar auditoría en el PostgreSQL 18.2 de Termux (127.0.0.1:5432)
async function recordSqlAudit(projectCtx, label, durationMs, exitCode, arch = 'arm64') {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
    application_name: projectCtx.appName,
    connectionTimeoutMillis: 1500
  });
  try {
    await client.connect();
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS gds_seguridad;
      CREATE TABLE IF NOT EXISTS gds_seguridad.hybrid_compute_audit (
        id SERIAL PRIMARY KEY,
        project_name TEXT NOT NULL,
        app_name TEXT NOT NULL,
        task_label TEXT NOT NULL,
        arch TEXT DEFAULT 'arm64',
        duration_ms INTEGER DEFAULT 0,
        exit_code INTEGER DEFAULT 0,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(
      `INSERT INTO gds_seguridad.hybrid_compute_audit (project_name, app_name, task_label, arch, duration_ms, exit_code)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [projectCtx.name, projectCtx.appName, String(label).substring(0, 200), arch, durationMs || 0, exitCode || 0]
    );
  } catch (_) {
    // Silencioso si Postgres no está disponible en ese instante
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

// Contingencia local en la laptop (Failover si el teléfono está desconectado)
function runLocalFailover(isFile, filePath, fileArgs, rawCommand) {
  console.log(`\n⚠️ [FAILOVER CONTINGENCIA PC]: Móvil no disponible, ejecutando localmente en la laptop...`);
  const start = Date.now();
  if (isFile) {
    const res = spawnSync(process.execPath, [filePath, ...fileArgs], { stdio: 'inherit', env: process.env });
    console.log(`\n💻 [PC FAILOVER]: Completado en ${Date.now() - start}ms (Código: ${res.status ?? 0})\n`);
    process.exit(res.status ?? 0);
  } else {
    try {
      execSync(rawCommand, { stdio: 'inherit', env: process.env });
      console.log(`\n💻 [PC FAILOVER]: Completado en ${Date.now() - start}ms (Código: 0)\n`);
      process.exit(0);
    } catch (err) {
      process.exit(err.status || 1);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  // Si no hay argumentos, mostrar estado del procesador móvil + estadísticas de proyectos
  if (args.length === 0) {
    try {
      const status = await requestWorker('/status', 'GET', null, 4000);
      console.log('\n=============================================================');
      console.log('📱 CO-PROCESADOR MÓVIL TERMUX (ARM64) ACTIVO - v' + (status.version || '2.0'));
      console.log('=============================================================');
      console.log(`• Dispositivo:      ${status.device}`);
      console.log(`• Procesador:       ${status.model}`);
      const totalMb = parseFloat(status.ramTotalMb || 3725);
      const freeMb = parseFloat(status.ramFreeMb || 950);
      const usedMb = Math.max(0, totalMb - freeMb);
      const usedGb = (usedMb / 1024).toFixed(2);
      const freeGb = (freeMb / 1024).toFixed(2);
      const totalGb = (totalMb / 1024).toFixed(2);
      const pctUsed = Math.round((usedMb / totalMb) * 100);
      console.log(`• Memoria RAM:      ${usedGb} GB Usados (${pctUsed}%) | ${freeGb} GB Libres (Total: ${totalGb} GB)`);
      console.log(`• Node.js en Móvil: ${status.nodeVersion} (${status.arch || 'arm64'})`);
      console.log(`• Tiempo Activo:    ${Math.floor(status.uptimeSeconds / 3600)} horas`);
      if (status.stats) {
        console.log(`• Tareas ARM Hoy:   ${status.stats.totalTasksRun} ejecutadas (${status.stats.totalComputeTimeMs}ms cómputo ARM)`);
      }
      console.log('=============================================================');
      console.log('💡 Uso:');
      console.log('  termux-exec "comando a ejecutar en el móvil"');
      console.log('  termux-exec ruta/a/archivo.mjs [arg1 arg2] (corre en el chip ARM con soporte ESM y .env)\n');
    } catch (e) {
      console.error('❌ No se pudo conectar al Worker del móvil:', e.message);
    }
    return;
  }

  const firstArg = args[0];
  const extraArgs = args.slice(1);
  const fullTarget = args.join(' ');

  // Determinar si el primer argumento (o el argumento completo) es un archivo local existente
  let localFile = null;
  let scriptArgs = [];
  if (fs.existsSync(firstArg) && fs.statSync(firstArg).isFile()) {
    localFile = path.resolve(firstArg);
    scriptArgs = extraArgs;
  } else if (fs.existsSync(fullTarget) && fs.statSync(fullTarget).isFile()) {
    localFile = path.resolve(fullTarget);
    scriptArgs = [];
  }

  const projectCtx = detectProjectContext(localFile || fullTarget);
  const projectEnv = loadProjectEnv(projectCtx.dir);

  // Caso 1: Es un archivo de script local (.js / .mjs) que se quiere enviar al chip ARM
  if (localFile) {
    const filename = path.basename(localFile);
    const code = fs.readFileSync(localFile, 'utf-8');
    const isModule = filename.endsWith('.mjs') || /^\s*(import|export)\s+/m.test(code);
    const label = `${filename}${scriptArgs.length ? ' ' + scriptArgs.join(' ') : ''}`;

    console.log(`\n📤 [${projectCtx.name}] Enviando script [${label}] a la CPU ARM64 del celular...`);

    try {
      const res = await requestWorker('/run', 'POST', {
        project: projectCtx.name,
        label,
        scriptName: filename,
        scriptContent: code,
        scriptArgs,
        isModule,
        env: projectEnv
      });

      if (res.stdout) console.log(res.stdout.trimEnd());
      if (res.stderr) console.error(res.stderr.trimEnd());
      await recordSqlAudit(projectCtx, label, res.durationMs, res.exitCode, res.arch || 'arm64');
      console.log(`\n⚡ [CPU ARM64 • ${projectCtx.name}]: Completado en ${res.durationMs}ms (Código de salida: ${res.exitCode})\n`);
      process.exit(res.exitCode || 0);
    } catch (err) {
      runLocalFailover(true, localFile, scriptArgs, fullTarget);
    }
    return;
  }

  // Caso 2: Es un comando directo de terminal
  console.log(`\n🚀 [${projectCtx.name}] Delegando comando al procesador ARM64: "${fullTarget}"`);
  try {
    const res = await requestWorker('/run', 'POST', {
      project: projectCtx.name,
      label: fullTarget,
      command: fullTarget,
      env: projectEnv
    });
    if (res.stdout) console.log(res.stdout.trimEnd());
    if (res.stderr) console.error(res.stderr.trimEnd());
    await recordSqlAudit(projectCtx, fullTarget, res.durationMs, res.exitCode, res.arch || 'arm64');
    console.log(`\n⚡ [CPU ARM64 • ${projectCtx.name}]: Ejecutado en ${res.durationMs}ms (Código: ${res.exitCode})\n`);
    process.exit(res.exitCode || 0);
  } catch (err) {
    runLocalFailover(false, null, [], fullTarget);
  }
}

main();
