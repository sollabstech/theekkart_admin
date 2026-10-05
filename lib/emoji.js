// Category icons: pick or type one emoji. Pure helpers (tested).

/** Suggested icons for a delivery app, grouped for the picker. */
export const EMOJI_GROUPS = [
  { label: 'Food', icons: ['🍱', '🍛', '🍜', '🍝', '🍕', '🍔', '🌯', '🥪', '🍗', '🍖', '🥘', '🍲', '🍣', '🥗', '🍳', '🥞', '🍟', '🥙', '🍿', '🍢', '🍡'] },
  { label: 'Drinks & sweets', icons: ['☕', '🍵', '🧃', '🥤', '🍹', '🍺', '🍦', '🍨', '🍰', '🎂', '🧁', '🍩', '🍪', '🍫', '🍬', '🍯'] },
  { label: 'Grocery', icons: ['🛒', '🛍️', '🧺', '🥦', '🥕', '🌽', '🍅', '🥔', '🧅', '🧄', '🍎', '🍌', '🍇', '🍉', '🥭', '🥥', '🥚', '🥛', '🧀', '🍞', '🥐', '🥖', '🌾', '🫘', '🧂'] },
  { label: 'Meat & fish', icons: ['🥩', '🍗', '🐟', '🦐', '🦀', '🐔', '🥓'] },
  { label: 'Health & care', icons: ['💊', '💉', '🩺', '🩹', '🧴', '🧼', '🪥', '🧻', '🧹', '🧽', '🌿'] },
  { label: 'Shops & services', icons: ['🏪', '🏬', '🏠', '🔧', '🔨', '💡', '🚰', '🧰', '📦', '🎁', '💐', '📱', '💻', '🐶', '🐱', '👕', '👟', '📚', '✏️', '🎈'] },
];

const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** First "character" (grapheme) of [text], so a long paste keeps just one icon. */
export function firstGrapheme(text) {
  const s = String(text ?? '').trim();
  if (!s) return '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next();
    return it.done ? '' : it.value.segment;
  }
  return Array.from(s)[0];
}

/** True if [text] contains an emoji. */
export function hasEmoji(text) {
  return PICTOGRAPHIC.test(String(text ?? ''));
}

/**
 * What to store as a category icon: one emoji. Returns `{ ok, icon }`;
 * `ok` is false when nothing emoji-like was entered.
 */
export function normalizeIcon(raw) {
  const text = String(raw ?? '').trim();
  if (!hasEmoji(text)) return { ok: false, icon: '' };
  // keep the first emoji cluster (works for 👨‍🍳, 🛍️, flags …)
  const match = text.match(/(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*️?/u);
  return match ? { ok: true, icon: match[0] } : { ok: false, icon: '' };
}
