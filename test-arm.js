console.log("🚀 Calculando números primos en el chip ARM del Moto G(9) Play...");
let primes = 0;
const start = Date.now();
for (let i = 2; i < 60000; i++) {
  let isP = true;
  for (let j = 2; j * j <= i; j++) {
    if (i % j === 0) { isP = false; break; }
  }
  if (isP) primes++;
}
console.log(`✅ Encontrados ${primes} números primos en ${Date.now() - start}ms`);
console.log("💾 Memoria RAM consumida en el celular:", (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), "MB");
console.log("💻 Cero por ciento (0%) de carga en tu laptop.");
