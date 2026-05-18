const TelegramBot = require("node-telegram-bot-api");
const db = require("./db");
const config = require("./config");

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAdmin(userId) {
  return String(userId) === String(config.ADMIN_ID);
}

function buildLeaderboard(scores) {
  if (!scores.length) return "No scores yet.";
  const medals = ["🥇", "🥈", "🥉"];
  return scores
    .map((s, i) => {
      const medal = medals[i] || `${i + 1}.`;
      return `${medal} <b>${escapeHtml(s.name)}</b> — ${s.points} pt${s.points !== 1 ? "s" : ""}`;
    })
    .join("\n");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatPrizes() {
  return config.PRIZES.map((p, i) => {
    const medals = ["🥇", "🥈", "🥉"];
    return `${medals[i] || `${i + 1}.`} ${p}`;
  }).join("\n");
}

// ─── DM: /start ──────────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  if (msg.chat.type !== "private") return;

  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(
      msg.chat.id,
      "👋 Hi! I'm the <b>Injective Nigeria Quiz Bot</b>.\n\nJoin the game in the group chat!",
      { parse_mode: "HTML" }
    );
  }

  bot.sendMessage(
    msg.chat.id,
    `🤖 <b>Admin Panel — Injective Quiz Bot</b>\n\n` +
      `<b>Before Game:</b>\n` +
      `/add — Add a question (follow the prompts)\n` +
      `/list — View all queued questions\n` +
      `/clear — Clear all questions & scores\n` +
      `/setprize — Update prize text\n\n` +
      `<b>During Game (use in GROUP):</b>\n` +
      `/drop — Drop next question into the group\n` +
      `/leaderboard — Show current standings\n` +
      `/endgame — End game & announce winners\n\n` +
      `<b>Status:</b> ${db.getQuestions().length} question(s) queued`,
    { parse_mode: "HTML" }
  );
});

// ─── DM: /add (multi-step) ───────────────────────────────────────────────────

const addSessions = {}; // userId → { step, question, answer }

bot.onText(/\/add$/, (msg) => {
  if (msg.chat.type !== "private" || !isAdmin(msg.from.id)) return;

  addSessions[msg.from.id] = { step: "question" };
  bot.sendMessage(
    msg.chat.id,
    "📝 <b>Step 1/2</b> — Type the <b>question</b>:\n\n(Send /cancel to abort)",
    { parse_mode: "HTML" }
  );
});

bot.onText(/\/cancel/, (msg) => {
  if (msg.chat.type !== "private" || !isAdmin(msg.from.id)) return;
  delete addSessions[msg.from.id];
  bot.sendMessage(msg.chat.id, "❌ Cancelled.");
});

// Multi-step /add handler
bot.on("message", (msg) => {
  if (msg.chat.type !== "private" || !isAdmin(msg.from.id)) return;
  if (msg.text && msg.text.startsWith("/")) return;

  const session = addSessions[msg.from.id];
  if (!session) return;

  if (session.step === "question") {
    session.question = msg.text.trim();
    session.step = "answer";
    bot.sendMessage(
      msg.chat.id,
      `✅ Question saved!\n\n📝 <b>Step 2/2</b> — Type the <b>correct answer</b> (case-insensitive):`,
      { parse_mode: "HTML" }
    );
  } else if (session.step === "answer") {
    session.answer = msg.text.trim();
    db.addQuestion({ question: session.question, answer: session.answer });
    delete addSessions[msg.from.id];

    const total = db.getQuestions().length;
    bot.sendMessage(
      msg.chat.id,
      `🎉 <b>Question added!</b>\n\n` +
        `❓ <i>${escapeHtml(session.question)}</i>\n` +
        `✔️ Answer: <code>${escapeHtml(session.answer)}</code>\n\n` +
        `📦 Total questions queued: <b>${total}</b>`,
      { parse_mode: "HTML" }
    );
  }
});

// ─── DM: /list ───────────────────────────────────────────────────────────────

bot.onText(/\/list/, (msg) => {
  if (msg.chat.type !== "private" || !isAdmin(msg.from.id)) return;

  const questions = db.getQuestions();
  if (!questions.length) {
    return bot.sendMessage(msg.chat.id, "📭 No questions queued yet. Use /add to add some.");
  }

  const list = questions
    .map(
      (q, i) =>
        `<b>${i + 1}.</b> ${escapeHtml(q.question)}\n    ✔️ <code>${escapeHtml(q.answer)}</code>`
    )
    .join("\n\n");

  bot.sendMessage(msg.chat.id, `📋 <b>Queued Questions (${questions.length}):</b>\n\n${list}`, {
    parse_mode: "HTML",
  });
});

// ─── DM: /clear ──────────────────────────────────────────────────────────────

bot.onText(/\/clear/, (msg) => {
  if (msg.chat.type !== "private" || !isAdmin(msg.from.id)) return;
  db.clearAll();
  bot.sendMessage(msg.chat.id, "🗑️ All questions and scores have been cleared.");
});

// ─── DM: /setprize ───────────────────────────────────────────────────────────

const prizeSessions = {};

bot.onText(/\/setprize/, (msg) => {
  if (msg.chat.type !== "private" || !isAdmin(msg.from.id)) return;

  prizeSessions[msg.from.id] = true;
  bot.sendMessage(
    msg.chat.id,
    `🏆 Send the prize text for all 3 places on separate lines. Example:\n\n` +
      `<code>1st Place = 50 INJ\n2nd Place = 30 INJ\n3rd Place = 20 INJ</code>`,
    { parse_mode: "HTML" }
  );
});

bot.on("message", (msg) => {
  if (msg.chat.type !== "private" || !isAdmin(msg.from.id)) return;
  if (msg.text && msg.text.startsWith("/")) return;
  if (!prizeSessions[msg.from.id]) return;

  const lines = msg.text.trim().split("\n").filter(Boolean);
  if (lines.length < 1) return;

  config.PRIZES = lines;
  delete prizeSessions[msg.from.id];

  bot.sendMessage(msg.chat.id, `✅ Prizes updated!\n\n${formatPrizes()}`, { parse_mode: "HTML" });
});

// ─── GROUP: /drop ─────────────────────────────────────────────────────────────

bot.onText(/\/drop/, async (msg) => {
  if (msg.chat.type === "private") return;
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, "⛔ Only the admin can drop questions.");
  }

  const q = db.getNextQuestion();
  if (!q) {
    return bot.sendMessage(
      msg.chat.id,
      "📭 No more questions in the queue! Use /endgame to wrap up."
    );
  }

  db.setActiveQuestion(q);
  const remaining = db.getQuestions().length;

  await bot.sendMessage(
    msg.chat.id,
    `🔥 <b>QUESTION ${db.getDropCount()}!</b>\n\n` +
      `❓ <b>${escapeHtml(q.question)}</b>\n\n` +
      `⚡ First correct answer wins a point!\n` +
      `📦 Questions remaining: ${remaining}`,
    { parse_mode: "HTML" }
  );
});

// ─── GROUP: Answer detection ──────────────────────────────────────────────────

bot.on("message", async (msg) => {
  if (!msg.text || msg.chat.type === "private") return;
  if (msg.text.startsWith("/")) return;

  const active = db.getActiveQuestion();
  if (!active) return;

  const userAnswer = msg.text.trim().toLowerCase();
  const correctAnswer = active.answer.toLowerCase();

  if (userAnswer === correctAnswer) {
    const userId = msg.from.id;
    const name = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : "");

    db.clearActiveQuestion();
    db.addPoint(userId, name);

    const scores = db.getScores();
    const leaderboard = buildLeaderboard(scores);

    // React with ✅
    try {
      await bot.setMessageReaction(msg.chat.id, msg.message_id, {
        reaction: [{ type: "emoji", emoji: "✅" }],
      });
    } catch (_) {
      // Reactions not supported on all bot types — silently skip
    }

    await bot.sendMessage(
      msg.chat.id,
      `✅ <b>${escapeHtml(name)}</b> got it right! <b>+1 point</b>\n\n` +
        `🏆 <b>Leaderboard:</b>\n${leaderboard}`,
      { parse_mode: "HTML", reply_to_message_id: msg.message_id }
    );
  }
});

// ─── GROUP: /leaderboard ──────────────────────────────────────────────────────

bot.onText(/\/leaderboard/, (msg) => {
  if (msg.chat.type === "private") return;

  const scores = db.getScores();
  const leaderboard = buildLeaderboard(scores);

  bot.sendMessage(msg.chat.id, `🏆 <b>Current Leaderboard</b>\n\n${leaderboard}`, {
    parse_mode: "HTML",
  });
});

// ─── GROUP: /endgame ──────────────────────────────────────────────────────────

bot.onText(/\/endgame/, (msg) => {
  if (msg.chat.type === "private") return;
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, "⛔ Only the admin can end the game.");
  }

  const scores = db.getScores();
  db.clearActiveQuestion();

  if (!scores.length) {
    return bot.sendMessage(msg.chat.id, "🎮 Game over! No scores recorded.");
  }

  const top3 = scores.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const prizes = config.PRIZES;

  const winnersText = top3
    .map((s, i) => {
      const prize = prizes[i] ? ` — ${prizes[i]}` : "";
      return `${medals[i]} <b>${escapeHtml(s.name)}</b> (${s.points} pts)${prize}`;
    })
    .join("\n");

  const fullBoard = buildLeaderboard(scores);

  bot.sendMessage(
    msg.chat.id,
    `🎉 <b>GAME OVER — Injective Nigeria Quiz!</b>\n\n` +
      `🏅 <b>Top Winners:</b>\n${winnersText}\n\n` +
      `📊 <b>Full Leaderboard:</b>\n${fullBoard}\n\n` +
      `🔥 Thanks for playing! Stay tuned for the next round.\n` +
      `💜 <b>Injective Nigeria</b>`,
    { parse_mode: "HTML" }
  );
});

console.log("🤖 Injective Nigeria Quiz Bot is running...");