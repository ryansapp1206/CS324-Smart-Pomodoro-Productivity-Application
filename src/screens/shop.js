/* =====================================================================
   SCREEN: SHOP
   Spend the shared currency on themes, sound packs and profile pictures.
   Items and the currency's name come from the active ecosystem
   (src/content/professional/ or src/content/brainrot/), so this screen
   never needs editing to add content.
   ===================================================================== */

import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { t, applyTheme } from '../core/theme-engine.js';
import * as data from '../data/index.js';
import { SETTING_FOR_KIND, equippedId, findShopItem, itemKey, ownsItem, shopItems } from '../shop/catalog.js';
import { playSoundPack } from '../audio/player.js';
import { saveChange } from '../app/saving.js';
import { shareSettings } from '../app/account.js';
import { createSettingsDraft } from '../app/settings-draft.js';
import { actionButton, avatarHtml, disabledButton, segmentButton, swatchHtml } from '../ui/components.js';

/** The Shop's tabs. Items come from the active ecosystem (src/shop/catalog.js). */
const SHOP_CATEGORIES = [
  { id: 'theme', labelKey: 'shop.themes', descriptionKey: 'shop.themesSub' },
  { id: 'sound', labelKey: 'shop.sounds', descriptionKey: 'shop.soundsSub' },
  { id: 'avatar', labelKey: 'shop.avatars', descriptionKey: 'shop.avatarsSub' },
];

const categoryFor = (kind) => SHOP_CATEGORIES.find((category) => category.id === kind) || SHOP_CATEGORIES[0];

export function shopScreen(app) {
  const category = categoryFor(app.ui.shopCategory);
  const balance = app.balance();
  const equipped = equippedId(app.settings(), category.id);

  const tabs = SHOP_CATEGORIES.map((c) => segmentButton('setShopCategory', c.id, t(c.labelKey), c.id === category.id)).join('');
  const items = shopItems(category.id)
    .map((item) => shopItemRow(app, item, balance, equipped))
    .join('');

  return `
    <div class="shop-bal" data-shop>
      <span class="shop-bal-icon" aria-hidden="true">${icon('coins')}</span>
      <span><b>${balance.toLocaleString()}</b> ${t('currency.unit')}</span>
      <span class="small muted" style="margin-left:auto">${t('shop.title')}</span>
    </div>
    <div class="seg" role="group" aria-label="${t('shop.cats')}" style="margin-bottom:10px">${tabs}</div>
    <p class="small muted" style="margin:0 2px 10px">${t(category.descriptionKey)}</p>
    <ul class="shop-list">${items}</ul>`;
}

function shopItemThumbnail(app, item) {
  if (item.kind === 'theme') return swatchHtml(item.swatch, 'swatch sw-mini');
  if (item.kind === 'sound') return `<span class="shop-thumb" aria-hidden="true">${icon(item.icon)}</span>`;
  if (item.id === 'initials') return avatarHtml(app.user, 'initials', 'shop-thumb av-ini');
  return avatarHtml(app.user, item.id, 'shop-thumb round');
}

/** The button on a shop row: Equipped / Equip / Buy / Need more / Owned · coming soon. */
function shopItemButton(app, item, balance, equipped) {
  const key = itemKey(item.kind, item.id);
  const owned = ownsItem(app.data.purchases, item.kind, item.id);

  if (owned && item.comingSoon) return `<span class="tag">${t('currency.soon')}</span>`;
  if (owned && equipped === item.id) return disabledButton(t('currency.equipped'), 'check');
  if (owned) return actionButton('equipItem', t('currency.equip'), { arg: key, className: 'btn btn-sm' });
  if (balance >= item.price) return actionButton('buyItem', t('currency.buy', { n: item.price }), { arg: key, className: 'btn btn-primary btn-sm' });
  return disabledButton(t('currency.need', { n: item.price - balance }));
}

function shopItemRow(app, item, balance, equipped) {
  const previewButton =
    item.kind === 'sound'
      ? actionButton('previewSound', '', { arg: item.id, className: 'icon-btn', icon: 'volume', ariaLabel: t('shop.previewLabel', { name: item.name }) })
      : '';
  const comingSoonTag = item.comingSoon ? ` <span class="tag">${t('currency.soonTag')}</span>` : '';
  const price = item.price ? t('currency.priceTag', { n: item.price }) : t('currency.free');

  return `
    <li class="shop-item">
      ${shopItemThumbnail(app, item)}
      <div class="grow" style="min-width:0">
        <div class="tc-name">${escapeHtml(item.name)}${comingSoonTag}</div>
        <div class="tc-desc">${escapeHtml(item.description)}</div>
        <div class="small muted">${price}</div>
      </div>
      <div class="shop-acts">${previewButton}${shopItemButton(app, item, balance, equipped)}</div>
    </li>`;
}

export const actions = {
  openShop(app, category) {
    if (SHOP_CATEGORIES.some((c) => c.id === category)) app.ui.shopCategory = category;
    app.navigate('shop');
  },
  setShopCategory(app, category) {
    app.ui.shopCategory = category;
    app.ui.focusAfterRender = 'setShopCategory:' + category;
    app.render();
  },
  previewSound(app, packId) {
    playSoundPack(packId, 'sessionEnd');
  },

  /** arg = '<kind>:<id>', e.g. 'sound:tung-tung-drums'. */
  buyItem(app, arg) {
    const [kind, id] = arg.split(':');
    const item = findShopItem(kind, id);
    const balance = app.balance();
    if (!item || balance < item.price || ownsItem(app.data.purchases, kind, id)) return;

    app.askConfirm({
      title: t('currency.buy.title', { name: item.name }),
      body: t('currency.buy.body', { price: item.price, left: balance - item.price }),
      confirmLabel: t('currency.buy.yes'),
      onConfirm: async () => {
        app.ui.focusAfterRender = item.comingSoon ? 'setShopCategory:' + kind : 'equipItem:' + arg;
        const result = await saveChange(app, {
          remote: async () => app.data.purchases.push(await data.purchase(arg, item.price)),
        });
        if (!result.ok) return;
        const message = item.comingSoon ? t('currency.boughtSoon', { name: item.name }) : t('currency.bought', { name: item.name });
        app.toast(message, 'success', 'coins');
        app.render();
      },
    });
  },

  /** arg = '<kind>:<id>'. Saved in settings so it follows the account. */
  async equipItem(app, arg) {
    const [kind, id] = arg.split(':');
    const item = findShopItem(kind, id);
    if (!item || item.comingSoon || !ownsItem(app.data.purchases, kind, id)) return;

    const settingKey = SETTING_FOR_KIND[kind];
    const previous = app.settings();
    const settings = { ...previous, [settingKey]: id };
    app.ui.focusAfterRender = 'setShopCategory:' + kind;

    const result = await saveChange(app, {
      apply: () => {
        app.data.settings = settings;
        if (kind === 'theme') applyTheme(id);
      },
      revert: () => {
        app.data.settings = previous;
        if (kind === 'theme') applyTheme(previous.theme);
      },
      remote: async () => {
        app.data.settings = await data.saveSettings(settings);
        await shareSettings(app.data.settings);
      },
    });
    if (!result.ok) return;
    if (app.ui.settingsDraft) app.ui.settingsDraft = createSettingsDraft(app.settings());
    if (kind === 'sound') playSoundPack(id, 'sessionEnd');
    app.toast(t('currency.equippedToast', { name: item.name }), 'success');
    app.render();
  },
};
