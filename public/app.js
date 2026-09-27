// State
const state = {
  headers: [],
  rows: [],
  suggestedColumns: {},
  phoneColumn: null,
  columnMapping: {}, // { name: 'colA', city: 'colB' }
  currentCampaignId: null,
  pollTimer: null
};

// Nav
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = btn.dataset.view;
    document.getElementById('view-' + view).classList.add('active');
    if (view === 'history') loadHistory();
  });
});

// Step navigation
function goToStep(n) {
  for (let i = 1; i <= 4; i++) {
    document.getElementById('panel-' + i).classList.toggle('hidden', i !== n);
  }
  document.querySelectorAll('.step').forEach(s => {
    s.classList.toggle('active', Number(s.dataset.step) === n);
  });
}

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => goToStep(Number(btn.dataset.back)));
});

// Step 1: Upload
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');

dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

async function handleFile(file) {
  uploadStatus.textContent = 'Parsing ' + file.name + '...';
  uploadStatus.className = 'upload-status';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    state.headers = data.headers;
    state.rows = data.rows;
    state.suggestedColumns = data.suggestedColumns;

    uploadStatus.textContent = `✓ Parsed ${data.totalRows} rows from ${file.name}`;
    uploadStatus.className = 'upload-status success';

    buildMappingStep();
    setTimeout(() => goToStep(2), 400);
  } catch (err) {
    uploadStatus.textContent = '✗ ' + err.message;
    uploadStatus.className = 'upload-status error';
  }
}

// Step 2: Column mapping
function buildMappingStep() {
  const grid = document.getElementById('mappingGrid');
  const fields = [
    { key: 'phone', label: 'Phone number column', required: true },
    { key: 'name', label: 'Name (for {{name}})', required: false },
    { key: 'city', label: 'City (for {{city}})', required: false }
  ];

  grid.innerHTML = fields.map(f => {
    const options = state.headers.map(h => {
      const suggested = state.suggestedColumns[f.key] === h;
      return `<option value="${h}" ${suggested ? 'selected' : ''}>${h}</option>`;
    }).join('') + `<option value="">— none —</option>`;

    return `
      <div class="map-field">
        <label>${f.label}${f.required ? ' *' : ''}</label>
        <select data-key="${f.key}">
          ${options}
        </select>
      </div>
    `;
  }).join('');

  // Preview table
  const table = document.getElementById('previewTable');
  const previewRows = state.rows.slice(0, 10);
  table.innerHTML =
    '<thead><tr>' + state.headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>' +
    '<tbody>' + previewRows.map(r =>
      '<tr>' + state.headers.map(h => `<td>${r[h]}</td>`).join('') + '</tr>'
    ).join('') + '</tbody>';

  document.getElementById('rowCount').textContent = `${state.rows.length} total rows`;
}

document.getElementById('toStep3').addEventListener('click', () => {
  const selects = document.querySelectorAll('#mappingGrid select');
  const mapping = {};
  selects.forEach(s => { mapping[s.dataset.key] = s.value; });

  if (!mapping.phone) {
    alert('Please select a phone number column.');
    return;
  }

  state.phoneColumn = mapping.phone;
  state.columnMapping = {};
  if (mapping.name) state.columnMapping.name = mapping.name;
  if (mapping.city) state.columnMapping.city = mapping.city;

  const varList = Object.keys(state.columnMapping).map(v => `{{${v}}}`).join(', ') || 'none mapped';
  document.getElementById('variableHint').innerHTML = `Available variables: <b>${varList}</b>`;

  goToStep(3);
});

// Step 3: Compose + live preview
const messageInput = document.getElementById('messageTemplate');
const imageUrlInput = document.getElementById('imageUrl');
const previewImg = document.getElementById('previewImg');
const previewText = document.getElementById('previewText');

function updatePreview() {
  let text = messageInput.value || 'Your message preview appears here.';
  const sampleRow = state.rows[0] || {};
  for (const [varName, colName] of Object.entries(state.columnMapping)) {
    const sampleValue = sampleRow[colName] || `[${varName}]`;
    text = text.replaceAll(`{{${varName}}}`, sampleValue);
  }
  previewText.textContent = text;

  if (imageUrlInput.value.trim()) {
    previewImg.src = imageUrlInput.value.trim();
    previewImg.classList.remove('hidden');
    previewImg.onerror = () => previewImg.classList.add('hidden');
  } else {
    previewImg.classList.add('hidden');
  }
}

messageInput.addEventListener('input', updatePreview);
imageUrlInput.addEventListener('input', updatePreview);

document.getElementById('toStep4').addEventListener('click', () => {
  if (!messageInput.value.trim()) {
    alert('Please write a message body.');
    return;
  }
  buildReviewStep();
  goToStep(4);
});

// Step 4: Review + send
function normalizePhonePreview(raw) {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 10 && /^[6-9]/.test(digits)) return '91' + digits;
  return null;
}

function buildReviewStep() {
  const valid = state.rows.filter(r => normalizePhonePreview(r[state.phoneColumn]));
  const invalid = state.rows.length - valid.length;

  document.getElementById('sumTotal').textContent = valid.length;
  document.getElementById('sumInvalid').textContent = invalid;
  document.getElementById('sumTemplate').textContent = document.getElementById('templateName').value || '—';

  document.getElementById('sendProgress').classList.add('hidden');
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('sendBtn').textContent = 'Send broadcast →';
}

document.getElementById('sendBtn').addEventListener('click', startCampaign);

async function startCampaign() {
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Starting...';

  const payload = {
    name: document.getElementById('campaignName').value || 'Untitled Campaign',
    phoneColumn: state.phoneColumn,
    columnMapping: state.columnMapping,
    rows: state.rows,
    messageTemplate: messageInput.value,
    imageUrl: imageUrlInput.value,
    templateName: document.getElementById('templateName').value,
    sendIntervalMs: Number(document.getElementById('sendInterval').value)
  };

  try {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start campaign');

    state.currentCampaignId = data.campaignId;
    sendBtn.textContent = 'Sending...';
    document.getElementById('sendProgress').classList.remove('hidden');
    document.getElementById('logList').innerHTML = '';
    pollCampaign();
  } catch (err) {
    alert('Error: ' + err.message);
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send broadcast →';
  }
}

function pollCampaign() {
  if (state.pollTimer) clearInterval(state.pollTimer);

  const logList = document.getElementById('logList');
  const seenPhones = new Set();

  state.pollTimer = setInterval(async () => {
    const res = await fetch(`/api/campaigns/${state.currentCampaignId}`);
    const campaign = await res.json();

    const donePct = Math.round(((campaign.sentCount + campaign.failedCount) / campaign.total) * 100);
    document.getElementById('progressFill').style.width = donePct + '%';
    document.getElementById('progressText').textContent =
      campaign.status === 'completed' ? 'Completed' : 'Sending...';
    document.getElementById('progressCounts').textContent =
      `${campaign.sentCount} sent · ${campaign.failedCount} failed · ${campaign.total} total`;

    campaign.recipients.forEach(r => {
      if (r.status !== 'pending' && !seenPhones.has(r.phone)) {
        seenPhones.add(r.phone);
        const row = document.createElement('div');
        row.className = 'log-row';
        row.innerHTML = `<span>${r.phone}</span><span class="log-status ${r.status}">${r.status === 'sent' ? '✓ sent' : '✗ ' + (r.error || 'failed')}</span>`;
        logList.prepend(row);
      }
    });

    if (campaign.status === 'completed') {
      clearInterval(state.pollTimer);
      document.getElementById('sendBtn').textContent = 'Sent ✓';
      const exportBtn = document.getElementById('exportBtn');
      exportBtn.href = `/api/campaigns/${campaign.id}/export`;
      exportBtn.classList.remove('hidden');
    }
  }, 1000);
}

// History view
async function loadHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '<div class="empty-state">Loading...</div>';

  const res = await fetch('/api/campaigns');
  const campaigns = await res.json();

  if (campaigns.length === 0) {
    list.innerHTML = '<div class="empty-state">No campaigns sent yet. Start one from "New campaign".</div>';
    return;
  }

  list.innerHTML = campaigns.map(c => `
    <div class="history-card">
      <div>
        <div class="history-card-name">${c.name}</div>
        <div class="history-card-meta">${new Date(c.createdAt).toLocaleString()} · template: ${c.templateName}</div>
      </div>
      <div class="history-card-stats">
        <div class="history-stat"><b>${c.sentCount}</b>sent</div>
        <div class="history-stat"><b>${c.failedCount}</b>failed</div>
        <div class="history-stat"><b>${c.total}</b>total</div>
        <a class="btn ghost small" href="/api/campaigns/${c.id}/export">Export CSV</a>
      </div>
    </div>
  `).join('');
}
