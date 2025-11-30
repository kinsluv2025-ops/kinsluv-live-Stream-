// db.js
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'kinsluv.db'));

function init(){
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT,
      role TEXT DEFAULT 'viewer',
      coins INTEGER DEFAULT 100,
      banned INTEGER DEFAULT 0
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room TEXT,
      user_id TEXT,
      username TEXT,
      text TEXT,
      time INTEGER
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS gifts (
      id TEXT PRIMARY KEY,
      name TEXT,
      cost INTEGER
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      gift_id TEXT,
      room TEXT,
      time INTEGER
    )
  `).run();

  const cnt = db.prepare('SELECT COUNT(*) as c FROM gifts').get().c;
  if(cnt === 0){
    const insert = db.prepare('INSERT INTO gifts (id, name, cost) VALUES (?, ?, ?)');
    insert.run('g1','Rose', 5);
    insert.run('g2','Heart', 20);
    insert.run('g3','Diamond', 100);
  }
}

function createUser(id, username, passwordHash=null, role='viewer'){
  db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, role, coins, banned) VALUES (?, ?, ?, ?, ?, 0)')
    .run(id, username, passwordHash, role, 100);
  return getUserById(id) || getUserByName(username);
}

function getUserById(id){
  return db.prepare('SELECT id, username, role, coins, banned FROM users WHERE id = ?').get(id);
}

function getUserByName(username){
  return db.prepare('SELECT id, username, role, coins, banned FROM users WHERE username = ?').get(username);
}

function getUserAuth(username){
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function changeCoins(id, delta){
  db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(delta, id);
  return getUserById(id);
}

function banUser(id){
  db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(id);
  return getUserById(id);
}

function unbanUser(id){
  db.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(id);
  return getUserById(id);
}

function saveMessage(id, room, user_id, username, text, time){
  db.prepare('INSERT INTO messages (id, room, user_id, username, text, time) VALUES (?, ?, ?, ?, ?, ?)').run(id, room, user_id, username, text, time);
}

function recentMessages(room='main', limit=100){
  return db.prepare('SELECT * FROM messages WHERE room = ? ORDER BY time DESC LIMIT ?').all(room, limit).reverse();
}

function deleteMessage(id){
  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
}

function listGifts(){
  return db.prepare('SELECT * FROM gifts').all();
}

function recordTransaction(id, user_id, gift_id, room, time){
  db.prepare('INSERT INTO transactions (id, user_id, gift_id, room, time) VALUES (?, ?, ?, ?, ?)').run(id, user_id, gift_id, room, time);
}

function listTransactions(limit=200){
  return db.prepare(`
    SELECT t.*, u.username, g.name as gift_name, g.cost
    FROM transactions t
    LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN gifts g ON g.id = t.gift_id
    ORDER BY t.time DESC
    LIMIT ?
  `).all(limit);
}

function allUsers(){
  return db.prepare('SELECT id, username, role, coins, banned FROM users ORDER BY username').all();
}

function stats(){
  const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const messages = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
  const gifts = db.prepare('SELECT COUNT(*) as c FROM transactions').get().c;
  return { users, messages, gifts };
}

module.exports = {
  init,
  createUser,
  getUserById,
  getUserByName,
  getUserAuth,
  changeCoins,
  banUser,
  unbanUser,
  saveMessage,
  recentMessages,
  deleteMessage,
  listGifts,
  recordTransaction,
  listTransactions,
  allUsers,
  stats
};
