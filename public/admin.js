// admin.js
let ADMIN_PASS = '';
const headers = () => ({ 'x-admin-pass': ADMIN_PASS, 'Content-Type': 'application/json' });

document.getElementById('adminLogin').onclick = async () => {
  ADMIN_PASS = document.getElementById('adminPass').value;
  if(!ADMIN_PASS){ alert('Enter admin password'); return; }
  document.getElementById('loginBox').classList.add('hidden');
  document.getElementById('panel').classList.remove('hidden');
  await loadStats();
  await loadUsers();
  await loadTx();
};

async function loadStats(){
  const r = await fetch('/admin/stats', { headers: { 'x-admin-pass': ADMIN_PASS } });
  const s = await r.json();
  document.getElementById('stats').innerText = `Users: ${s.users} — Messages: ${s.messages} — Gifts: ${s.gifts}`;
}

async function loadUsers(){
  const r = await fetch('/admin/users', { headers: { 'x-admin-pass': ADMIN_PASS } });
  const users = await r.json();
  const tb = document.querySelector('#usersTable tbody');
  tb.innerHTML = '';
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.id}</td><td>${u.username}</td><td>${u.role}</td><td>${u.coins}</td><td>${u.banned}</td>`;
    tb.appendChild(tr);
  });
}

async function loadTx(){
  const r = await fetch('/admin/transactions', { headers: { 'x-admin-pass': ADMIN_PASS } });
  const tx = await r.json();
  const tb = document.querySelector('#txTable tbody');
  tb.innerHTML = '';
  tx.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.username||t.user_id}</td><td>${t.gift_name}</td><td>${t.cost}</td><td>${t.room}</td><td>${new Date(t.time).toLocaleString()}</td>`;
    tb.appendChild(tr);
  });
}

document.getElementById('addCoinsBtn').onclick = async () => {
  const userId = document.getElementById('userIdField').value;
  const amount = Number(document.getElementById('amountField').value);
  if(!userId || !amount) return alert('userId + amount required');
  await fetch('/admin/add-coins', { method:'POST', headers: headers(), body: JSON.stringify({ userId, amount }) });
  alert('Added');
  await loadUsers();
};

document.getElementById('banBtn').onclick = async () => {
  const userId = document.getElementById('userIdField').value;
  if(!userId) return alert('userId required');
  await fetch('/admin/ban', { method:'POST', headers: headers(), body: JSON.stringify({ userId }) });
  alert('Banned');
  await loadUsers();
};

document.getElementById('unbanBtn').onclick = async () => {
  const userId = document.getElementById('userIdField').value;
  if(!userId) return alert('userId required');
  await fetch('/admin/unban', { method:'POST', headers: headers(), body: JSON.stringify({ userId }) });
  alert('Unbanned');
  await loadUsers();
};

document.getElementById('delMsgBtn').onclick = async () => {
  const messageId = document.getElementById('msgIdField').value;
  if(!messageId) return alert('messageId required');
  await fetch('/admin/delete-message', { method:'POST', headers: headers(), body: JSON.stringify({ messageId }) });
  alert('Deleted');
};
