// client.js
const socket = io();

// DOM
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const roomInput = document.getElementById('roomInput');
const messagesEl = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const giftsList = document.getElementById('giftsList');
const userInfo = document.getElementById('userInfo');
const meName = document.getElementById('meName');
const meCoins = document.getElementById('meCoins');
const giftAnimation = document.getElementById('giftAnimation');

let currentUser = null;
let token = null;
let currentRoom = 'main';
let gifts = [];

// escape
function esc(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function addMessage(m){
  const div = document.createElement('div');
  div.className = 'message';
  const time = new Date(m.time || Date.now()).toLocaleTimeString();
  div.innerHTML = `<strong>${esc(m.username||'System')}</strong> <span style="opacity:.6">[${time}]</span><div>${esc(m.text||'')}</div>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addSystem(text){
  const div = document.createElement('div');
  div.className = 'message';
  div.innerHTML = `<em style="opacity:.8">${esc(text)}</em>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderGifts(){
  giftsList.innerHTML = '';
  gifts.forEach(g => {
    const el = document.createElement('div');
    el.className = 'giftItem';
    el.innerHTML = `<div><strong>${esc(g.name)}</strong><div style="opacity:.7">cost: ${g.cost}</div></div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Send';
    btn.onclick = () => sendGift(g.id);
    el.appendChild(btn);
    giftsList.appendChild(el);
  });
}

async function loadGifts(){
  const res = await fetch('/api/gifts');
  gifts = await res.json();
  renderGifts();
}

function showGiftAnimation(text){
  const el = document.createElement('div');
  el.className = 'giftBurst';
  el.textContent = text;
  giftAnimation.appendChild(el);
  setTimeout(()=> el.remove(), 1100);
}

joinBtn.onclick = async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const room = (roomInput.value || 'main').trim();
  if(!username){ alert('Pick a username'); return; }
  currentRoom = room || 'main';

  const res = await fetch('/api/register', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if(!res.ok){ alert(data.error || 'Register failed'); return; }

  token = data.token;
  currentUser = data.user;
  meName.textContent = currentUser.username;
  meCoins.textContent = currentUser.coins;
  userInfo.classList.remove('hidden');

  socket.emit('join', { token, room: currentRoom });
};

sendBtn.onclick = () => {
  if(!currentUser){ alert('Join first'); return; }
  const text = msgInput.value.trim();
  if(!text) return;
  socket.emit('message', { room: currentRoom, text });
  msgInput.value = '';
};

msgInput.addEventListener('keydown', e => { if(e.key==='Enter') sendBtn.click(); });

async function sendGift(giftId){
  if(!currentUser){ alert('Join first'); return; }
  socket.emit('gift', { room: currentRoom, giftId });
}

socket.on('connect', () => console.log('socket connected'));
socket.on('state', (s) => {
  if(s.messages) s.messages.forEach(addMessage);
  if(s.gifts){ gifts = s.gifts; renderGifts(); }
  if(s.user){ meName.textContent = s.user.username; meCoins.textContent = s.user.coins; userInfo.classList.remove('hidden'); }
});
socket.on('message', m => addMessage(m));
socket.on('system', s => addSystem(s.text));
socket.on('gift', g => {
  const msg = { username: g.from, text: `sent ${g.gift.name} ✨`, time: g.time };
  addMessage(msg);
  showGiftAnimation(`${g.from} ▶ ${g.gift.name}`);
  if(currentUser && g.from === currentUser.username){
    meCoins.textContent = g.userCoins;
  }
});
socket.on('banned', () => {
  alert('You are banned.');
});
socket.on('error', e => {
  console.warn('error', e);
});
loadGifts();
