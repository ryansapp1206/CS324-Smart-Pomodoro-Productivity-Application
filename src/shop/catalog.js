/* =====================================================================
   SHOP CATALOG
   Turns the ACTIVE ecosystem's content (src/content/<mode>/) into shop
   items, and answers "does this account own it?" and "what's equipped?".
   Purchases are saved as { itemId: '<kind>:<id>', price, purchasedAt }.
   Ids are unique across ecosystems, so one purchases list serves both.
   ===================================================================== */

import { activeEcosystem } from '../core/theme-engine.js';

export const SHOP_KINDS = ['theme', 'sound', 'avatar'];
const THEME_SWATCH_TOKENS = ['bg', 'surface', 'mode-focus', 'mode-short', 'mode-long'];

/** Each kind of item and the setting that records which one is equipped. */
export const SETTING_FOR_KIND = { theme: 'theme', sound: 'soundPack', avatar: 'avatar' };

/** The built-in "no picture" option, offered in every ecosystem. */
export const INITIALS_AVATAR = {
  id: 'initials',
  name: 'Initials',
  description: 'Your initials.',
  price: 0,
  icon: '',
  color: '',
};

function themeSwatch(theme) {
  return theme.swatch || THEME_SWATCH_TOKENS.map((token) => theme.tokens[token]);
}

/** All items of one kind in the active ecosystem, in one shape for the Shop screen. */
export function shopItems(kind) {
  const ecosystem = activeEcosystem();
  if (kind === 'sound') return ecosystem.sounds.map((pack) => ({ ...pack, kind }));
  if (kind === 'avatar') return [INITIALS_AVATAR, ...ecosystem.avatars].map((avatar) => ({ ...avatar, kind }));
  return ecosystem.themes.map((theme) => ({
    kind: 'theme',
    id: theme.id,
    name: theme.name,
    description: theme.description,
    price: theme.price || 0,
    swatch: themeSwatch(theme),
    comingSoon: Boolean(theme.comingSoon),
  }));
}

export function findShopItem(kind, id) {
  return shopItems(kind).find((item) => item.id === id);
}

export function itemKey(kind, id) {
  return `${kind}:${id}`;
}

/** True when the item is free, is the ecosystem's default, or is in the purchases list. */
export function ownsItem(purchases, kind, id) {
  const item = findShopItem(kind, id);
  if (!item) return false;
  if (!item.price || activeEcosystem().defaults[SETTING_FOR_KIND[kind]] === id) return true;
  return (purchases || []).some((purchase) => purchase.itemId === itemKey(kind, id));
}

/**
 * The equipped item's id for this ecosystem. Settings may hold an id from
 * the other ecosystem (after switching mode); then its default is used.
 */
export function equippedId(settings, kind) {
  const id = settings[SETTING_FOR_KIND[kind]];
  const item = findShopItem(kind, id);
  return item && !item.comingSoon ? id : activeEcosystem().defaults[SETTING_FOR_KIND[kind]];
}
