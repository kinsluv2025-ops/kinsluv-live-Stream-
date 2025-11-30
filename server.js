// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_jwt_secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'supersecret_admin_pass';

db.init();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Public APIs
app.get('/api/gifts', (req,res) => res.json(db.listGifts()));
app.get('/api/messages', (req,res) => res.json(db.recentMessages('main', 100)));
app.get('/api/stats', (req,res) => res.json(db.stats()));

// register (username + optional password) -> returns token + user
app.post('/api/register', async (req,res) => {
  try {
    const { username, password, role } = req.body;
    if(!username) return res.status(400).json({ error: 'username required' });
    const id = uuidv4();
    const password_hash = password ? await bcrypt.hash(password, 10) : null;
    const user = db.createUser(id, username, password_hash, role || 'viewer');
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user, token });
  } catch(err) { res.status(500).json({ error: String(err) }); }
});

// login (username + password)
app.post('/api/login', async (req,res) => {
  try {
    const { username, password } = req.body;
    const record = db.getUserAuth(username);
    if(!record || !record.password_hash) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, record.password_hash);
    if(!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = jwt.sign({ id: record.id, username: record.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user: { id: record.id, username: record.username, coins: record.coins, role: record.role }, token });
  } catch(err) { res.status(500).json({ error: String(err) }); }
});

// top-up (demo) using token in body
app.post('/api/topup', (req,res) => {
  try {
    const { token, amount } = req.body;
    const payload = jwt.verify(token, JWT_SECRET);
    db.changeCoins(payload.id, Number(amount || 50));
    res.json({ user: db.getUserById(payload.id) });
  } catch(err) { res.status(401).json({ error: 'invalid token' }); }
});

// --- ADMIN ROUTES (simple header password auth) ---
function adminAuth(req,res,next){
  const pass = req.headers['x-admin-pass'];
  if(pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/admin', (req,res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.get('/admin/users', adminAuth, (req,res) => res.json(db.allUsers()));
app.get('/admin/transactions', adminAuth, (req,res) => res.json(db.listTransactions(500)));
app.get('/admin/stats', adminAuth, (req,res) => res.json(db.stats()));

app.post('/admin/add-coins', adminAuth, (req,res) => {
  const { userId, amount } = req.body;
  if(!userId || !amount) return res.status(400).json({ error: 'userId and amount required' });
  db.changeCoins(userId, Number(amount));
  res.json({ user: db.getUserById(userId) });
});

app.post('/admin/ban', adminAuth, (req,res) => {
  const { userId } = req.body;
  if(!userId) return res.status(400).json({ error: 'userId required' });
  res.json(db.banUser(userId));
});

app.post('/admin/unban', adminAuth, (req,res) => {
  const { userId } = req.body;
  if(!userId) return res.status(400).json({ error: 'userId required' });
  res.json(db.unbanUser(userId));
});

app.post('/admin/delete-message', adminAuth, (req,res) => {
  const { messageId } = req.body;
  if(!messageId) return res.status(400).json({ error: 'messageId required' });
  db.deleteMessage(messageId);
  res.json({ success: true });
});

// Socket.IO real-time (multi-room)
io.on('connection', (socket) => {
  console.log('conn', socket.id);

  // Expect client to emit 'join' with token or {id,username} and room
  socket.on('join', (payload) => {
    try {
      let user = null;
      if(payload?.token){
        const p = jwt.verify(payload.token, JWT_SECRET);
        user = db.getUserById(p.id);
      }
      if(!user && payload?.id && payload?.username){
        user = db.getUserById(payload.id) || db.createUser(payload.id, payload.username);
      }
      if(!user) { socket.emit('error', { message: 'Auth required' }); return; }
      if(user.banned) { socket.emit('banned'); return; }

      socket.user = user;
      const room = payload.room || 'main';
      socket.join(room);

      // announce
      io.to(room).emit('system', { text: `${user.username} joined`, room });

      // send state
      socket.emit('state', {
        user,
        gifts: db.listGifts(),
        messages: db.recentMessages(room, 100)
      });
    } catch(err){
      socket.emit('error', { message: 'Invalid token' });
    }
  });

  socket.on('message', (payload) => {
    if(!socket.user) return;
    if(socket.user.banned) return;
    const room = payload.room || 'main';
    const id = uuidv4();
    const time = Date.now();
    db.saveMessage(id, room, socket.user.id, socket.user.username, payload.text, time);
    const msg = { id, room, user_id: socket.user.id, username: socket.user.username, text: payload.text, time };
    io.to(room).emit('message', msg);
  });

  socket.on('gift', (payload) => {
    if(!socket.user) return;
    if(socket.user.banned) return;
    const room = payload.room || 'main';
    const gifts = db.listGifts();
    const gift = gifts.find(g => g.id === payload.giftId);
    if(!gift){ socket.emit('error', { message: 'Gift not found' }); return; }
    const userBefore = db.getUserById(socket.user.id);
    if(userBefore.coins < gift.cost){ socket.emit('error', { message: 'Not enough coins' }); return; }

    db.changeCoins(socket.user.id, -gift.cost);
    db.recordTransaction(uuidv4(), socket.user.id, gift.id, room, Date.now());
    const userAfter = db.getUserById(socket.user.id);

    io.to(room).emit('gift', {
      from: socket.user.username,
      gift,
      userCoins: userAfter.coins,
      room,
      time: Date.now()
    });
  });

  socket.on('disconnect', () => {
    if(socket.user){
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      rooms.forEach(r => io.to(r).emit('system', { text: `${socket.user.username} left`, room: r }));
    }
  });
});

server.listen(PORT, () => console.log(`Kinsluv Live Stream running on http://localhost:${PORT}`));
