const { Client } = require('pg');
const { execSync } = require('child_process');

async function getTermuxUser() {
  try {
    const out = execSync('adb shell whoami', { encoding: 'utf-8', timeout: 3000 });
    const user = out.trim();
    if (user) return user;
  } catch (_) {}
  return 'postgres';
}

async function main() {
  const initialUser = process.argv[2] || await getTermuxUser();
  console.log(`Intentando conectar con usuario inicial: ${initialUser}...`);

  const client = new Client({ connectionString: `postgresql://${initialUser}@127.0.0.1:5432/postgres` });
  
  try {
    await client.connect();
    try {
      await client.query("CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'postgres';");
      console.log('✅ Usuario postgres creado con éxito (contraseña: postgres).');
    } catch(e) {
      if (e.code === '42710') {
        await client.query("ALTER ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'postgres';");
        console.log('✅ Contraseña y permisos del usuario postgres actualizados a "postgres".');
      } else {
        console.error('Error al configurar rol:', e.message);
      }
    }
    await client.end();
  } catch (err) {
    console.error(`❌ No se pudo conectar con el usuario ${initialUser}:`, err.message);
    console.log('💡 Sugerencia: Ejecuta "createuser -s postgres" directamente en la terminal de Termux.');
  }
}

main();
