/**
 * db.js — In-memory store for the quiz session.
 * For persistence across restarts, swap with a JSON file or SQLite.
 */

let questions = [];        // queued questions [{question, answer}]
let activeQuestion = null; // currently live question
let scores = {};           // { userId: { name, points } }
let dropCount = 0;         // how many questions have been dropped

// ─── Questions ───────────────────────────────────────────────────────────────

function addQuestion(q) {
  questions.push({ question: q.question, answer: q.answer });
}

function getQuestions() {
  return questions;
}

function getNextQuestion() {
  if (!questions.length) return null;
  dropCount++;
  return questions.shift();
}

// ─── Active Question ─────────────────────────────────────────────────────────

function setActiveQuestion(q) {
  activeQuestion = q;
}

function getActiveQuestion() {
  return activeQuestion;
}

function clearActiveQuestion() {
  activeQuestion = null;
}

// ─── Scores ──────────────────────────────────────────────────────────────────

function addPoint(userId, name) {
  if (!scores[userId]) {
    scores[userId] = { name, points: 0 };
  }
  scores[userId].name = name; // keep name fresh
  scores[userId].points += 1;
}

function getScores() {
  return Object.values(scores).sort((a, b) => b.points - a.points);
}

// ─── Reset ───────────────────────────────────────────────────────────────────

function clearAll() {
  questions = [];
  activeQuestion = null;
  scores = {};
  dropCount = 0;
}

function getDropCount() {
  return dropCount;
}

module.exports = {
  addQuestion,
  getQuestions,
  getNextQuestion,
  setActiveQuestion,
  getActiveQuestion,
  clearActiveQuestion,
  addPoint,
  getScores,
  clearAll,
  getDropCount,
};