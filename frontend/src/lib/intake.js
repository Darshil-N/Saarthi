import { format, parseISO } from 'date-fns';

/**
 * Check every line the way the server will, so problems are shown next to the
 * row instead of coming back as a failed request. Returns human-readable messages.
 */
export function validateLineItems(items) {
  const problems = [];
  items.forEach((item, index) => {
    const line = `Line ${index + 1}`;
    if (!String(item.description ?? '').trim()) problems.push(`${line}: description is required`);
    if (!(Number(item.quantity) > 0)) problems.push(`${line}: quantity must be greater than 0`);
    if (!String(item.unit ?? '').trim()) problems.push(`${line}: unit is required`);
    if (item.unit_price === null || item.unit_price === '' || !(Number(item.unit_price) >= 0)) {
      problems.push(`${line}: unit price is required`);
    }
    if (!item.quality_grade) problems.push(`${line}: choose a quality grade`);
    if (!item.location_code) problems.push(`${line}: choose a storage location`);
  });
  return problems;
}

/** Shape the store's draft into the body of POST /intake/confirm. */
export function buildConfirmPayload(draft) {
  return {
    vendor_id: draft.vendor_id,
    receipt_date: draft.receipt_date,
    po_number: draft.po_number?.trim() || null,
    bill_image_path: draft.bill_image_path || null,
    client_draft_id: draft.draft_id,
    line_items: draft.line_items,
  };
}

/** Drop filters that mean "no filter" ('', 'all', null) so they are not sent to the API. */
export function cleanFilters(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value !== 'all' && value != null)
  );
}

/** "2026-09-19" -> "19 Sep 2026" (parsed as a calendar date, so no timezone shift). */
export function formatReceiptDate(value) {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'dd MMM yyyy');
  } catch {
    return String(value);
  }
}

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
}
