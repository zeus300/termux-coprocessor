const { Client } = require('pg');

async function checkActiveConnections() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/postgres'
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

    console.log('\n=============================================================');
    console.log(`📡 CONEXIONES ACTIVAS EN POSTGRESQL (${res.rows.length} conexión/es):`);
    console.log('=============================================================');

    res.rows.forEach((row, i) => {
      console.log(`\n[#${i + 1}] PID: ${row.pid}`);
      console.log(`  - Usuario:           ${row.usename}`);
      console.log(`  - Aplicación:        ${row.application_name || 'Desconocida / Driver nativo'}`);
      console.log(`  - IP Cliente:        ${row.client_addr || '127.0.0.1 (Local ADB)'}`);
      console.log(`  - Puerto de salida:  ${row.client_port}`);
      console.log(`  - Estado:            ${row.state}`);
      console.log(`  - Última consulta:   ${row.query || '(esperando consultas)'}`);
    });

    console.log('\n=============================================================');
    await client.end();
  } catch (err) {
    console.error('Error al consultar conexiones activas:', err.message);
  }
}

checkActiveConnections();
