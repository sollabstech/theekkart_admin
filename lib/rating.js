// Customer ratings (1–5 stars) for a store, a rider or a product. The Customer
// app writes them in one transaction; the Admin only shows them. The rule that
// turns "one more rating" into the stored fields is the same in
// THEEKART_FLUTTER/lib/models/rating.dart (shared fixture
// tests/fixtures/rating_cases.json). Pure (tested).

/** 1–5 whole stars, or null. */
export function validStars(x) {
  return Number.isInteger(x) && x >= 1 && x <= 5 ? x : null;
}

const round2 = n => Math.round(n * 100) / 100;

/**
 * Fields to store after adding [stars] to [doc]. A document from before ratings
 * had counts (only `rating` + `ratingCount`) keeps its weight; one with only a
 * `rating` and no count starts counting from this rating.
 */
export function applyRating(doc, stars) {
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  let count = num(doc?.ratingCount);
  count = count !== null && count > 0 ? Math.floor(count) : 0;
  let sum = num(doc?.ratingSum);
  if (sum === null || sum < 0) {
    const avg = num(doc?.rating);
    sum = count > 0 && avg !== null ? Math.round(avg * count) : 0;
    if (!(count > 0 && avg !== null)) count = 0;
  }
  const ratingCount = count + 1;
  const ratingSum = sum + stars;
  return { ratingSum, ratingCount, rating: round2(ratingSum / ratingCount) };
}

/** "4.3 (12)" for display; '' when nobody has rated. */
export function ratingLabel(doc) {
  const r = Number(doc?.rating);
  if (!(r > 0)) return '';
  const n = Number(doc?.ratingCount);
  return n > 0 ? `${r.toFixed(1)} (${n})` : r.toFixed(1);
}
