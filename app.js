'use strict';

/* ==========================================================
   Pixie Travels – app logic
   All conditional logic lives here. Styling lives in styles.css.
   NOTE: The login is a front-end gate only. Anyone can read these
   credentials in the page source, so don't reuse a real password.
   ========================================================== */

const CREDENTIALS = { username: 'pravalika', password: 'proversion@45' };
const STORAGE_KEY = 'pixie-world-v1';
const SESSION_KEY = 'pixie-session-v1';
const TAB_KEY = 'pixie-tab-v1';
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;
const MAX_STOPS = 40;
const THUMB_MAX_SIZE = 480;

const OPTIONS = {
  closet: ['Dresses', 'Tops', 'Bottoms', 'Shoes', 'Accessories', 'Outerwear'],
  shops: ['Fashion', 'Beauty', 'Home', 'Travel gear', 'Other'],
  priority: ['Dream', 'Soon', 'Someday']
};

const SECTIONS = {
  travels: {
    emoji: '🗺️',
    emptyTitle: 'No trips yet',
    emptyText: 'Choose “New itinerary” to plan your first adventure.'
  },
  closet: {
    emoji: '👗',
    emptyTitle: 'Nothing here yet',
    emptyText: 'Choose “Add to closet” to upload your first piece.'
  },
  shops: {
    emoji: '🛍️',
    emptyTitle: 'No shops saved',
    emptyText: 'Choose “Add a shop” to start your list.'
  },
  wishlist: {
    emoji: '💖',
    emptyTitle: 'Your wishlist is empty',
    emptyText: 'Choose “Make a wish”, or save a find from Pixie Shops.'
  }
};

const TAB_ORDER = ['travels', 'closet', 'shops', 'wishlist'];

/* Sample data. To show your own photos to every visitor, put images in the
   /images folder and set image: 'images/your-photo.jpg' on an item below. */
function seedData() {
  const now = Date.now();
  return {
    travels: [
      {
        id: uid(), title: 'Cherry blossoms in Kyoto', destination: 'Kyoto, Japan', dates: 'Mar 28 to Apr 4',
        notes: 'Pack the pink trench and comfy walking shoes.', image: '', created: now,
        stops: [
          { id: uid(), text: 'Fushimi Inari at sunrise', done: true },
          { id: uid(), text: 'Philosopher’s Path walk', done: false },
          { id: uid(), text: 'Tea ceremony in Gion', done: false }
        ]
      },
      {
        id: uid(), title: 'Lavender weekend', destination: 'Provence, France', dates: 'Jun 20 to Jun 22',
        notes: 'Golden hour photos in the fields.', image: '', created: now - 1,
        stops: [
          { id: uid(), text: 'Sénanque Abbey', done: false },
          { id: uid(), text: 'Valensole lavender fields', done: false }
        ]
      }
    ],
    closet: [
      { id: uid(), title: 'Lilac pleated midi', category: 'Dresses', color: 'Lilac', notes: 'Twirls beautifully.', image: '', fav: true, created: now },
      { id: uid(), title: 'Mint linen shirt', category: 'Tops', color: 'Mint', notes: 'Great for warm trips.', image: '', fav: false, created: now - 1 },
      { id: uid(), title: 'Silver ballet flats', category: 'Shoes', color: 'Silver', notes: '', image: '', fav: false, created: now - 2 },
      { id: uid(), title: 'Star charm necklace', category: 'Accessories', color: 'Gold', notes: 'Goes with everything.', image: '', fav: true, created: now - 3 }
    ],
    shops: [
      { id: uid(), title: 'Petal and Thread', category: 'Fashion', link: '', notes: 'Soft dresses and linen sets.', image: '', created: now },
      { id: uid(), title: 'Moonbeam Beauty', category: 'Beauty', link: '', notes: 'Shimmer highlighters.', image: '', created: now - 1 },
      { id: uid(), title: 'Wanderpack Co.', category: 'Travel gear', link: '', notes: 'Pastel luggage and packing cubes.', image: '', created: now - 2 }
    ],
    wishlist: [
      { id: uid(), title: 'Pearl hair clips', price: '$18', priority: 'Soon', link: '', notes: 'Set of six.', image: '', bought: false, created: now },
      { id: uid(), title: 'Pastel carry-on', price: '$140', priority: 'Dream', link: '', notes: 'Mint or lilac.', image: '', bought: false, created: now - 1 },
      { id: uid(), title: 'Film camera', price: '$95', priority: 'Someday', link: '', notes: 'For trip photos.', image: '', bought: false, created: now - 2 }
    ]
  };
}

/* ---------- Helpers ---------- */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function safeUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : 'https://' + value;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function safeImage(src) {
  if (typeof src !== 'string' || !src) return '';
  const isUpload = /^data:image\/(jpeg|png|webp|gif);base64,/.test(src);
  const isRepoImage = /^images\/[\w\-./ ]+$/.test(src) && !src.includes('..');
  return isUpload || isRepoImage ? src : '';
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* ---------- State ---------- */
const ui = {
  tab: 'travels',
  closetFilter: 'All',
  expanded: new Set(),
  pendingImages: { travels: '', closet: '', shops: '', wishlist: '' },
  imageTarget: null,
  attempts: 0,
  lockUntil: 0,
  lockTimer: 0,
  toastTimer: 0
};

let data = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData();
    const parsed = JSON.parse(raw);
    const valid = TAB_ORDER.every(key => Array.isArray(parsed[key]));
    return valid ? parsed : seedData();
  } catch {
    return seedData();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    toast('Your browser storage is full. Remove a few photos and try again.');
    return false;
  }
}

/* ==========================================================
   Pixie dust canvas
   ========================================================== */
const canvas = $('#dust');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DUST_COLORS = ['#7d4fe0', '#ff7db4', '#35c99b', '#ffb52e', '#a98bff'];
let particles = [];
let dustFrame = 0;
let lastDust = { x: -100, y: -100 };

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function spawnDust(x, y, count, speed) {
  if (reduceMotion) return;
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.9) * speed,
      life: 1,
      decay: 0.012 + Math.random() * 0.018,
      size: 3 + Math.random() * 6,
      color: DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)]
    });
  }
  if (!dustFrame) dustFrame = requestAnimationFrame(tickDust);
}

function drawSparkle(x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function tickDust() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life -= p.decay;
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    drawSparkle(p.x, p.y, p.size * Math.max(p.life, 0.2));
  });
  ctx.globalAlpha = 1;
  dustFrame = particles.length ? requestAnimationFrame(tickDust) : 0;
  if (!particles.length) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function bindDust() {
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const moved = Math.hypot(event.clientX - lastDust.x, event.clientY - lastDust.y);
    if (moved < 14) return;
    lastDust = { x: event.clientX, y: event.clientY };
    spawnDust(event.clientX, event.clientY, 1, 1.6);
  });
}

/* ==========================================================
   Toast
   ========================================================== */
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2800);
}

/* ==========================================================
   Login / logout
   ========================================================== */
const loginView = $('#loginView');
const appView = $('#appView');
const loginForm = $('#loginForm');
const loginError = $('#loginError');
const loginButton = $('#loginButton');

function showLoginError(message) {
  loginError.textContent = message;
}

function shakeLoginCard() {
  const card = $('#loginCard');
  card.classList.remove('is-shaking');
  void card.offsetWidth; // restart the animation
  card.classList.add('is-shaking');
}

function startLock() {
  ui.lockUntil = Date.now() + LOCK_SECONDS * 1000;
  loginButton.disabled = true;

  const update = () => {
    const remaining = Math.ceil((ui.lockUntil - Date.now()) / 1000);
    if (remaining <= 0) {
      clearInterval(ui.lockTimer);
      ui.attempts = 0;
      loginButton.disabled = false;
      showLoginError('');
      return;
    }
    showLoginError(`Too many tries. Please wait ${remaining}s and try again.`);
  };

  clearInterval(ui.lockTimer);
  update();
  ui.lockTimer = setInterval(update, 1000);
}

function handleLogin() {
  if (Date.now() < ui.lockUntil) return;

  const username = $('#username').value.trim().toLowerCase();
  const password = $('#password').value;

  if (!username || !password) {
    showLoginError('Enter both your username and password.');
    shakeLoginCard();
    return;
  }

  if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
    ui.attempts = 0;
    showLoginError('');
    sessionStorage.setItem(SESSION_KEY, '1');
    const rect = $('#loginCard').getBoundingClientRect();
    spawnDust(rect.left + rect.width / 2, rect.top + 60, 45, 9);
    setTimeout(() => enterApp(), reduceMotion ? 0 : 450);
    return;
  }

  ui.attempts += 1;
  shakeLoginCard();
  $('#password').value = '';

  if (ui.attempts >= MAX_ATTEMPTS) {
    startLock();
  } else {
    const left = MAX_ATTEMPTS - ui.attempts;
    showLoginError(`That username or password doesn’t match. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
  }
}

function greetingText() {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${capitalise(CREDENTIALS.username)} ✨`;
}

function enterApp() {
  loginView.hidden = true;
  appView.hidden = false;
  $('#greeting').textContent = greetingText();
  const savedTab = sessionStorage.getItem(TAB_KEY);
  setTab(TAB_ORDER.includes(savedTab) ? savedTab : 'travels');
  renderAll();
  window.scrollTo(0, 0);
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  appView.hidden = true;
  loginView.hidden = false;
  $('#username').value = '';
  $('#password').value = '';
  $('#password').type = 'password';
  $('#togglePassword').textContent = 'Show';
  $('#togglePassword').setAttribute('aria-pressed', 'false');
  showLoginError('');
  $('#username').focus();
}

function togglePassword() {
  const input = $('#password');
  const button = $('#togglePassword');
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.textContent = reveal ? 'Hide' : 'Show';
  button.setAttribute('aria-pressed', String(reveal));
}

/* ==========================================================
   Tabs
   ========================================================== */
function setTab(name, moveFocus = false) {
  if (!TAB_ORDER.includes(name)) name = 'travels';
  ui.tab = name;
  document.body.dataset.tab = name;
  sessionStorage.setItem(TAB_KEY, name);

  $$('.tab').forEach(tab => {
    const active = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && moveFocus) tab.focus();
  });

  $$('.panel').forEach(panel => {
    panel.hidden = panel.dataset.panel !== name;
  });
}

function handleTabKeys(event) {
  const index = TAB_ORDER.indexOf(ui.tab);
  let next = -1;
  if (event.key === 'ArrowRight') next = (index + 1) % TAB_ORDER.length;
  if (event.key === 'ArrowLeft') next = (index - 1 + TAB_ORDER.length) % TAB_ORDER.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = TAB_ORDER.length - 1;
  if (next === -1) return;
  event.preventDefault();
  setTab(TAB_ORDER[next], true);
}

/* ==========================================================
   Image handling
   ========================================================== */
function fileToThumbnail(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be opened.'));
      img.onload = () => {
        const scale = Math.min(1, THUMB_MAX_SIZE / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const work = document.createElement('canvas');
        work.width = width;
        work.height = height;
        work.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(work.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setDropzonePreview(zone, src) {
  const existing = $('.dropzone-preview-img', zone);
  if (existing) existing.remove();
  zone.classList.toggle('has-image', Boolean(src));
  if (!src) return;
  const img = document.createElement('img');
  img.className = 'dropzone-preview-img';
  img.alt = 'Selected thumbnail preview';
  img.src = src;
  zone.appendChild(img);
}

async function handleFormImage(zone, file) {
  const form = zone.closest('.add-form');
  const collection = form.dataset.collection;
  try {
    const src = await fileToThumbnail(file);
    ui.pendingImages[collection] = src;
    setDropzonePreview(zone, src);
  } catch (error) {
    toast(error.message);
  }
}

async function handleCardImage(file) {
  const target = ui.imageTarget;
  ui.imageTarget = null;
  if (!target) return;
  const item = data[target.collection].find(entry => entry.id === target.id);
  if (!item) return;

  try {
    const src = await fileToThumbnail(file);
    const previous = item.image;
    item.image = src;
    if (!save()) {
      item.image = previous;
      return;
    }
    renderAll();
    toast('Thumbnail updated.');
  } catch (error) {
    toast(error.message);
  }
}

/* ==========================================================
   Rendering
   ========================================================== */
function thumbHTML(item, collection) {
  const src = safeImage(item.image);
  const inner = src
    ? `<img src="${esc(src)}" alt="${esc(item.title)}">`
    : `<span class="thumb-empty"><span aria-hidden="true">${SECTIONS[collection].emoji}</span><small>Add a photo</small></span>`;
  return `<button class="thumb" type="button" data-action="change-image" aria-label="Change thumbnail for ${esc(item.title)}">${inner}<span class="thumb-edit">Change photo</span></button>`;
}

function chip(text, tone = '') {
  return text ? `<span class="chip ${tone}">${esc(text)}</span>` : '';
}

function linkHTML(url, label) {
  const href = safeUrl(url);
  return href ? `<a class="card-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : '';
}

function emptyHTML(collection, filtered) {
  const section = SECTIONS[collection];
  const title = filtered ? 'Nothing matches this filter' : section.emptyTitle;
  const text = filtered ? 'Try another filter or add a new piece.' : section.emptyText;
  return `<div class="empty"><span class="empty-icon" aria-hidden="true">${section.emoji}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
}

function mountGrid(collection, items, cardFn, filtered = false) {
  const grid = $(`#${collection}Grid`);
  grid.innerHTML = items.length ? items.map(cardFn).join('') : emptyHTML(collection, filtered);
}

/* Travels */
function stopsHTML(trip) {
  const list = trip.stops.map(stop => `
    <li>
      <label class="check">
        <input type="checkbox" data-action="toggle-stop" data-stop="${esc(stop.id)}" ${stop.done ? 'checked' : ''}>
        <span>${esc(stop.text)}</span>
      </label>
      <button class="icon-btn" type="button" data-action="remove-stop" data-stop="${esc(stop.id)}" aria-label="Remove stop ${esc(stop.text)}">×</button>
    </li>`).join('');

  return `
    <ul class="stops">${list}</ul>
    <form class="stop-form" novalidate>
      <input name="stop" maxlength="80" placeholder="Add a stop" aria-label="New stop for ${esc(trip.title)}">
      <button class="btn btn-small btn-primary" type="submit">Add</button>
    </form>`;
}

function travelCard(trip) {
  const total = trip.stops.length;
  const done = trip.stops.filter(stop => stop.done).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const open = ui.expanded.has(trip.id);
  const label = total ? `${done} of ${total} stops ticked off` : 'No stops yet';

  return `
    <article class="card" data-collection="travels" data-id="${esc(trip.id)}">
      ${thumbHTML(trip, 'travels')}
      <div class="card-body">
        <h3>${esc(trip.title)}</h3>
        <div class="chips">${chip(trip.destination, 'chip-lilac')}${chip(trip.dates, 'chip-peach')}</div>
        ${trip.notes ? `<p class="notes">${esc(trip.notes)}</p>` : ''}
        <div class="progress" role="progressbar" aria-label="Trip progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" style="--pct:${percent}%"><span></span></div>
        <p class="progress-label">${label}</p>
        <div><button class="link-btn" type="button" data-action="toggle-stops" aria-expanded="${open}">${open ? 'Hide stops' : 'Show stops'}</button></div>
        ${open ? stopsHTML(trip) : ''}
      </div>
      <div class="card-actions"><button class="link-btn" type="button" data-action="remove">Remove</button></div>
    </article>`;
}

/* Closet */
function closetCard(item) {
  return `
    <article class="card" data-collection="closet" data-id="${esc(item.id)}">
      ${thumbHTML(item, 'closet')}
      <button class="fav" type="button" data-action="fav" aria-pressed="${Boolean(item.fav)}" aria-label="Favourite ${esc(item.title)}">${item.fav ? '💖' : '🤍'}</button>
      <div class="card-body">
        <h3>${esc(item.title)}</h3>
        <div class="chips">${chip(item.category, 'chip-rose')}${chip(item.color, 'chip-lilac')}</div>
        ${item.notes ? `<p class="notes">${esc(item.notes)}</p>` : ''}
      </div>
      <div class="card-actions"><button class="link-btn" type="button" data-action="remove">Remove</button></div>
    </article>`;
}

function renderClosetFilters() {
  const filters = ['All', 'Favorites', ...OPTIONS.closet];
  $('#closetFilters').innerHTML = filters.map(name =>
    `<button class="chip-btn" type="button" data-action="filter" data-value="${esc(name)}" aria-pressed="${name === ui.closetFilter}">${name === 'Favorites' ? '💖 Favourites' : esc(name)}</button>`
  ).join('');
}

function renderCloset() {
  const filter = ui.closetFilter;
  const items = data.closet.filter(item => {
    if (filter === 'All') return true;
    if (filter === 'Favorites') return item.fav;
    return item.category === filter;
  });
  renderClosetFilters();
  mountGrid('closet', items, closetCard, filter !== 'All' && data.closet.length > 0);
}

/* Shops */
function shopCard(shop) {
  return `
    <article class="card" data-collection="shops" data-id="${esc(shop.id)}">
      ${thumbHTML(shop, 'shops')}
      <div class="card-body">
        <h3>${esc(shop.title)}</h3>
        <div class="chips">${chip(shop.category, 'chip-mint')}</div>
        ${shop.notes ? `<p class="notes">${esc(shop.notes)}</p>` : ''}
        ${linkHTML(shop.link, 'Visit shop')}
      </div>
      <div class="card-actions">
        <button class="btn btn-small btn-ghost" type="button" data-action="to-wishlist">Save to wishlist</button>
        <button class="link-btn" type="button" data-action="remove">Remove</button>
      </div>
    </article>`;
}

/* Wishlist */
function wishCard(wish) {
  const tone = wish.priority === 'Dream' ? 'chip-rose' : wish.priority === 'Soon' ? 'chip-mint' : 'chip-lilac';
  return `
    <article class="card ${wish.bought ? 'is-done' : ''}" data-collection="wishlist" data-id="${esc(wish.id)}">
      ${thumbHTML(wish, 'wishlist')}
      <div class="card-body">
        <h3>${esc(wish.title)}</h3>
        <div class="chips">${chip(wish.price, 'chip-peach')}${chip(wish.priority, tone)}${wish.bought ? chip('Got it', 'chip-mint') : ''}</div>
        ${wish.notes ? `<p class="notes">${esc(wish.notes)}</p>` : ''}
        ${linkHTML(wish.link, 'View item')}
      </div>
      <div class="card-actions">
        <button class="btn btn-small btn-ghost" type="button" data-action="got-it" aria-pressed="${Boolean(wish.bought)}">${wish.bought ? 'Put back' : 'Mark as got it'}</button>
        <button class="link-btn" type="button" data-action="remove">Remove</button>
      </div>
    </article>`;
}

function updateWishlistMeta() {
  const open = data.wishlist.filter(wish => !wish.bought).length;
  const got = data.wishlist.length - open;
  const badge = $('#wishlistBadge');
  badge.textContent = open;
  badge.hidden = open === 0;

  const summary = $('#wishlistSummary');
  if (!data.wishlist.length) {
    summary.textContent = 'Everything you’re hoping to get.';
  } else {
    summary.textContent = `${open} still to get, ${got} already yours.`;
  }
}

function renderAll() {
  mountGrid('travels', data.travels, travelCard);
  renderCloset();
  mountGrid('shops', data.shops, shopCard);
  mountGrid('wishlist', data.wishlist, wishCard);
  updateWishlistMeta();
}

/* ==========================================================
   Add forms
   ========================================================== */
function populateSelects() {
  $$('select[data-options]').forEach(select => {
    const list = OPTIONS[select.dataset.options] || [];
    select.innerHTML = list.map(option => `<option value="${esc(option)}">${esc(option)}</option>`).join('');
  });
}

function toggleForm(name) {
  const wrap = $(`#${name}FormWrap`);
  const button = $(`[data-toggle-form="${name}"]`);
  const open = !wrap.classList.contains('is-open');
  wrap.classList.toggle('is-open', open);
  button.setAttribute('aria-expanded', String(open));
  if (open) {
    const first = $('input[name="title"]', wrap);
    setTimeout(() => first && first.focus(), 380);
  }
}

function resetFormState(form) {
  const collection = form.dataset.collection;
  ui.pendingImages[collection] = '';
  setDropzonePreview($('.dropzone', form), '');
  $('.form-error', form).textContent = '';
}

function buildItem(collection, formData) {
  const text = key => String(formData.get(key) || '').trim();
  const base = {
    id: uid(),
    title: text('title'),
    notes: text('notes'),
    image: ui.pendingImages[collection] || '',
    created: Date.now()
  };

  switch (collection) {
    case 'travels':
      return { ...base, destination: text('destination'), dates: text('dates'), stops: [] };
    case 'closet':
      return { ...base, category: text('category'), color: text('color'), fav: false };
    case 'shops':
      return { ...base, category: text('category'), link: safeUrl(text('link')) };
    case 'wishlist':
      return { ...base, price: text('price'), priority: text('priority'), link: safeUrl(text('link')), bought: false };
    default:
      return base;
  }
}

function validateItem(collection, item, formData) {
  if (!item.title) return 'Give it a name first.';
  if (collection === 'travels' && !item.destination) return 'Add a destination for this trip.';
  if ((collection === 'shops' || collection === 'wishlist') && String(formData.get('link') || '').trim() && !item.link) {
    return 'That link doesn’t look right. Try something like example.com.';
  }
  return '';
}

function handleAddForm(form) {
  const collection = form.dataset.collection;
  const formData = new FormData(form);
  const item = buildItem(collection, formData);
  const problem = validateItem(collection, item, formData);
  const errorEl = $('.form-error', form);

  if (problem) {
    errorEl.textContent = problem;
    return;
  }

  data[collection].unshift(item);
  if (!save()) {
    data[collection].shift();
    return;
  }

  form.reset();
  resetFormState(form);
  if (collection === 'closet') ui.closetFilter = 'All';
  renderAll();
  toast('Saved. Sparkle on ✨');

  const button = $(`[data-toggle-form="${collection}"]`);
  const rect = button.getBoundingClientRect();
  spawnDust(rect.left + rect.width / 2, rect.top + rect.height / 2, 24, 7);
}

function handleStopForm(form) {
  const card = form.closest('.card');
  const trip = data.travels.find(entry => entry.id === card.dataset.id);
  const input = $('input[name="stop"]', form);
  const text = input.value.trim();
  if (!trip || !text) {
    input.focus();
    return;
  }
  if (trip.stops.length >= MAX_STOPS) {
    toast(`A trip can have up to ${MAX_STOPS} stops.`);
    return;
  }
  trip.stops.push({ id: uid(), text, done: false });
  if (!save()) {
    trip.stops.pop();
    return;
  }
  renderAll();
  const nextInput = $(`.card[data-id="${trip.id}"] .stop-form input`);
  if (nextInput) nextInput.focus();
}

/* ==========================================================
   Card actions (event delegation)
   ========================================================== */
function handleAction(el) {
  const action = el.dataset.action;
  const card = el.closest('.card');
  const collection = card ? card.dataset.collection : '';
  const item = card ? data[collection].find(entry => entry.id === card.dataset.id) : null;

  switch (action) {
    case 'filter':
      ui.closetFilter = el.dataset.value;
      renderCloset();
      break;

    case 'change-image':
      if (!item) return;
      ui.imageTarget = { collection, id: item.id };
      $('#cardImageInput').click();
      break;

    case 'remove': {
      if (!item) return;
      if (!window.confirm(`Remove “${item.title}”?`)) return;
      data[collection] = data[collection].filter(entry => entry.id !== item.id);
      ui.expanded.delete(item.id);
      if (save()) {
        renderAll();
        toast('Removed.');
      }
      break;
    }

    case 'toggle-stops':
      if (!item) return;
      if (ui.expanded.has(item.id)) ui.expanded.delete(item.id);
      else ui.expanded.add(item.id);
      renderAll();
      break;

    case 'toggle-stop': {
      const stop = item && item.stops.find(entry => entry.id === el.dataset.stop);
      if (!stop) return;
      stop.done = el.checked;
      save();
      renderAll();
      if (stop.done && item.stops.every(entry => entry.done)) {
        const rect = card.getBoundingClientRect();
        spawnDust(rect.left + rect.width / 2, rect.top + 80, 40, 9);
        toast('Every stop ticked off. What a trip!');
      }
      break;
    }

    case 'remove-stop':
      if (!item) return;
      item.stops = item.stops.filter(entry => entry.id !== el.dataset.stop);
      save();
      renderAll();
      break;

    case 'fav':
      if (!item) return;
      item.fav = !item.fav;
      save();
      renderAll();
      break;

    case 'to-wishlist': {
      if (!item) return;
      if (data.wishlist.some(wish => wish.sourceId === item.id)) {
        toast('Already on your wishlist.');
        return;
      }
      data.wishlist.unshift({
        id: uid(), title: item.title, price: '', priority: 'Soon', link: item.link || '',
        notes: item.notes || '', image: item.image || '', bought: false, sourceId: item.id, created: Date.now()
      });
      if (!save()) {
        data.wishlist.shift();
        return;
      }
      renderAll();
      toast(`${item.title} is on your wishlist.`);
      break;
    }

    case 'got-it': {
      if (!item) return;
      item.bought = !item.bought;
      save();
      const rect = el.getBoundingClientRect();
      renderAll();
      if (item.bought) spawnDust(rect.left + rect.width / 2, rect.top, 36, 9);
      break;
    }

    default:
      break;
  }
}

/* ==========================================================
   Events
   ========================================================== */
function bindEvents() {
  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    handleLogin();
  });
  $('#togglePassword').addEventListener('click', togglePassword);
  $('#logoutButton').addEventListener('click', logout);

  $$('.tab').forEach(tab => tab.addEventListener('click', () => setTab(tab.dataset.tab)));
  $('.tabs').addEventListener('keydown', handleTabKeys);

  $$('[data-toggle-form]').forEach(button => {
    button.addEventListener('click', () => toggleForm(button.dataset.toggleForm));
  });

  $$('.add-form').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      handleAddForm(form);
    });
    form.addEventListener('reset', () => resetFormState(form));

    const zone = $('.dropzone', form);
    $('.dropzone-input', zone).addEventListener('change', event => {
      const file = event.target.files[0];
      if (file) handleFormImage(zone, file);
      event.target.value = '';
    });

    ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.add('is-drag');
    }));
    ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.remove('is-drag');
    }));
    zone.addEventListener('drop', event => {
      const file = event.dataTransfer && event.dataTransfer.files[0];
      if (file) handleFormImage(zone, file);
    });
  });

  $('#cardImageInput').addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) handleCardImage(file);
    else ui.imageTarget = null;
    event.target.value = '';
  });

  document.addEventListener('click', event => {
    const el = event.target.closest('[data-action]');
    if (el) handleAction(el);

    const button = event.target.closest('.btn');
    if (button && !event.target.closest('#loginForm')) {
      spawnDust(event.clientX, event.clientY, 8, 5);
    }
  });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.matches('.stop-form')) {
      event.preventDefault();
      handleStopForm(form);
    }
  });

  $('#resetData').addEventListener('click', () => {
    if (!window.confirm('Replace everything with the sample data? Your own entries will be removed.')) return;
    data = seedData();
    ui.expanded.clear();
    ui.closetFilter = 'All';
    if (save()) {
      renderAll();
      toast('Sample data restored.');
    }
  });
}

/* ==========================================================
   Start
   ========================================================== */
function init() {
  populateSelects();
  bindDust();
  bindEvents();

  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    enterApp();
  } else {
    $('#username').focus();
  }
}

init();
