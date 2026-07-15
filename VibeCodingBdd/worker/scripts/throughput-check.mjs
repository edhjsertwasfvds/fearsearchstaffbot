const minutes = Number(process.env.MINUTES ?? "60");
const pagesPerTick = Number(process.env.PAGES_PER_TICK ?? "8");
const cronPerMinute = Number(process.env.CRON_PER_MINUTE ?? "1");
const successRate = Number(process.env.SUCCESS_RATE ?? "0.85");

const attemptsPerHour = minutes * cronPerMinute * pagesPerTick;
const effectivePagesPerHour = Math.floor(attemptsPerHour * successRate);
const target = Number(process.env.TARGET_PAGES_PER_HOUR ?? "1000");

console.log("Throughput estimation");
console.log("=====================");
console.log(`minutes: ${minutes}`);
console.log(`pages_per_tick: ${pagesPerTick}`);
console.log(`cron_per_minute: ${cronPerMinute}`);
console.log(`success_rate: ${successRate}`);
console.log(`attempts_per_hour: ${attemptsPerHour}`);
console.log(`effective_pages_per_hour: ${effectivePagesPerHour}`);
console.log(`target_pages_per_hour: ${target}`);
console.log(`target_reached: ${effectivePagesPerHour >= target}`);

if (effectivePagesPerHour < target) {
  process.exitCode = 1;
}
