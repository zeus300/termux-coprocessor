const { Client } = require('pg');

async function testConnection(user, database, password = '') {
  const connectionString = `postgresql://${user}${password ? `:${password}` : ''}@127.0.0.1:5432/${database}`;
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 3000,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT version(), current_user, current_database(), now();');
    console.log(`\n🎉 ¡CONEXIÓN SQL EXITOSA!`);
    console.log(`--------------------------------------------------`);
    console.log(`Cadena probada: ${connectionString}`);
    console.log(`Usuario actual : ${res.rows[0].current_user}`);
    console.log(`Base de datos  : ${res.rows[0].current_database}`);
    console.log(`Hora servidor  : ${res.rows[0].now}`);
    console.log(`Versión PG     : ${res.rows[0].version.split(',')[0]}`);
    console.log(`--------------------------------------------------`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`Intento con ${user}/${database}: ${err.message}`);
    await client.end().catch(() => {});
    return false;
  }
}

async function run() {
  console.log('Probando conexiones con credenciales comunes en Termux...');

  // Intentos estándar de la industria
  if (await testConnection('postgres', 'postgres', 'postgres')) return;
  if (await testConnection('postgres', 'postgres')) return;

  console.log('\nSi necesitas crear el usuario postgres o una base de datos específica, avísame.');
}

run();
