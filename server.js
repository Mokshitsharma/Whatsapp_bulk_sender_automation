const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const campaignStore = require('./services/campaignStore');
const { sendWhatsAppTemplate } = require('./services/whatsappService');
const { normalizePhone, detectColumns } = require('./services/phoneUtils');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: path.join(__dirname, 'uploads') });

// Ensure data file exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DB_FILE = path.join(DATA_DIR, 'campaigns.json');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');

// Parses an uploaded CSV/XLSX and returns headers + preview rows
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    fs.unlinkSync(req.file.path); // clean up temp upload

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File appears to be empty' });
    }

    const headers = Object.keys(rows[0]);
    const suggestedColumns = detectColumns(headers);

    res.json({
      headers,
      suggestedColumns,
      totalRows: rows.length,
      preview: rows.slice(0, 10),
      rows // full data sent back to client; for very large files you'd paginate/store server-side instead
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to parse file: ' + err.message });
  }
});

// Creates a campaign and kicks off sending
app.post('/api/campaigns', async (req, res) => {
  const {
    name,
    phoneColumn,
    columnMapping = {},
    rows,
    messageTemplate,
    imageUrl,
    templateName,
    sendIntervalMs
  } = req.body;

  if (!phoneColumn || !rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'phoneColumn and rows are required' });
  }

  // Build recipient list with normalized phone numbers, skip invalid ones
  const recipients = [];
  const invalid = [];

  for (const row of rows) {
    const phone = normalizePhone(row[phoneColumn]);
    if (!phone) {
      invalid.push(row[phoneColumn]);
      continue;
    }
    const variables = {};
    for (const [varName, colName] of Object.entries(columnMapping)) {
      variables[varName] = row[colName] !== undefined ? String(row[colName]) : '';
    }
    recipients.push({
      phone,
      rawInput: row[phoneColumn],
      variables,
      status: 'pending', // pending -> sent | failed
      providerMessageId: null,
      error: null,
      sentAt: null
    });
  }

  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No valid phone numbers found in file', invalidCount: invalid.length });
  }

  const campaign = {
    id: uuidv4(),
    name: name || 'Untitled Campaign',
    createdAt: new Date().toISOString(),
    messageTemplate,
    imageUrl,
    templateName: templateName || 'promo_broadcast',
    status: 'sending', // sending -> completed
    total: recipients.length,
    invalidSkipped: invalid.length,
    sentCount: 0,
    failedCount: 0,
    recipients
  };

  campaignStore.create(campaign);

  // Fire off async sending loop — don't block the response
  const interval = Math.max(150, Number(sendIntervalMs) || 400);
  runCampaign(campaign.id, interval);

  res.json({ campaignId: campaign.id, total: recipients.length, invalidSkipped: invalid.length });
});

async function runCampaign(campaignId, intervalMs) {
  const campaign = campaignStore.get(campaignId);
  if (!campaign) return;

  for (const recipient of campaign.recipients) {
    const result = await sendWhatsAppTemplate({
      to: recipient.phone,
      templateName: campaign.templateName,
      variables: recipient.variables,
      imageUrl: campaign.imageUrl
    });

    const patch = result.success
      ? { status: 'sent', providerMessageId: result.providerMessageId, sentAt: new Date().toISOString() }
      : { status: 'failed', error: result.error, sentAt: new Date().toISOString() };

    campaignStore.updateRecipient(campaignId, recipient.phone, patch);

    const current = campaignStore.get(campaignId);
    campaignStore.update(campaignId, {
      sentCount: current.recipients.filter(r => r.status === 'sent').length,
      failedCount: current.recipients.filter(r => r.status === 'failed').length
    });

    await new Promise(r => setTimeout(r, intervalMs));
  }

  campaignStore.update(campaignId, { status: 'completed', completedAt: new Date().toISOString() });
}

// Polls campaign progress
app.get('/api/campaigns/:id', (req, res) => {
  const campaign = campaignStore.get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

// Lists campaign history
app.get('/api/campaigns', (req, res) => {
  res.json(campaignStore.list());
});

// Downloads campaign results as CSV
app.get('/api/campaigns/:id/export', (req, res) => {
  const campaign = campaignStore.get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const header = 'phone,status,providerMessageId,error,sentAt\n';
  const lines = campaign.recipients.map(r =>
    [r.phone, r.status, r.providerMessageId || '', (r.error || '').replace(/,/g, ';'), r.sentAt || ''].join(',')
  );
  const csv = header + lines.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="campaign_${campaign.id}.csv"`);
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`WhatsApp Broadcast Tool running at http://localhost:${PORT}`);
  console.log(`Mock WhatsApp sending is ${process.env.USE_MOCK_WHATSAPP === 'false' ? 'OFF (real API expected)' : 'ON'}`);
});
