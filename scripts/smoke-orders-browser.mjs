#!/usr/bin/env node

import fs from 'node:fs';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const cdpUrl = process.env.SMOKE_CDP_URL || 'http://127.0.0.1:9222';
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || 'smoke-admin@jadhome.local';
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || 'SmokePassword!42';
const screenshotPath = process.env.SMOKE_SCREENSHOT_PATH;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const target = await fetch(`${cdpUrl}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let commandId = 0;
const pending = new Map();
const consoleErrors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(message.params?.exceptionDetails?.text || 'Runtime exception');
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') {
    consoleErrors.push(message.params.args?.map((item) => item.value || item.description).join(' ') || 'Console error');
  }
});

function send(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Évaluation navigateur impossible');
  return response.result?.value;
}

async function waitFor(expression, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(expression)) return;
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  throw new Error(`${label} introuvable${lastError ? `: ${lastError.message}` : ''}`);
}

async function navigate(pathname) {
  await send('Page.navigate', { url: `${baseUrl}${pathname}` });
  await waitFor('document.readyState === "complete"', `Navigation ${pathname}`);
}

async function clickText(text, selector = 'button,a') {
  const clicked = await evaluate(`(() => {
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((item) => item.textContent?.trim().includes(${JSON.stringify(text)}));
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Élément « ${text} » introuvable`);
}

async function setField(name, value) {
  const changed = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(`[name="${name}"]`)});
    if (!element) return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!changed) throw new Error(`Champ ${name} introuvable`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1920,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `localStorage.setItem('jad_home_language', 'fr');
  Object.defineProperty(window, 'open', {
    configurable: true,
    value: (initialUrl = '') => {
      window.__lastOpenedUrl = String(initialUrl);
      const location = {};
      Object.defineProperty(location, 'href', {
        get: () => window.__lastOpenedUrl || '',
        set: (value) => { window.__lastOpenedUrl = String(value); },
      });
      return { opener: null, location, close() {} };
    },
  });`,
});

await navigate('/catalogue');
await waitFor('[...document.querySelectorAll("button")].some((item) => item.textContent?.includes("Ajouter au panier"))', 'Produits du catalogue');
await clickText('Ajouter au panier', 'button');
await navigate('/commande');
await waitFor('Boolean(document.querySelector("[name=fullName]"))', 'Formulaire de commande');
await setField('fullName', 'Sara Smoke');
await setField('phone', '0612345678');
await setField('whatsapp', '0623456789');
await setField('email', 'sara.smoke@example.com');
await setField('city', 'Rabat');
await setField('address', '10 rue Smoke Test, Agdal');
await setField('additionalAddress', 'Appartement 3');
await setField('note', 'Test local isolé');
await evaluate('document.querySelector("[name=acceptTerms]").click()');
await evaluate('document.querySelector("main form").requestSubmit()');
try {
  await waitFor('document.body.innerText.includes("Votre commande a bien été enregistrée")', 'Confirmation de commande', 20_000);
} catch (error) {
  console.error(await evaluate('document.body.innerText.slice(0, 4000)'));
  if (consoleErrors.length) console.error(consoleErrors.join('\n'));
  throw error;
}
const whatsappBeforeClick = await evaluate('window.__lastOpenedUrl || ""');
if (whatsappBeforeClick) throw new Error('WhatsApp a été ouvert avant le clic explicite du client');
await clickText('Continuer sur WhatsApp', 'button');
await waitFor('(window.__lastOpenedUrl || "").startsWith("https://wa.me/212")', 'Ouverture WhatsApp après clic');
const customerWhatsAppUrl = await evaluate('window.__lastOpenedUrl || ""');
if (!customerWhatsAppUrl.startsWith('https://wa.me/212')) throw new Error('Lien WhatsApp client invalide');

await navigate('/admin/connexion');
await waitFor('Boolean(document.querySelector("[name=email]"))', 'Connexion administrateur');
await setField('email', adminEmail);
await setField('password', adminPassword);
await clickText('Se connecter', 'button');
await waitFor('location.pathname === "/admin"', 'Tableau de bord admin', 20_000);
await navigate('/admin/commandes');
await waitFor('document.body.innerText.toLowerCase().includes("sara smoke")', 'Commande dans le dashboard');
const orderNumber = await evaluate(`(() => {
  const container = [...document.querySelectorAll('tr, article')]
    .find((element) => element.innerText?.toLowerCase().includes('sara smoke'));
  return (container?.innerText.match(/JH-\\d{8}-[A-F0-9]{8}/) || [])[0] || '';
})()`);
if (!orderNumber) throw new Error('Numéro de commande absent du dashboard');
const opened = await evaluate(`(() => {
  const container = [...document.querySelectorAll('tr, article')]
    .find((element) => element.innerText?.toLowerCase().includes('sara smoke'));
  const button = [...(container?.querySelectorAll('button') || [])]
    .find((element) => element.textContent?.includes('Voir') || element.getAttribute('aria-label') === 'Voir');
  if (!button) return false;
  button.click();
  return true;
})()`);
if (!opened) throw new Error('Action Voir introuvable pour la commande de test');
try {
  await waitFor('document.body.innerText.toLowerCase().includes("informations commande")', 'Détail de commande');
} catch (error) {
  console.error(await evaluate('document.body.innerText.slice(0, 5000)'));
  if (consoleErrors.length) console.error(consoleErrors.join('\n'));
  throw error;
}
const completeDetail = await evaluate(`[
  "sara smoke", "0612345678", "rabat", "test local isolé", "sous-total",
  "livraison", "total général", "historique des statuts"
].every((text) => document.body.innerText.toLowerCase().includes(text))`);
if (!completeDetail) throw new Error('Détail de commande incomplet');
const modalLayout = await evaluate(`(() => {
  const overlay = document.querySelector('[role="dialog"]');
  const panel = overlay?.querySelector('.modal-panel');
  if (!overlay || !panel) return null;
  const overlayRect = overlay.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const leftTopElement = document.elementsFromPoint(24, 100)[0];
  const headerTopElement = document.elementsFromPoint(Math.floor(window.innerWidth / 2), 24)[0];
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    overlay: {
      left: overlayRect.left,
      top: overlayRect.top,
      right: overlayRect.right,
      bottom: overlayRect.bottom,
    },
    panel: {
      left: panelRect.left,
      top: panelRect.top,
      right: panelRect.right,
      bottom: panelRect.bottom,
    },
    coversSidebar: leftTopElement === overlay || overlay.contains(leftTopElement),
    coversHeader: headerTopElement === overlay || overlay.contains(headerTopElement),
  };
})()`);
const modalLayoutOk = modalLayout
  && Math.abs(modalLayout.overlay.left) <= 1
  && Math.abs(modalLayout.overlay.top) <= 1
  && Math.abs(modalLayout.overlay.right - modalLayout.viewportWidth) <= 1
  && Math.abs(modalLayout.overlay.bottom - modalLayout.viewportHeight) <= 1
  && modalLayout.panel.left >= 0
  && modalLayout.panel.top >= 0
  && modalLayout.panel.right <= modalLayout.viewportWidth + 1
  && modalLayout.panel.bottom <= modalLayout.viewportHeight + 1
  && modalLayout.documentWidth <= modalLayout.viewportWidth + 1
  && modalLayout.coversSidebar
  && modalLayout.coversHeader;
if (!modalLayoutOk) throw new Error(`La fenêtre de commande est mal positionnée: ${JSON.stringify(modalLayout)}`);
if (screenshotPath) {
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
}
const adminWhatsAppUrl = await evaluate('document.querySelector(\'[role="dialog"] a[href^="https://wa.me/"]\')?.href || ""');
if (!adminWhatsAppUrl.includes('212623456789')) throw new Error('Le bouton WhatsApp admin ne privilégie pas customerWhatsapp');

await evaluate(`(() => {
  const select = document.querySelector('[role="dialog"] select');
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(select, 'confirmed');
  select.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await waitFor('document.body.innerText.includes("Confirmée") && document.body.innerText.includes("Statut mis à jour")', 'Statut confirmé');
const textareas = await evaluate('document.querySelectorAll(\'[role="dialog"] textarea\').length');
if (!textareas) throw new Error('Note administrateur absente');
await evaluate(`(() => {
  const element = document.querySelector('[role="dialog"] textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, 'Commande vérifiée pendant le smoke test.');
  element.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await clickText('Enregistrer la note', '[role="dialog"] button');
await waitFor('document.body.innerText.includes("Note enregistrée")', 'Note administrateur enregistrée');
await evaluate('document.querySelector(\'[role="dialog"] button[aria-label="Fermer"]\').click()');

await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await navigate('/admin/commandes');
await waitFor(`document.body.innerText.includes(${JSON.stringify(orderNumber)})`, 'Commande en vue mobile');
const mobileLayoutOk = await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1 && getComputedStyle(document.querySelector("table")?.parentElement || document.body).display === "none"');
if (!mobileLayoutOk) throw new Error('La vue mobile déborde horizontalement ou affiche le tableau desktop');

await clickText('العربية', 'button');
await waitFor('document.documentElement.dir === "rtl" && document.body.innerText.includes("الطلبات")', 'Interface arabe RTL');
const rtlReadable = await evaluate('document.documentElement.dir === "rtl" && document.documentElement.scrollWidth <= window.innerWidth + 1');
if (!rtlReadable) throw new Error('La vue arabe RTL déborde horizontalement');

await send('Emulation.clearDeviceMetricsOverride');
await send('Page.close');
socket.close();

console.log(JSON.stringify({
  success: true,
  orderNumber,
  checks: {
    checkoutSavedBeforeWhatsApp: true,
    whatsappOnlyAfterExplicitClick: true,
    dashboardImmediate: true,
    completeDetail: true,
    modalCoversAdminChrome: true,
    modalFitsViewport: true,
    statusUpdate: true,
    adminNote: true,
    customerWhatsApp: true,
    adminWhatsAppPrefersCustomerWhatsapp: true,
    mobile: true,
    rtlArabic: true,
    consoleErrors: consoleErrors.length,
  },
}, null, 2));

if (consoleErrors.length) {
  console.error(consoleErrors.join('\n'));
  process.exitCode = 1;
}
