const { Client } = require('pg');
const http = require('http');

function fetchWorkerStatus() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:7777/status', { timeout: 2000 }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function checkActiveConnections() {
  const worker = await fetchWorkerStatus();
  console.log('\n=============================================================');
  if (worker && worker.status === 'ONLINE') {
    console.log(`⚡ COMPUTE WORKER ARM64 (127.0.0.1:7777): ONLINE (v${worker.version || '2.0'})`);
    console.log(`   • Dispositivo:   ${worker.device} | Node ${worker.nodeVersion}`);
    console.log(`   • Memoria RAM:   ${worker.ramFreeMb} MB libres de ${worker.ramTotalMb} MB`);
    console.log(`   • Tareas Sesión: ${worker.stats?.totalTasksRun || 0} ejecutadas (${worker.stats?.totalComputeTimeMs || 0}ms cómputo ARM)`);
    if (worker.recentTasks && worker.recentTasks.length > 0) {
      console.log(`   • Últimas tareas en Worker ARM:`);
      worker.recentTasks.slice(-5).forEach(t => {
        console.log(`     - [#${t.id}] [${t.project}] ${t.label} -> ${t.durationMs}ms (Exit: ${t.exitCode})`);
      });
    }
  } else {
    console.log(`⚠️ COMPUTE WORKER ARM64 (127.0.0.1:7777): DESCONECTADO`);
  }

  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
    application_name: 'ver-conexiones-cli'
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT 
        pid,
        usename,
        client_addr,
        client_port,
        application_name,
        state,
        backend_start,
        query
      FROM pg_stat_activity
      WHERE datname = 'postgres'
      ORDER BY backend_start DESC;
    `);

    console.log('=============================================================');
    console.log(`📡 CONEXIONES ACTIVAS EN POSTGRESQL 18.2 (${res.rows.length} conexión/es):`);
    console.log('=============================================================');

    res.rows.forEach((row, i) => {
      console.log(`\n[#${i + 1}] PID: ${row.pid}`);
      console.log(`  - Usuario:           ${row.usename}`);
      console.log(`  - Aplicación:        ${row.application_name || 'Desconocida / Driver nativo'}`);
      console.log(`  - IP Cliente:        ${row.client_addr || '127.0.0.1 (Local ADB)'}`);
      console.log(`  - Puerto de salida:  ${row.client_port}`);
      console.log(`  - Estado:            ${row.state}`);
      console.log(`  - Última consulta:   ${(row.query || '(esperando consultas)').replace(/\s+/g, ' ').trim().substring(0, 90)}`);
    });

    try {
      const auditRes = await client.query(`
        SELECT project_name, COUNT(*)::int AS total_tasks, COALESCE(SUM(duration_ms), 0)::int AS total_ms, MAX(executed_at) AS last_run
        FROM gds_seguridad.hybrid_compute_audit
        GROUP BY project_name
        ORDER BY last_run DESC;
      `);
      if (auditRes.rows.length > 0) {
        console.log('\n=============================================================');
        console.log('📊 HISTORIAL DE CÓMPUTO HÍBRIDO POR PROYECTO (Esquema gds_seguridad):');
        console.log('=============================================================');
        auditRes.rows.forEach(r => {
          console.log(`  • ${r.project_name.padEnd(20)} | ${String(r.total_tasks).padStart(4)} tareas ARM | ${r.total_ms}ms acumulados | Última: ${new Date(r.last_run).toLocaleString()}`);
        });
      }
    } catch (_) {}

    console.log('\n=============================================================\n');
    await client.end();
  } catch (err) {
    console.error('Error al consultar conexiones activas:', err.message);
  }
}

checkActiveConnections();
