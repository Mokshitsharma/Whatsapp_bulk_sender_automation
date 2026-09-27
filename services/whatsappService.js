/**
 * WhatsApp sending service.
 *
 * Right now this is a MOCK — it simulates network latency and a realistic
 * success/failure rate so you can build and demo the full flow before you
 * have real WhatsApp Business API credentials.
 *
 * WHEN YOU GET YOUR AISENSY / INTERAKT API KEY:
 * Replace the body of `sendWhatsAppTemplate` below with a real fetch call.
 * Both providers follow roughly the same shape. Examples:
 *
 * --- AiSensy example ---
 * const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     apiKey: process.env.AISENSY_API_KEY,
 *     campaignName: templateName,
 *     destination: to,              // e.g. "919876543210"
 *     userName: variables.name,
 *     media: { url: imageUrl, filename: 'promo.jpg' },
 *     templateParams: Object.values(variables)
 *   })
 * });
 * const data = await res.json();
 * return { success: res.ok, providerMessageId: data.id || null, raw: data };
 *
 * --- Interakt example ---
 * const res = await fetch('https://api.interakt.ai/v1/public/message/', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Basic ${process.env.INTERAKT_API_KEY}`
 *   },
 *   body: JSON.stringify({
 *     countryCode: '+91',
 *     phoneNumber: to,
 *     type: 'Template',
 *     template: {
 *       name: templateName,
 *       languageCode: 'en',
 *       headerValues: [imageUrl],
 *       bodyValues: Object.values(variables)
 *     }
 *   })
 * });
 * const data = await res.json();
 * return { success: res.ok, providerMessageId: data.id || null, raw: data };
 *
 * Either way, keep the function signature the same so nothing else in the
 * app needs to change.
 */

const USE_MOCK = process.env.USE_MOCK_WHATSAPP !== 'false'; // default: mock ON

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @param {Object} params
 * @param {string} params.to - phone number in E.164-ish format, e.g. "919876543210"
 * @param {string} params.templateName - name of the approved WhatsApp template
 * @param {Object} params.variables - key/value pairs to fill template placeholders
 * @param {string} params.imageUrl - URL of the header image
 * @returns {Promise<{success: boolean, providerMessageId: string|null, error: string|null}>}
 */
async function sendWhatsAppTemplate({ to, templateName, variables, imageUrl }) {
  if (!USE_MOCK) {
    throw new Error(
      'USE_MOCK_WHATSAPP=false but no real provider integration is wired up yet. ' +
      'Fill in the AiSensy/Interakt call in services/whatsappService.js'
    );
  }

  // Simulate realistic network latency (200ms - 900ms)
  await delay(200 + Math.random() * 700);

  // Simulate ~92% success rate, with a few realistic-looking failure reasons
  const isSuccess = Math.random() < 0.92;

  if (isSuccess) {
    return {
      success: true,
      providerMessageId: 'mock_' + Math.random().toString(36).slice(2, 12),
      error: null
    };
  }

  const failureReasons = [
    'Invalid phone number',
    'Number not on WhatsApp',
    'Template not approved for this number\'s region',
    'Rate limit exceeded, retry later'
  ];
  const reason = failureReasons[Math.floor(Math.random() * failureReasons.length)];

  return { success: false, providerMessageId: null, error: reason };
}

module.exports = { sendWhatsAppTemplate };
