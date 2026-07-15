const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const currentLevelName = String(process.env.LOG_LEVEL || "info").toLowerCase();
const currentLevel = LOG_LEVELS[currentLevelName] || LOG_LEVELS.info;

function write(level, message, meta = {}) {
  if (LOG_LEVELS[level] < currentLevel) {
    return;
  }

  const cleanMeta = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined)
  );

  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...cleanMeta
  };

  const line = JSON.stringify(payload);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  debug: (message, meta) => write("debug", message, meta),
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta)
};
