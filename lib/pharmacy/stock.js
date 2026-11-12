/** First-expiry-first-out: take from the batch expiring soonest, skipping anything already expired. */
export function allocateFefo(batches, quantity, today = new Date()) {
  const usable = batches
    .filter((b) => b.quantity > 0 && new Date(b.expiryDate) > today)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  const available = usable.reduce((s, b) => s + b.quantity, 0);
  if (available < quantity) return { ok: false, available };
  const allocations = [];
  let left = quantity;
  for (const b of usable) {
    if (!left) break;
    const take = Math.min(left, b.quantity);
    allocations.push({ batchId: b.id, batchNumber: b.batchNumber, quantity: take });
    left -= take;
  }
  return { ok: true, allocations };
}
