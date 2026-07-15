const logger = require("./logger");

let authOutageNotified = false;

function markAuthRecovered() {
  authOutageNotified = false;
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4096),
      disable_web_page_preview: true
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    logger.error("Telegram sendMessage failed", {
      status: response.status,
      description: data.description
    });
  }
}

async function sendDiscord(text) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: text.slice(0, 2000)
    })
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error("Discord webhook failed", {
      status: response.status,
      body: body.slice(0, 300)
    });
  }
}

async function notifyAuthFailure(details) {
  const hasTg = Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
  );
  const hasDiscord = Boolean(process.env.DISCORD_WEBHOOK_URL);

  if (!hasTg && !hasDiscord) {
    logger.warn("Auth failure but no Telegram/Discord env configured", {
      details
    });
    return;
  }

  if (authOutageNotified) {
    return;
  }

  authOutageNotified = true;

  const text = [
    "Fear Staff Sync: токен недействителен или доступ к API запрещён.",
    "",
    details,
    "",
    "Обнови FEAR_COOKIE или ACCESS_TOKEN в Railway Variables."
  ].join("\n");

  await Promise.allSettled([sendTelegram(text), sendDiscord(text)]);
  logger.info("Auth failure notifications sent");
}

module.exports = {
  notifyAuthFailure,
  markAuthRecovered
};
