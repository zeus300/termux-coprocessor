#!/usr/bin/env node
/**
 * ============================================================================
 * ASISTENTE DE CONFIGURACIÓN Y VINCULACIÓN INTERACTIVA (SETUP WIZARD)
 * TERMUX ARM64 CO-PROCESSOR & DATABASE OFFLOADING ENGINE
 * Diseñado por: Marcos Bazán
 * ============================================================================
 */

const { exec, execSync } = require('child_process');
const readline = require('readline');
const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Paleta de colores ANSI
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
  white: '\x1b[38;2;255;255;255m',
  bgDark: '\x1b[48;2;20;25;35m'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(questionText) {
  return new Promise((resolve) => {
    rl.question(questionText, (answer) => {
      resolve((answer || '').trim());
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let adbBinary = 'adb';

function findAdb() {
  try {
    execSync('where.exe adb', { stdio: 'ignore' });
    return 'adb';
  } catch (_) {}

  // Buscar en rutas comunes en Windows
  const home = os.homedir();
  const possiblePaths = [
    path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    path.join(home, 'AppData', 'AndroidCLI', 'platform-tools', 'adb.exe'),
    'C:\\platform-tools\\adb.exe',
    'C:\\adb\\adb.exe'
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return `"${p}"`;
    }
  }
  return 'adb';
}

function execCmd(cmd, timeoutMs = 8000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        err,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim()
      });
    });
  });
}

function printHeader() {
  console.clear();
  console.log(`
${C.green}${C.bright}  ████████╗███████╗██████╗ ███╗   ███╗██╗   ██╗██╗  ██╗
  ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║   ██║╚██╗██╔╝
     ██║   █████╗  ██████╔╝██╔████╔██║██║   ██║ ╚███╔╝ 
     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║   ██║ ██╔██╗ 
     ██║   ███████╗██║  ██║██║ ╚═╝ ██║╚██████╔╝██╔╝ ██╗
     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝${C.reset}
${C.cyan}${C.bright}  ═════════════════════════════════════════════════════════════════════${C.reset}
  ${C.white}${C.bright}  W I Z A R D   D E   V I N C U L A C I Ó N   Y   P U E S T A   A   P U N T O${C.reset}
  ${C.dim}${C.gray}  Convierte tu smartphone Android en un co-procesador y servidor de BD${C.reset}
  ${C.magenta}${C.bright}  ⚡ Diseñado por: Marcos Bazán (Open Source Community Edition)${C.reset}
${C.cyan}${C.bright}  ═════════════════════════════════════════════════════════════════════${C.reset}
`);
}

function boxMessage(title, lines, color = C.cyan) {
  const width = 67;
  console.log(`\n${color}  ┌─ ${C.bright}${title} ${C.reset}${color}${'─'.repeat(Math.max(0, width - title.length - 4))}┐${C.reset}`);
  for (const line of lines) {
    console.log(`  ${color}│${C.reset}  ${line}`);
  }
  console.log(`${color}  └${'─'.repeat(width)}┘${C.reset}\n`);
}

// ----------------------------------------------------------------------------
// PASO 1: VERIFICAR DISPONIBILIDAD DE ADB
// ----------------------------------------------------------------------------
async function stepVerifyAdb() {
  adbBinary = findAdb();
  const res = await execCmd(`${adbBinary} version`);
  if (!res.success) {
    boxMessage('❌ ADB (Android Debug Bridge) NO ENCONTRADO', [
      `${C.yellow}Para conectar tu teléfono con Windows necesitas las herramientas ADB.${C.reset}`,
      '',
      `1. Descarga el archivo oficial ${C.cyan}SDK Platform-Tools para Windows${C.reset}:`,
      `   ${C.white}https://developer.android.com/tools/releases/platform-tools${C.reset}`,
      `2. Descomprime la carpeta en ${C.green}C:\\platform-tools${C.reset}`,
      `3. Añade esa ruta a tu variable de entorno PATH, o colócalo en tu carpeta.`,
      '',
      `${C.gray}Presiona Enter cuando hayas instalado ADB para volver a verificar...${C.reset}`
    ], C.red);

    await ask(`  ${C.cyan}👉 Presiona [Enter] tras instalar ADB... ${C.reset}`);
    return stepVerifyAdb();
  }

  // Asegurar que el servidor ADB esté activo
  await execCmd(`${adbBinary} start-server`);
  console.log(`  ${C.green}✔ ADB detectado correctamente:${C.reset} ${C.gray}${res.stdout.split('\n')[0]}${C.reset}`);
  return true;
}

// ----------------------------------------------------------------------------
// PASO 2: ELEGIR MÉTODO DE CONEXIÓN (USB o WIFI)
// ----------------------------------------------------------------------------
async function stepSelectConnectionMode() {
  boxMessage('MÉTODO DE CONEXIÓN CON EL SMARTPHONE', [
    `Elige cómo prefieres comunicar tu PC con el teléfono Android:`,
    '',
    `  ${C.green}${C.bright}[1] Cable USB${C.reset} ${C.white}(Recomendado - Latencia <1ms, carga continua de batería)${C.reset}`,
    `  ${C.cyan}${C.bright}[2] Conexión WiFi / Inalámbrica${C.reset} ${C.white}(Wireless ADB - Sin cables, misma red local)${C.reset}`,
    `  ${C.yellow}${C.bright}[3] Salir${C.reset}`
  ], C.cyan);

  const choice = await ask(`  ${C.cyan}👉 Selecciona una opción [1/2/3] (Por defecto 1): ${C.reset}`);

  if (choice === '2') {
    return 'WIFI';
  } else if (choice === '3') {
    console.log(`\n  ${C.yellow}Operación cancelada por el usuario. ¡Hasta pronto!${C.reset}\n`);
    process.exit(0);
  }
  return 'USB';
}

// ----------------------------------------------------------------------------
// PASO 2.B: VINCULACIÓN INALÁMBRICA (WIFI ADB)
// ----------------------------------------------------------------------------
async function stepWirelessPairing() {
  boxMessage('CONFIGURACIÓN DE DEPURA INALÁMBRICA (WIFI)', [
    `${C.bright}Requisitos en tu teléfono Android (Conectado al mismo WiFi que la PC):${C.reset}`,
    `1. Ve a ${C.yellow}Ajustes -> Opciones de desarrollador${C.reset}`,
    `2. Activa ${C.green}Depuración inalámbrica (Wireless debugging)${C.reset}`,
    `3. Pulsa sobre el texto 'Depuración inalámbrica' para entrar al menú.`,
    '',
    `Allí verás:`,
    `  • ${C.cyan}Opción A:${C.reset} 'Dirección IP y puerto' (ej: 192.168.1.50:41234)`,
    `  • ${C.cyan}Opción B:${C.reset} 'Vincular dispositivo con código de vinculación' (Pairing)`
  ], C.cyan);

  const isPaired = await ask(`  ${C.cyan}👉 ¿Tu teléfono ya fue emparejado con esta PC antes? [s/N]: ${C.reset}`);

  if (isPaired.toLowerCase() === 's' || isPaired.toLowerCase() === 'si' || isPaired.toLowerCase() === 'y') {
    // Conexión directa
    return await connectDirectWifi();
  } else {
    // Flujo de Pairing Code de Android 11+
    return await pairWifiWithCode();
  }
}

async function pairWifiWithCode() {
  boxMessage('VINCULACIÓN CON CÓDIGO (PAIRING CODE - ANDROID 11+)', [
    `1. En tu móvil, toca en: ${C.green}"Vincular dispositivo con código de vinculación"${C.reset}`,
    `2. Verás una ventana emergente que muestra:`,
    `   • ${C.white}Dirección IP y puerto de vinculación${C.reset} (ej: 192.168.1.50:${C.yellow}37123${C.reset})`,
    `   • ${C.white}Código de vinculación de 6 dígitos${C.reset} (ej: ${C.green}123456${C.reset})`,
    `3. Y en la pantalla principal de depuración verás el ${C.cyan}puerto de conexión${C.reset} (segundo puerto).`
  ], C.yellow);

  const ipPortPair = await ask(`  ${C.cyan}👉 Ingresa la IP y puerto de VINCULACIÓN (ej: 192.168.1.50:37123): ${C.reset}`);
  const code = await ask(`  ${C.cyan}👉 Ingresa el CÓDIGO de 6 dígitos (ej: 123456): ${C.reset}`);

  console.log(`\n  ${C.yellow}⌛ Enviando código de emparejamiento a ${ipPortPair}...${C.reset}`);
  const pairRes = await execCmd(`${adbBinary} pair ${ipPortPair} ${code}`);

  if (!pairRes.stdout.toLowerCase().includes('successfully') && pairRes.err) {
    console.log(`  ${C.red}❌ Error al vincular:${C.reset} ${pairRes.stderr || pairRes.stdout}`);
    const retry = await ask(`  ${C.cyan}👉 ¿Deseas reintentar la vinculación? [S/n]: ${C.reset}`);
    if (retry.toLowerCase() !== 'n') return pairWifiWithCode();
    return false;
  }

  console.log(`  ${C.green}✔ ¡Dispositivo emparejado con éxito vía WiFi!${C.reset}`);

  boxMessage('SEGUNDO PUERTO: PUERTO DE CONEXIÓN REAL', [
    `Ahora mira la pantalla principal de "Depuración inalámbrica" en el móvil.`,
    `Debajo de 'Dirección IP y puerto' aparece el ${C.cyan}puerto real de conexión${C.reset}.`,
    `(Nota: Suele ser diferente al puerto temporal de vinculación anterior).`
  ], C.cyan);

  const ipPortConnect = await ask(`  ${C.cyan}👉 Ingresa la IP y SEGUNDO PUERTO para conectar (ej: 192.168.1.50:41234): ${C.reset}`);
  console.log(`\n  ${C.yellow}⌛ Conectando a ${ipPortConnect}...${C.reset}`);
  const connRes = await execCmd(`${adbBinary} connect ${ipPortConnect}`);

  if (connRes.stdout.toLowerCase().includes('connected to')) {
    console.log(`  ${C.green}✔ ¡Conexión inalámbrica establecida correctamente!${C.reset}`);
    return true;
  } else {
    console.log(`  ${C.red}❌ No se pudo conectar a ${ipPortConnect}:${C.reset} ${connRes.stdout || connRes.stderr}`);
    return false;
  }
}

async function connectDirectWifi() {
  const ipPort = await ask(`  ${C.cyan}👉 Ingresa la IP y PUERTO de depuración de tu móvil (ej: 192.168.1.50:5555 o :41234): ${C.reset}`);
  console.log(`\n  ${C.yellow}⌛ Conectando por WiFi a ${ipPort}...${C.reset}`);
  const res = await execCmd(`${adbBinary} connect ${ipPort}`);
  if (res.stdout.toLowerCase().includes('connected to')) {
    console.log(`  ${C.green}✔ ¡Conectado inalámbricamente con éxito!${C.reset}`);
    return true;
  } else {
    console.log(`  ${C.red}❌ Respuesta:${C.reset} ${res.stdout || res.stderr}`);
    const retry = await ask(`  ${C.cyan}👉 ¿Reintentar conexión inalámbrica? [S/n]: ${C.reset}`);
    if (retry.toLowerCase() !== 'n') return connectDirectWifi();
    return false;
  }
}

// ----------------------------------------------------------------------------
// PASO 3: DETECCIÓN Y AUTORIZACIÓN DEL DISPOSITIVO
// ----------------------------------------------------------------------------
async function stepDetectDevice(mode = 'USB') {
  while (true) {
    const res = await execCmd(`${adbBinary} devices`);
    const lines = res.stdout.split('\n').filter(l => l.trim() && !l.includes('List of devices'));

    if (lines.length === 0) {
      if (mode === 'USB') {
        boxMessage('DISPOSITIVO NO DETECTADO POR CABLE USB', [
          `No se detectó ningún teléfono conectado por cable USB.`,
          '',
          `1. Conecta tu teléfono a la PC con un ${C.yellow}cable USB de buena calidad${C.reset} (que soporte datos).`,
          `2. En el teléfono, activa ${C.green}Opciones de Desarrollador${C.reset}:`,
          `   (Ajustes -> Acerca del teléfono -> Toca 7 veces en 'Número de compilación').`,
          `3. Entra a Opciones de Desarrollador y activa: ${C.cyan}Depuración por USB${C.reset}.`,
          `4. Asegúrate de que el modo USB esté en 'Transferencia de archivos' o 'MTP'.`
        ], C.yellow);
      } else {
        boxMessage('DISPOSITIVO INALÁMBRICO NO ENCONTRADO', [
          `No hay dispositivos ADB conectados por WiFi.`,
          `Verifica que el teléfono siga conectado a la misma red WiFi.`
        ], C.yellow);
      }

      const ans = await ask(`  ${C.cyan}👉 ¿Ya conectaste el teléfono? Presiona [Enter] o escribe 'yes' para verificar [S/n]: ${C.reset}`);
      if (ans.toLowerCase() === 'n') return false;
      continue;
    }

    // Hay dispositivo(s). Comprobar si alguno está 'unauthorized' o 'device'
    const unauthorizedDevice = lines.find(l => l.includes('unauthorized'));
    const onlineDevice = lines.find(l => l.includes('device') && !l.includes('unauthorized'));

    if (unauthorizedDevice) {
      const serial = unauthorizedDevice.split(/\s+/)[0];
      boxMessage('📱 AUTORIZACIÓN PENDIENTE EN LA PANTALLA DEL MÓVIL', [
        `El teléfono (${C.yellow}${serial}${C.reset}) está conectado, pero requiere autorización de seguridad:`,
        '',
        `1. ${C.bright}Desbloquea la pantalla de tu smartphone ahora mismo.${C.reset}`,
        `2. Verás una ventana emergente: ${C.green}"¿Permitir depuración por USB?"${C.reset}`,
        `3. Marca la casilla: ${C.cyan}☑ "Permitir siempre desde esta computadora"${C.reset}`,
        `4. Pulsa el botón: ${C.green}${C.bright}[Aceptar] / [Permitir]${C.reset}`
      ], C.magenta);

      const ans = await ask(`  ${C.cyan}👉 ¿Ya presionaste 'Permitir siempre' en el teléfono? [S/n]: ${C.reset}`);
      if (ans.toLowerCase() === 'n') continue;
      // Reintentar verificación
      await sleep(1000);
      continue;
    }

    if (onlineDevice) {
      const serial = onlineDevice.split(/\s+/)[0];
      console.log(`  ${C.green}✔ Teléfono enlazado y autorizado con éxito:${C.reset} ${C.white}${serial}${C.reset}`);
      return serial;
    }

    // Otro estado (offline, etc)
    console.log(`  ${C.yellow}⚠ Estado del dispositivo: ${lines[0]}. Reiniciando servidor ADB...${C.reset}`);
    await execCmd(`${adbBinary} kill-server`);
    await sleep(1500);
    await execCmd(`${adbBinary} start-server`);
  }
}

// ----------------------------------------------------------------------------
// PASO 4: OBTENER INFORMACIÓN DE HARDWARE DEL SMARTPHONE
// ----------------------------------------------------------------------------
async function stepInspectHardware() {
  console.log(`\n  ${C.cyan}🔍 Consultando características del hardware móvil (ARM)...${C.reset}`);
  const [modelRes, memRes, coresRes, osRes] = await Promise.all([
    execCmd(`${adbBinary} shell "getprop ro.product.model"`),
    execCmd(`${adbBinary} shell "cat /proc/meminfo | grep -E 'MemTotal|MemAvailable'"`),
    execCmd(`${adbBinary} shell "cat /sys/devices/system/cpu/online"`),
    execCmd(`${adbBinary} shell "getprop ro.build.version.release"`)
  ]);

  const model = modelRes.stdout || 'Smartphone Android';
  const androidVer = osRes.stdout || 'Android';

  let coresText = '8 Núcleos (Octa-Core ARM)';
  if (coresRes.stdout.includes('0-7')) coresText = 'Octa-Core (8 Núcleos ARM64)';
  else if (coresRes.stdout.includes('0-5')) coresText = 'Hexa-Core (6 Núcleos ARM64)';
  else if (coresRes.stdout.includes('0-3')) coresText = 'Quad-Core (4 Núcleos ARM)';

  let ramText = 'Memoria disponible lista';
  let totalKb = 0, availKb = 0;
  for (const l of memRes.stdout.split('\n')) {
    if (l.includes('MemTotal:')) totalKb = parseInt(l.replace(/\D/g, ''), 10);
    if (l.includes('MemAvailable:')) availKb = parseInt(l.replace(/\D/g, ''), 10);
  }
  if (totalKb > 0) {
    const totalGb = (totalKb / 1024 / 1024).toFixed(2);
    const availGb = (availKb / 1024 / 1024).toFixed(2);
    const usedKb = totalKb - availKb;
    const usedGb = (usedKb / 1024 / 1024).toFixed(2);
    const pctUsed = Math.round((usedKb / totalKb) * 100);
    ramText = `${usedGb} GB Usados (${pctUsed}%) • ${availGb} GB Libres (Total: ${totalGb} GB)`;
  }

  boxMessage('HARDWARE MÓVIL RECONOCIDO', [
    `• Dispositivo:      ${C.bright}${C.green}${model}${C.reset} (Android ${androidVer})`,
    `• Procesador CPU:   ${C.yellow}${coresText}${C.reset}`,
    `• Memoria RAM:      ${C.cyan}${ramText}${C.reset}`,
    `• Arquitectura:     ${C.white}ARM64 Linux (aarch64)${C.reset}`
  ], C.green);

  return { model, androidVer, coresText, ramText };
}

// ----------------------------------------------------------------------------
// PASO 5: VERIFICAR Y CONFIGURAR TERMUX
// ----------------------------------------------------------------------------
async function stepCheckTermux() {
  while (true) {
    const res = await execCmd(`${adbBinary} shell "pm list packages | grep com.termux"`);
    if (!res.stdout.includes('package:com.termux')) {
      boxMessage('❌ LA APP TERMUX NO ESTÁ INSTALADA EN EL MÓVIL', [
        `Para usar el co-procesamiento ARM y la base de datos se requiere la app ${C.bright}Termux${C.reset}.`,
        '',
        `${C.yellow}IMPORTANTE:${C.reset} NO descargues la versión de Google Play Store (está obsoleta).`,
        `Descarga la versión oficial y actualizada desde F-Droid o GitHub:`,
        '',
        `  ${C.cyan}Enlace F-Droid Oficial (Recomendado):${C.reset}`,
        `  ${C.white}https://f-droid.org/packages/com.termux/${C.reset}`,
        '',
        `  ${C.cyan}O descarga directa del APK en GitHub:${C.reset}`,
        `  ${C.white}https://github.com/termux/termux-app/releases/latest${C.reset}`,
        '',
        `1. Instala el APK de Termux en el teléfono.`,
        `2. Abre la app Termux en el teléfono al menos una vez.`
      ], C.red);

      const ans = await ask(`  ${C.cyan}👉 ¿Ya instalaste y abriste Termux en tu teléfono? [S/n]: ${C.reset}`);
      if (ans.toLowerCase() === 'n') continue;
      await sleep(1500);
      continue;
    }

    console.log(`  ${C.green}✔ App Termux detectada en el dispositivo.${C.reset}`);
    break;
  }

  // Comprobar si Termux ya tiene instalados los paquetes necesarios
  boxMessage('DESPLIEGUE DEL ENTORNO DE CÓMPUTO EN TERMUX', [
    `El smartphone ejecutará dos servicios clave:`,
    `  1. ${C.cyan}Node.js:${C.reset} Servidor Worker de tareas ARM64 (Puerto 7777)`,
    `  2. ${C.blue}PostgreSQL:${C.reset} Motor de base de datos dedicada (Puerto 5432)`,
    '',
    `El comando maestro para inicializar el entorno en Termux es:`,
    '',
    `  ${C.green}${C.bright}pkg update -y && pkg install -y nodejs postgresql && termux-wake-lock${C.reset}`,
    '',
    `¿Cómo deseas ejecutar este comando?`,
    `  ${C.white}[1] Enviar automáticamente a la pantalla de Termux vía ADB${C.reset}`,
    `  ${C.white}[2] Copiarlo o digitarlo tú mismo en la app Termux del móvil${C.reset}`
  ], C.cyan);

  const cmdChoice = await ask(`  ${C.cyan}👉 Selecciona opción [1/2] (Por defecto 1): ${C.reset}`);

  if (cmdChoice !== '2') {
    console.log(`\n  ${C.yellow}⌛ Abriendo Termux en el móvil y enviando comando de preparación...${C.reset}`);
    await execCmd(`${adbBinary} shell "am start -n com.termux/.app.TermuxActivity"`);
    await sleep(2000);
    // Enviar wake-lock e instalación
    await execCmd(`${adbBinary} shell "input text pkg%supdate%s-y%s&&%spkg%sinstall%s-y%snodejs%spostgresql%s&&%stermux-wake-lock && input keyevent 66"`);
    console.log(`  ${C.green}✔ Comando enviado a Termux.${C.reset}`);
    boxMessage('INSTALACIÓN EN CURSO EN EL TELÉFONO', [
      `Mira la pantalla de tu móvil: Termux estará descargando e instalando`,
      `los paquetes de Node.js y PostgreSQL.`,
      '',
      `Si Termux te hace alguna pregunta de confirmación en el móvil (como Y/I/N),`,
      `presiona Enter en el teclado del móvil para aceptar los valores por defecto.`
    ], C.yellow);
  } else {
    boxMessage('COMANDO PARA COPIAR EN TERMUX', [
      `Abre Termux en tu móvil y ejecuta:`,
      '',
      `  ${C.green}${C.bright}pkg update -y && pkg install -y nodejs postgresql && termux-wake-lock${C.reset}`
    ], C.yellow);
  }

  await ask(`  ${C.cyan}👉 Cuando termine la instalación en Termux, presiona [Enter] para continuar... ${C.reset}`);
  return true;
}

// ----------------------------------------------------------------------------
// PASO 6: DESPLEGAR WORKER Y VERIFICAR PUERTOS
// ----------------------------------------------------------------------------
async function stepDeployWorker() {
  console.log(`\n  ${C.cyan}📤 Desplegando Termux Compute Worker (worker.js) en el teléfono...${C.reset}`);

  const localWorkerPath = path.join(__dirname, 'worker.js');
  if (fs.existsSync(localWorkerPath)) {
    const workerContent = fs.readFileSync(localWorkerPath, 'utf-8');
    const base64Content = Buffer.from(workerContent).toString('base64');

    // Inyectar en el móvil vía comando Termux
    await execCmd(`${adbBinary} shell "am start -n com.termux/.app.TermuxActivity"`);
    await sleep(1500);

    // Escribir worker.js en Termux y arrancarlo
    const writeScript = `echo "${base64Content}" | base64 -d > ~/worker.js && node ~/worker.js &`;
    // Enviar comandos a Termux
    await execCmd(`${adbBinary} shell "input text echo%s'${base64Content}'%s|%sbase64%s-d%s>%s~/worker.js%s&&%spkill%s-f%s'node ~/worker.js';%snode%s~/worker.js%s& && input keyevent 66"`);
    console.log(`  ${C.green}✔ Script worker.js sincronizado y lanzado en el procesador ARM.${C.reset}`);
  }

  // Establecer redirección de puertos ADB
  console.log(`  ${C.cyan}🔄 Configurando túneles de red USB/WiFi (7777 Worker / 5432 Postgres)...${C.reset}`);
  await execCmd(`${adbBinary} forward tcp:7777 tcp:7777`);
  await execCmd(`${adbBinary} forward tcp:5432 tcp:5432`);

  // Esperar a que el worker responda
  console.log(`  ${C.yellow}⌛ Verificando conectividad con el micro-servidor en http://127.0.0.1:7777...${C.reset}`);
  let isWorkerUp = false;
  for (let i = 0; i < 6; i++) {
    isWorkerUp = await testWorkerHealth();
    if (isWorkerUp) break;
    await sleep(1500);
  }

  if (isWorkerUp) {
    console.log(`  ${C.green}✔ ¡Worker ARM activo y respondiendo por puerto 7777!${C.reset}`);
  } else {
    console.log(`  ${C.yellow}⚠ El worker aún no responde. Asegúrate de tener la app Termux abierta en pantalla.${C.reset}`);
    const retry = await ask(`  ${C.cyan}👉 ¿Reintentar verificación del Worker? [S/n]: ${C.reset}`);
    if (retry.toLowerCase() !== 'n') return stepDeployWorker();
  }

  return true;
}

function testWorkerHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:7777/health', { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ----------------------------------------------------------------------------
// PASO 7: PRUEBA DE CÓMPUTO EN TIEMPO REAL (OFFLOADING TEST)
// ----------------------------------------------------------------------------
async function stepRunBenchmark() {
  boxMessage('⚡ PRUEBA DE CO-PROCESAMIENTO EN VIVO', [
    `Vamos a enviar un cálculo matemático de números primos directamente`,
    `al chip ARM de tu smartphone mediante:`,
    `  ${C.yellow}termux-exec.bat test-arm.js${C.reset}`,
    '',
    `Observa la velocidad de ejecución y cómo tu PC consume 0% de CPU.`
  ], C.green);

  await ask(`  ${C.cyan}👉 Presiona [Enter] para disparar el cálculo en el procesador móvil... ${C.reset}`);

  try {
    const termuxExecPath = path.join(__dirname, 'termux-exec.js');
    const testArmPath = path.join(__dirname, 'test-arm.js');
    console.log(`\n  ${C.yellow}🚀 Delegando cálculo al smartphone...${C.reset}\n`);

    const res = await execCmd(`node "${termuxExecPath}" "${testArmPath}"`, 20000);
    console.log(res.stdout);
    if (res.stderr) console.error(res.stderr);

    boxMessage('🎉 ¡SISTEMA CONFIGURADO Y OPERATIVO!', [
      `${C.bright}${C.green}¡Tu smartphone está completamente vinculado como co-procesador!${C.reset}`,
      '',
      `• Para delegar cualquier script o comando al chip ARM móvil:`,
      `  ${C.yellow}termux-exec "comando"${C.reset}  o  ${C.yellow}termux-exec ruta/al/script.js${C.reset}`,
      '',
      `• Para iniciar el monitor continuo con failover automático y PostgreSQL:`,
      `  Ejecuta ${C.green}iniciar-postgres.bat${C.reset} o ${C.green}npm start${C.reset}`,
      '',
      `• Cadena de conexión PostgreSQL (en tu .env):`,
      `  ${C.cyan}DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public"${C.reset}`
    ], C.green);

  } catch (err) {
    console.error(`  ${C.red}Error en prueba:${C.reset}`, err.message);
  }
}

// ----------------------------------------------------------------------------
// FUNCIÓN PRINCIPAL DEL WIZARD
// ----------------------------------------------------------------------------
async function main() {
  printHeader();

  // 1. ADB
  await stepVerifyAdb();

  // 2. Selección de modo (USB o WiFi)
  const mode = await stepSelectConnectionMode();

  if (mode === 'WIFI') {
    await stepWirelessPairing();
  }

  // 3. Detección y autorización
  const deviceSerial = await stepDetectDevice(mode);
  if (!deviceSerial) {
    console.log(`\n  ${C.yellow}No se pudo completar la vinculación del dispositivo.${C.reset}\n`);
    process.exit(1);
  }

  // 4. Inspección de hardware
  await stepInspectHardware();

  // 5. Termux instalado y preparado
  await stepCheckTermux();

  // 6. Despliegue de Worker
  await stepDeployWorker();

  // 7. Prueba en vivo
  await stepRunBenchmark();

  const launchMonitor = await ask(`\n  ${C.cyan}👉 ¿Deseas iniciar ahora el Monitor en Vivo (cluster-manager)? [S/n]: ${C.reset}`);
  if (launchMonitor.toLowerCase() !== 'n') {
    console.log(`\n  ${C.green}Iniciando monitor en tiempo real...${C.reset}\n`);
    const clusterPath = path.join(__dirname, 'cluster-manager.js');
    require(clusterPath);
  } else {
    console.log(`\n  ${C.green}¡Todo listo! Puedes ejecutar 'iniciar-postgres.bat' en cualquier momento.${C.reset}\n`);
    rl.close();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\n❌ Error inesperado en el asistente:', err);
  process.exit(1);
});
