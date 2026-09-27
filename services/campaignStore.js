const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'campaigns.json');

function loadAll() {
  if (!fs.existsSync(DB_FILE)) return {};
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to read campaigns.json, starting fresh.', e.message);
    return {};
  }
}

function saveAll(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function create(campaign) {
  const all = loadAll();
  all[campaign.id] = campaign;
  saveAll(all);
  return campaign;
}

function update(id, patch) {
  const all = loadAll();
  if (!all[id]) return null;
  all[id] = { ...all[id], ...patch };
  saveAll(all);
  return all[id];
}

function updateRecipient(id, phone, patch) {
  const all = loadAll();
  if (!all[id]) return null;
  const recipient = all[id].recipients.find(r => r.phone === phone);
  if (recipient) Object.assign(recipient, patch);
  saveAll(all);
  return all[id];
}

function get(id) {
  const all = loadAll();
  return all[id] || null;
}

function list() {
  const all = loadAll();
  return Object.values(all).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = { create, update, updateRecipient, get, list };
