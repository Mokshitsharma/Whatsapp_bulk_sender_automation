/**
 * Normalizes an Indian phone number to WhatsApp's expected format: "91XXXXXXXXXX"
 * Accepts inputs like: 9876543210, +919876543210, 91-9876543210, 09876543210
 * Returns null if the number doesn't look like a valid 10-digit Indian mobile number.
 */
function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/[^0-9]/g, '');

  // Strip leading 0 (e.g. "09876543210")
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Strip country code if present
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }

  // Must now be exactly 10 digits, starting with 6-9 (valid Indian mobile prefix)
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return '91' + digits;
  }

  return null;
}

/**
 * Guess which column in a parsed row corresponds to phone/name/city
 * by matching common header names, case-insensitively.
 */
function detectColumns(headers) {
  const lower = headers.map(h => String(h).toLowerCase().trim());
  const find = (candidates) => {
    for (const c of candidates) {
      const idx = lower.indexOf(c);
      if (idx !== -1) return headers[idx];
    }
    return null;
  };
  return {
    phone: find(['phone', 'mobile', 'number', 'phone number', 'mobile number', 'contact']),
    name: find(['name', 'retailer name', 'driver name', 'full name']),
    city: find(['city', 'area', 'location', 'town'])
  };
}

module.exports = { normalizePhone, detectColumns };
