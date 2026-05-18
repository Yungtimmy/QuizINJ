/**
 * config.js — Bot configuration
 * Fill in BOT_TOKEN and ADMIN_ID before running.
 */

module.exports = {
  // Your bot token from @BotFather
  BOT_TOKEN: process.env.BOT_TOKEN || "8981981825:AAG3cHI8Io0Rr57WNnRpZDNMNYhGTk52fFA",

  // Telegram user ID of the one admin who can use /drop, /endgame, /add, etc.
  // Get your ID from @userinfobot on Telegram
  ADMIN_ID: process.env.ADMIN_ID || "6090484839",

  // Prize text shown when game ends — edit freely, add/remove lines
  PRIZES: [
    "1st Place = $3",
    "2nd Place = $3",
    "3rd Place = $3",
  ],
};