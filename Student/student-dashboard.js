/* ============ FIREBASE CONFIG (same project as index.html / canteen-dashboard.js) ============ */

const firebaseConfig = {
  apiKey: "AIzaSyDlSxTiDIfCogynjUAiRDjvTBvd_FJzKS8",
  authDomain: "campus-cart-6f932.firebaseapp.com",
  projectId: "campus-cart-6f932",
  storageBucket: "campus-cart-6f932.firebasestorage.app",
  messagingSenderId: "208400952258",
  appId: "1:208400952258:web:25dffbc5b596d37e59845b",
  measurementId: "G-5NMY4KEBL7"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/*
 * IMPORTANT:
 * student-dashboard.html is expected inside /Student/
 * while index.html is in the project root.
 * index.html    -> WRONG
 * ../index.html -> CORRECT
 */
const HOME_PATH = '../index.html';


/* ============ STATE ============ */

let currentUid = null;
let studentProfile = {};

let canteens = [];       // all canteens/{id}
let menuItems = [];      // menuItems where available == true
let cart = [];           // students/{uid}/cart/*
let favorites = [];      // students/{uid}/favorites/*
let orders = [];         // orders where studentId == uid
let notifications = [];  // students/{uid}/notifications/*
let mySuggestions = [];  // suggestions where studentId == uid

let searchQuery = '';
let activeCanteenFilter = null;
let activeCategory = 'all';
let unsubList = [];

let foodModalItem = null;
let foodModalQty = 1;
let orderModalId = null;

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];
const CANCELABLE_STATUSES = ['pending', 'confirmed', 'preparing'];
const ORDER_STEPS = ['Pending', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Completed'];
const ORDER_STEP_INDEX = { pending: 0, confirmed: 1, preparing: 2, ready: 3, completed: 4 };
const ORDERS_PER_PAGE = 4;
const SERVICE_FEE = 0;   // Delivery / Service fee shown in the cart summary

let orderTab = 'current';   // 'current' | 'history'
let ordersPage = 1;
let selectedOrderId = null;
let placingOrder = false;


/* ============ AUTH GUARD ============ */

auth.onAuthStateChanged(async (user) => {

  if (!user) {
    window.location.href = HOME_PATH;
    return;
  }

  currentUid = user.uid;


  try {

    const doc = await db.collection('students').doc(user.uid).get();

    if (!doc.exists) {

      // Not a student profile — could be a canteen account.
      const canteenDoc = await db.collection('canteens').doc(user.uid).get();

      if (canteenDoc.exists) {
        showToast('This is a canteen account, not a student account.');
        await auth.signOut();
        window.location.href = HOME_PATH;
        return;
      }

      // Self-heal: create a minimal student profile.
      const fallback = {
        name: user.displayName || 'Student',
        email: user.email || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('students').doc(user.uid).set(fallback);
      studentProfile = fallback;

    } else {
      studentProfile = doc.data();
    }

    updateGreeting(studentProfile.name);
    renderProfileForm();
    renderSettingsForm();

    startListeners(user.uid);

  } catch (err) {
    console.error(err);
    showToast('Unable to load student data.');
  }
});


/* ============ REALTIME LISTENERS ============ */

function startListeners(uid) {

  unsubList.forEach(u => u && u());
  unsubList = [];

  unsubList.push(
    db.collection('canteens').onSnapshot(snap => {
      canteens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderDashboard();
      renderCart();
      renderOrders();
    }, err => console.error(err))
  );

  unsubList.push(
    db.collection('menuItems').where('available', '==', true).onSnapshot(snap => {
      menuItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderDashboard();
      renderCart();
      renderOrders();
    }, err => console.error(err))
  );

  unsubList.push(
    db.collection('students').doc(uid).collection('cart').onSnapshot(snap => {
      cart = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderDashboard();
      renderCart();
    }, err => console.error(err))
  );

  unsubList.push(
    db.collection('students').doc(uid).collection('favorites').onSnapshot(snap => {
      favorites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderDashboard();
      renderFavoritesView();
    }, err => console.error(err))
  );

  unsubList.push(
    db.collection('orders').where('studentId', '==', uid).onSnapshot(snap => {
      orders = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
      renderDashboard();
      renderOrders();
      renderNotifFull();
    }, err => console.error(err))
  );

  unsubList.push(
    db.collection('students').doc(uid).collection('notifications').onSnapshot(snap => {
      notifications = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
      renderNotifPreview();
      renderNotifFull();
    }, err => console.error(err))
  );

  unsubList.push(
    db.collection('suggestions').where('studentId', '==', uid).onSnapshot(snap => {
      mySuggestions = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
      renderMySuggestions();
    }, err => console.error(err))
  );
}

function tsMillis(ts) {
  return ts && ts.toMillis ? ts.toMillis() : 0;
}


/* ============ VIEW SWITCHING ============ */

function showView(viewId, navEl) {

  document.querySelectorAll('.dash-view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');

  document.querySelectorAll('.side-link[data-view]').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  if (viewId !== 'suggestions-view') {
    activeCanteenFilter = null;
  }

  // the top search bar only stays on the Dashboard and Favorites pages
  const noTopSearch = ['suggestions-view', 'cart-view', 'orders-view', 'notifications-view', 'profile-view', 'settings-view', 'help-view'];
  const topSearch = document.querySelector('.dash-search');
  if (topSearch) topSearch.classList.toggle('is-hidden', noTopSearch.includes(viewId));
}


/* ============ CLOCK + GREETING ============ */

function updateGreeting(name) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  document.getElementById('dash-greet').innerHTML =
    `<span class="greet-small">Good ${part},</span><span class="greet-name">${escapeHtml(name || 'Student')}!</span>`;
}

function updateClock() {
  const now = new Date();
  document.getElementById('dash-date').textContent =
    now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  // "Mon · 10:24 AM"
  document.getElementById('dash-time').textContent =
    now.toLocaleDateString('en-US', { weekday: 'short' }) + ' · ' +
    now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

updateClock();
setInterval(updateClock, 30000);


/* ============ SEARCH ============ */

function handleSearch(value) {
  searchQuery = value.trim().toLowerCase();
  renderDashboard();
}

function matchesSearch(name) {
  return !searchQuery || (name || '').toLowerCase().includes(searchQuery);
}


/* ============ HELPERS ============ */

function pesos(n) {
  return '₱' + Number(n || 0).toFixed(2);
}

// "₱45" for whole numbers, "₱45.50" otherwise (matches the reference design)
function pesosShort(n) {
  const v = Number(n || 0);
  return '₱' + (Number.isInteger(v) ? v : v.toFixed(2));
}

// Order #CM-1024 style code from the Firestore doc id
function orderCode(id) {
  return 'CM-' + String(id || '').slice(-4).toUpperCase();
}

// inline SVG icon from the sprite in the HTML
function icon(name, extraClass) {
  return `<svg class="ic ${extraClass || ''}"><use href="#i-${name}"/></svg>`;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fallbackClass(id) {
  const n = String(id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return 'food-fallback-' + (n % 4);
}

function thumbStyle(url, id) {
  return url
    ? `style="background-image:url('${escapeHtml(url)}')"`
    : `class="${fallbackClass(id)}"`;
}

function canteenById(id) {
  return canteens.find(c => c.id === id);
}

function timeAgo(ts) {
  if (!ts || !ts.toMillis) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts.toMillis()) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
  return Math.floor(diffSec / 86400) + 'd ago';
}


/* ============ TOAST ============ */

let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}


/* ============ DASHBOARD RENDER (canteens, foods, stats, notif preview, current order) ============ */

function renderDashboard() {

  // ---- stats ----
  const openCanteens = canteens.filter(c => c.status === 'open').length;
  const cartQty = cart.reduce((s, i) => s + Number(i.qty || 0), 0);
  const cartTotal = cart.reduce((s, i) => s + Number(i.qty || 0) * Number(i.price || 0), 0);
  const ongoing = orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length;

  document.getElementById('stat-canteens').textContent = openCanteens;
  document.getElementById('stat-foods').textContent = menuItems.length;
  document.getElementById('stat-cart').textContent = cartQty;
  document.getElementById('stat-cart-total').textContent =
    `${cartQty} item${cartQty === 1 ? '' : 's'} • ${pesos(cartTotal)}`;
  document.getElementById('stat-ongoing').textContent = ongoing;

  updateSideBadge('cart-badge', cartQty);

  // ---- canteens grid (dashboard: first 4, suggestions view: all) ----
  renderCanteenGrid('canteens-grid', canteens.filter(c => matchesSearch(c.name)).slice(0, 4));
  renderCanteenGrid('suggestions-canteens-grid', canteens);

  // ---- foods (Suggestions page) ----
  renderSuggestionsPage();

  // Popular Foods = top 4 (by sold/orderCount if the field exists, otherwise menu order)
  const dashFoods = menuItems.filter(i => matchesSearch(i.name) || matchesSearch(canteenById(i.canteenId)?.name));
  const popular = [...dashFoods]
    .sort((a, b) => Number(b.sold || b.orderCount || 0) - Number(a.sold || a.orderCount || 0))
    .slice(0, 4);
  renderPopularFoods(popular);

  // Suggestions (right column) = 3 items that aren't already in Popular Foods
  const popularIds = new Set(popular.map(i => i.id));
  const others = dashFoods.filter(i => !popularIds.has(i.id));
  renderSuggestList([...others, ...popular].slice(0, 3));

  // ---- current order box ----
  renderCurrentOrder();

  // ---- profile page: recent activity ----
  renderProfileActivity();
}

const POPULAR_TAGS = ['Most Popular', 'Trending', 'Highly Rated', 'Student Favorite'];

function foodThumbAttrs(url, id, baseClass) {
  return url
    ? `class="${baseClass}" style="background-image:url('${escapeHtml(url)}')"`
    : `class="${baseClass} ${fallbackClass(id)}"`;
}

function renderPopularFoods(list) {
  const el = document.getElementById('popular-grid');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<p class="empty-note">No foods found.</p>';
    return;
  }

  el.innerHTML = list.map((i, idx) => `
    <article class="popular-card" onclick="openFoodModal('${i.id}')">
      <div ${foodThumbAttrs(i.imageUrl, i.id, 'popular-thumb')}></div>
      <div class="popular-name">${escapeHtml(i.name)}</div>
      <div class="popular-price">${pesosShort(i.price)}</div>
      <div class="popular-tag">${icon('flame', 'ic-fill')}${POPULAR_TAGS[idx % POPULAR_TAGS.length]}</div>
    </article>
  `).join('');
}

function renderSuggestList(list) {
  const el = document.getElementById('suggest-list');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<p class="empty-note">No suggestions yet.</p>';
    return;
  }

  el.innerHTML = list.map(i => {
    const canteen = canteenById(i.canteenId);
    return `
      <div class="sugg-item" onclick="openFoodModal('${i.id}')">
        <div ${foodThumbAttrs(i.imageUrl, i.id, 'sugg-thumb')}></div>
        <div class="sugg-info">
          <div class="sugg-name">${escapeHtml(i.name)}</div>
          <div class="sugg-canteen">${escapeHtml(canteen ? canteen.name : 'Canteen')}</div>
          <div class="sugg-price">${pesosShort(i.price)}</div>
        </div>
        ${icon('chev-right', 'sugg-chev')}
      </div>`;
  }).join('');
}

function renderCurrentOrder() {
  const box = document.getElementById('current-order-box');
  if (!box) return;

  const current = orders.find(o => ACTIVE_STATUSES.includes(o.status));

  if (!current) {
    box.innerHTML = '<p class="empty-note">You have no ongoing orders.</p>';
    return;
  }

  const eta = Number(current.etaMinutes || current.estimatedMinutes || 0);
  const items = current.items || [];

  box.innerHTML = `
    <div class="cur-order">
      <div class="cur-top">
        <div>
          <div class="cur-code">Order #${orderCode(current.id)}</div>
          <div class="cur-canteen">${icon('store')}<span>${escapeHtml(current.canteenName)}</span><span class="order-badge ${current.status}">${escapeHtml(current.status)}</span></div>
        </div>
        ${eta ? `<div class="cur-eta">Est. Time<div>${icon('clock')}${eta} min</div></div>` : ''}
      </div>
      <div class="cur-items">
        ${items.slice(0, 3).map(i => `<div class="cur-line"><span>${i.qty}x ${escapeHtml(i.name)}</span><span>${pesosShort(i.price * i.qty)}</span></div>`).join('')}
        ${items.length > 3 ? `<div class="cur-line"><span>+${items.length - 3} more item(s)</span><span></span></div>` : ''}
      </div>
      <div class="cur-total"><span>Total</span><span>${pesosShort(current.total)}</span></div>
      <button class="btn-outline" onclick="openOrderModal('${current.id}')">View Details ${icon('arrow')}</button>
    </div>`;
}

function renderCanteenGrid(containerId, list) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<p class="empty-note">No canteens found.</p>';
    return;
  }

  el.innerHTML = list.map(c => {
    const img = c.bannerUrl || c.logoUrl;
    const open = c.status === 'open';

    // "Burgers • Rice Meals • Drinks" if the canteen has categories, else location/description
    const tags = Array.isArray(c.categories)
      ? c.categories.join(' • ')
      : (c.categories || c.location || c.description || '');

    const rating = Number(c.rating || 0);
    const ratingHtml = rating
      ? `<b>${rating.toFixed(1)}</b><span>(${Number(c.ratingCount || 0)})</span>`
      : `<span>No ratings yet</span>`;

    return `
      <article class="canteen-card">
        <div class="canteen-thumb ${img ? '' : 'no-img'}" ${img ? `style="background-image:url('${escapeHtml(img)}')"` : ''}>
          ${img ? '' : icon('store')}
          <span class="status-chip ${open ? 'open' : 'closed'}">${open ? 'Open' : 'Closed'}</span>
        </div>
        <div class="canteen-body">
          <h3>${escapeHtml(c.name || 'Canteen')}</h3>
          <div class="canteen-tags">${escapeHtml(tags)}</div>
          <div class="canteen-rating">${icon('star', 'ic-fill star')}${ratingHtml}</div>
        </div>
        <button class="canteen-btn" onclick="viewCanteenMenu('${c.id}')">View Menu ${icon('arrow')}</button>
      </article>`;
  }).join('');
}

function viewCanteenMenu(canteenId) {
  activeCanteenFilter = canteenId;
  showView('suggestions-view', document.querySelector('[data-view=suggestions-view]'));
  renderDashboard();
}

function renderFoodGrid(containerId, list) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<p class="empty-note">No foods found.</p>';
    return;
  }

  el.innerHTML = list.map(i => buildFoodCardHtml(i)).join('');
}

function buildFoodCardHtml(item) {
  const canteen = canteenById(item.canteenId);
  const canteenClosed = canteen && canteen.status !== 'open';
  const outOfStock = Number(item.stock || 0) <= 0;
  const isFav = favorites.some(f => f.menuItemId === item.id || f.id === item.id);
  const disabled = canteenClosed || outOfStock;

  return `
    <article class="food-card">
      <div ${foodThumbAttrs(item.imageUrl, item.id, 'food-thumb')} onclick="openFoodModal('${item.id}')"></div>
      <div class="food-canteen-tag">${escapeHtml(canteen ? canteen.name : 'Canteen')}</div>
      <div class="food-name" onclick="openFoodModal('${item.id}')">${escapeHtml(item.name)}</div>
      <div class="food-price">${pesos(item.price)}</div>
      <div class="food-actions">
        <button class="fav-btn ${isFav ? 'is-fav' : ''}" onclick="toggleFavorite('${item.id}')">${icon('heart')}</button>
        <button class="add-btn" ${disabled ? 'disabled' : ''} onclick="addToCart('${item.id}', 1)">${outOfStock ? 'Out of stock' : (canteenClosed ? 'Closed' : 'Add')}</button>
      </div>
    </article>
  `;
}


/* ============ SUGGESTIONS PAGE ============ */

function itemCategory(item) {
  return String((item && item.category) || '').trim();
}

function renderSuggestionsPage() {

  // ---- category chips (built from the categories that exist in the menus) ----
  const cats = [...new Set(menuItems.map(itemCategory).filter(Boolean))].sort();
  if (activeCategory !== 'all' && !cats.includes(activeCategory)) activeCategory = 'all';

  const chipsEl = document.getElementById('category-chips');
  if (chipsEl) {
    const chip = (value, label) =>
      `<button type="button" class="chip ${activeCategory === value ? 'active' : ''}" onclick="setCategory(this.dataset.cat)" data-cat="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
    chipsEl.innerHTML = cats.length
      ? chip('all', 'All') + cats.map(c => chip(c, c)).join('')
      : '';
    chipsEl.style.display = cats.length ? 'flex' : 'none';
  }

  // ---- canteen filter note (set when "View Menu" is clicked on a canteen) ----
  const noteEl = document.getElementById('canteen-filter-note');
  if (noteEl) {
    const c = activeCanteenFilter ? canteenById(activeCanteenFilter) : null;
    noteEl.innerHTML = c
      ? `Showing ${escapeHtml(c.name)} <a href="#" onclick="clearCanteenFilter(); return false;">Show all</a>`
      : '';
  }

  // ---- Recommended For You (canteen filter + category chip) ----
  let list = menuItems.slice();
  if (activeCanteenFilter) list = list.filter(i => i.canteenId === activeCanteenFilter);
  if (activeCategory !== 'all') list = list.filter(i => itemCategory(i) === activeCategory);
  renderFoodGrid('suggestions-grid', list);

  // ---- Popular Foods ----
  const popular = [...menuItems]
    .sort((a, b) => Number(b.sold || b.orderCount || 0) - Number(a.sold || a.orderCount || 0))
    .slice(0, 4);
  renderFoodGrid('suggest-popular-grid', popular);

  // ---- Based on Your Preferences (favorites + past orders) ----
  const prefEl = document.getElementById('suggest-pref-grid');
  if (prefEl) {
    const picks = preferredItems();
    if (picks.length === 0) {
      prefEl.innerHTML = '<p class="empty-note">Add favorites or place an order to see picks that match your taste.</p>';
    } else {
      renderFoodGrid('suggest-pref-grid', picks);
    }
  }

  renderTopCanteens();
}

function preferredItems() {
  const counts = {};
  const tally = (id) => {
    const cat = itemCategory(menuItems.find(i => i.id === id));
    if (cat) counts[cat] = (counts[cat] || 0) + 1;
  };
  favorites.forEach(f => tally(f.menuItemId || f.id));
  orders.forEach(o => (o.items || []).forEach(i => tally(i.menuItemId)));

  const cats = Object.keys(counts);
  if (cats.length === 0) return [];

  const favIds = new Set(favorites.map(f => f.menuItemId || f.id));
  return menuItems
    .filter(i => cats.includes(itemCategory(i)) && !favIds.has(i.id))
    .sort((a, b) => counts[itemCategory(b)] - counts[itemCategory(a)])
    .slice(0, 4);
}

function setCategory(cat) {
  activeCategory = cat || 'all';
  renderSuggestionsPage();
}

function clearCanteenFilter() {
  activeCanteenFilter = null;
  renderSuggestionsPage();
}

function renderTopCanteens() {
  const el = document.getElementById('top-canteens-list');
  if (!el) return;

  if (canteens.length === 0) {
    el.innerHTML = '<p class="empty-note">No canteens yet.</p>';
    return;
  }

  const top = [...canteens]
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, 3);

  el.innerHTML = top.map(c => {
    const img = c.bannerUrl || c.logoUrl;
    const open = c.status === 'open';
    const rating = Number(c.rating || 0);
    const ratingHtml = rating
      ? `${icon('star', 'ic-fill star')}<b>${rating.toFixed(1)}</b><span>(${Number(c.ratingCount || 0)})</span>`
      : '<span>No ratings yet</span>';
    return `
      <div class="top-canteen" onclick="viewCanteenMenu('${c.id}')">
        <div class="top-thumb ${img ? '' : 'no-img'}" ${img ? `style="background-image:url('${escapeHtml(img)}')"` : ''}>${img ? '' : icon('store')}</div>
        <div class="top-info">
          <div class="top-name">${escapeHtml(c.name || 'Canteen')}</div>
          <div class="top-rate">${ratingHtml}</div>
        </div>
        <span class="mini-pill ${open ? 'open' : 'closed'}">${open ? 'Open' : 'Closed'}</span>
      </div>`;
  }).join('');
}

function renderMySuggestions() {
  const el = document.getElementById('my-suggestions-list');
  if (!el) return;

  if (mySuggestions.length === 0) {
    el.innerHTML = '<p class="empty-note">You have not sent any suggestions yet.</p>';
    return;
  }

  el.innerHTML = mySuggestions.slice(0, 4).map(s => `
    <div class="my-sugg">
      <div class="my-sugg-msg">${escapeHtml(s.message)}</div>
      <div class="my-sugg-meta">
        <span>To ${escapeHtml(s.canteenName || 'Canteen')} · ${timeAgo(s.createdAt)}</span>
        <span class="order-badge ${escapeHtml(s.status || 'pending')}">${escapeHtml(s.status || 'pending')}</span>
      </div>
    </div>
  `).join('');
}

function openSuggestionModal() {
  const select = document.getElementById('suggestion-canteen');
  select.innerHTML = canteens.length
    ? canteens.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || 'Canteen')}</option>`).join('')
    : '<option value="">No canteens available</option>';

  if (activeCanteenFilter && canteens.some(c => c.id === activeCanteenFilter)) {
    select.value = activeCanteenFilter;
  }

  document.getElementById('suggestion-message').value = '';
  const err = document.getElementById('suggestion-error');
  err.classList.remove('show');
  err.textContent = '';
  document.getElementById('suggestion-modal-overlay').classList.add('show');
}

function closeSuggestionModal() {
  document.getElementById('suggestion-modal-overlay').classList.remove('show');
}

async function submitSuggestion(e) {
  e.preventDefault();

  const errorEl = document.getElementById('suggestion-error');
  const canteenId = document.getElementById('suggestion-canteen').value;
  const message = document.getElementById('suggestion-message').value.trim();
  const canteen = canteenById(canteenId);

  errorEl.classList.remove('show');

  if (!canteen) {
    errorEl.textContent = 'Please choose a canteen.';
    errorEl.classList.add('show');
    return false;
  }
  if (message.length < 5) {
    errorEl.textContent = 'Please write a short suggestion (at least 5 characters).';
    errorEl.classList.add('show');
    return false;
  }

  const btn = document.getElementById('suggestion-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    await db.collection('suggestions').add({
      studentId: currentUid,
      studentName: studentProfile.name || 'Student',
      canteenId,
      canteenName: canteen.name || '',
      message,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeSuggestionModal();
    showToast('Suggestion sent!');
  } catch (err) {
    console.error(err);
    errorEl.textContent = 'Could not send the suggestion. Please try again.';
    errorEl.classList.add('show');
  }

  btn.disabled = false;
  btn.textContent = 'Send Suggestion';
  return false;
}


/* ============ FOOD QUICK-VIEW MODAL (Read) ============ */

function openFoodModal(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item) return;

  foodModalItem = item;
  foodModalQty = 1;

  const canteen = canteenById(item.canteenId);

  document.getElementById('food-modal-thumb').setAttribute(
    'style', item.imageUrl ? `background-image:url('${item.imageUrl}')` : ''
  );
  document.getElementById('food-modal-name').textContent = item.name || '';
  document.getElementById('food-modal-canteen').textContent = canteen ? canteen.name : 'Canteen';
  document.getElementById('food-modal-desc').textContent = item.description || 'No description.';
  document.getElementById('food-modal-price').textContent = pesos(item.price);
  document.getElementById('food-modal-qty').textContent = foodModalQty;

  const disabled = (canteen && canteen.status !== 'open') || Number(item.stock || 0) <= 0;
  const addBtn = document.getElementById('food-modal-add-btn');
  addBtn.disabled = disabled;
  addBtn.textContent = disabled ? 'Not available' : 'Add to Cart';

  document.getElementById('food-modal-overlay').classList.add('show');
}

function closeFoodModal() {
  document.getElementById('food-modal-overlay').classList.remove('show');
  foodModalItem = null;
}

function modalQty(delta) {
  foodModalQty = Math.max(1, foodModalQty + delta);
  document.getElementById('food-modal-qty').textContent = foodModalQty;
}

function addToCartFromModal() {
  if (!foodModalItem) return;
  addToCart(foodModalItem.id, foodModalQty);
  closeFoodModal();
}


/* ============ CART: CREATE / EDIT / DELETE / BROWSE ============ */

async function addToCart(menuItemId, qty, silent) {

  const item = menuItems.find(i => i.id === menuItemId);
  if (!item) { if (!silent) showToast('This item is no longer available.'); return false; }

  const canteen = canteenById(item.canteenId);
  if (canteen && canteen.status !== 'open') { if (!silent) showToast('This canteen is closed right now.'); return false; }
  if (Number(item.stock || 0) <= 0) { if (!silent) showToast('This item is out of stock.'); return false; }

  const existing = cart.find(c => c.id === menuItemId);
  const newQty = (existing ? Number(existing.qty || 0) : 0) + qty;

  try {
    await db.collection('students').doc(currentUid).collection('cart').doc(menuItemId).set({
      menuItemId,
      canteenId: item.canteenId,
      canteenName: canteen ? canteen.name : '',
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl || '',
      qty: newQty,
      addedAt: existing ? (existing.addedAt || firebase.firestore.FieldValue.serverTimestamp()) : firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (!silent) showToast(`Added to cart: ${item.name}`);
    return true;

  } catch (err) {
    console.error(err);
    if (!silent) showToast('Could not add to cart.');
    return false;
  }
}

async function changeCartQty(itemId, delta) {
  const item = cart.find(c => c.id === itemId);
  if (!item) return;

  const newQty = Number(item.qty || 0) + delta;

  if (newQty <= 0) {
    removeFromCart(itemId);
    return;
  }

  try {
    await db.collection('students').doc(currentUid).collection('cart').doc(itemId).update({
      qty: newQty,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error(err);
    showToast('Could not update the quantity.');
  }
}

async function removeFromCart(itemId) {
  if (!confirm('Remove this item from your cart?')) return;

  try {
    await db.collection('students').doc(currentUid).collection('cart').doc(itemId).delete();
    showToast('Removed from cart.');
  } catch (err) {
    console.error(err);
    showToast('Could not remove the item.');
  }
}

async function clearCart() {
  if (cart.length === 0) return;
  if (!confirm('Remove all items from your cart?')) return;

  try {
    const batch = db.batch();
    cart.forEach(item => {
      batch.delete(db.collection('students').doc(currentUid).collection('cart').doc(item.id));
    });
    await batch.commit();
    showToast('Cart cleared.');
  } catch (err) {
    console.error(err);
    showToast('Could not clear the cart.');
  }
}

// ids of the top-selling foods (only when sales data exists)
function popularIds() {
  return new Set(
    [...menuItems]
      .filter(i => Number(i.sold || i.orderCount || 0) > 0)
      .sort((a, b) => Number(b.sold || b.orderCount || 0) - Number(a.sold || a.orderCount || 0))
      .slice(0, 4)
      .map(i => i.id)
  );
}

function renderCart() {
  const el = document.getElementById('cart-list');
  if (!el) return;

  // ---- order summary ----
  const qty = cart.reduce((s, i) => s + Number(i.qty || 0), 0);
  const subtotal = cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0);
  const fee = cart.length ? SERVICE_FEE : 0;

  document.getElementById('cart-sum-label').textContent = `Subtotal (${qty} item${qty === 1 ? '' : 's'})`;
  document.getElementById('cart-subtotal-amount').textContent = pesos(subtotal);
  document.getElementById('cart-fee-amount').textContent = pesos(fee);
  document.getElementById('cart-total-amount').textContent = pesos(subtotal + fee);

  const btn = document.getElementById('checkout-btn');
  btn.disabled = placingOrder || cart.length === 0;
  btn.innerHTML = placingOrder ? 'Placing order...' : `Proceed to Checkout ${icon('arrow')}`;

  document.getElementById('cart-clear-btn').hidden = cart.length === 0;

  const canteenCards = document.getElementById('cart-canteen-cards');

  if (cart.length === 0) {
    el.innerHTML = '<p class="empty-note">Your cart is empty. Pick something from Suggestions to get started.</p>';
    canteenCards.innerHTML = '';
    return;
  }

  // ---- group by canteen (checkout creates one order per canteen) ----
  const groups = new Map();
  cart.forEach(item => {
    const key = item.canteenId || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const popular = popularIds();

  el.innerHTML = [...groups.entries()].map(([canteenId, items]) => {
    const canteen = canteenById(canteenId);
    const name = canteen ? canteen.name : (items[0].canteenName || 'Canteen');
    const open = canteen && canteen.status === 'open';

    const rows = items.map(item => {
      const live = menuItems.find(m => m.id === (item.menuItemId || item.id));
      const desc = live && live.description ? live.description : '';
      const lineTotal = Number(item.price || 0) * Number(item.qty || 0);

      return `
        <div class="cart-row">
          <div ${foodThumbAttrs(item.imageUrl || (live && live.imageUrl), item.id, 'cart-thumb')}></div>
          <div class="cart-info">
            <div class="cart-name">${escapeHtml(item.name)}</div>
            ${desc ? `<div class="cart-desc">${escapeHtml(desc)}</div>` : ''}
            <div class="cart-tags">
              ${popular.has(item.id) ? '<span class="cart-tag">Popular</span>' : ''}
              <span class="cart-unit">${pesosShort(item.price)}</span>
            </div>
          </div>
          <div class="qty-control">
            <button type="button" aria-label="Decrease quantity" onclick="changeCartQty('${item.id}', -1)">−</button>
            <span>${item.qty}</span>
            <button type="button" aria-label="Increase quantity" onclick="changeCartQty('${item.id}', 1)">+</button>
          </div>
          <div class="cart-subtotal">${pesos(lineTotal)}</div>
          <button class="cart-remove" aria-label="Remove ${escapeHtml(item.name)}" onclick="removeFromCart('${item.id}')">${icon('trash')}</button>
        </div>`;
    }).join('');

    return `
      <div class="cart-group">
        <div class="cart-canteen-head">
          <span class="cart-canteen-icon">${icon('store')}</span>
          <div>
            <div class="cart-canteen-name">${escapeHtml(name)}${canteen ? `<span class="mini-pill ${open ? 'open' : 'closed'}">${open ? 'Open' : 'Closed'}</span>` : ''}</div>
            ${canteen && canteen.location ? `<div class="cart-canteen-loc">${icon('pin')}<span>${escapeHtml(canteen.location)}</span></div>` : ''}
          </div>
          <a href="#" class="view-all" onclick="showView('suggestions-view', document.querySelector('[data-view=suggestions-view]')); return false;">${icon('swap')}Change Canteen</a>
        </div>
        ${rows}
      </div>`;
  }).join('');

  // ---- canteen shortcut cards under the summary ----
  canteenCards.innerHTML = [...groups.keys()].map(id => canteenById(id)).filter(Boolean).map(c => `
    <div class="info-card link" onclick="viewCanteenMenu('${c.id}')">
      <span class="info-icon">${icon('store')}</span>
      <div><strong>${escapeHtml(c.name || 'Canteen')}</strong><small>${escapeHtml(c.description || 'View menu')}</small></div>
      ${icon('chev-right', 'info-chev')}
    </div>
  `).join('');
}


/* ============ CHECKOUT (creates orders, clears cart, notifies) ============ */

async function checkout() {

  if (cart.length === 0) { showToast('Your cart is empty.'); return; }

  const btn = document.getElementById('checkout-btn');
  placingOrder = true;
  btn.disabled = true;
  btn.textContent = 'Placing order...';

  try {

    // Group cart items by canteen — one order per canteen.
    const groups = {};
    cart.forEach(item => {
      if (!groups[item.canteenId]) groups[item.canteenId] = [];
      groups[item.canteenId].push(item);
    });

    for (const canteenId of Object.keys(groups)) {
      const items = groups[canteenId];
      const total = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0);

      const orderRef = await db.collection('orders').add({
        studentId: currentUid,
        studentName: studentProfile.name || 'Student',
        canteenId,
        canteenName: items[0].canteenName || 'Canteen',
        items: items.map(i => ({ menuItemId: i.menuItemId, name: i.name, price: i.price, qty: i.qty, imageUrl: i.imageUrl || '' })),
        total,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await addNotification('orderNotifs', {
        title: 'Order Placed',
        message: `Your order at ${items[0].canteenName} has been placed (${pesos(total)}).`,
        read: false,
        orderId: orderRef.id,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    // Clear the cart.
    const batch = db.batch();
    cart.forEach(item => {
      batch.delete(db.collection('students').doc(currentUid).collection('cart').doc(item.id));
    });
    await batch.commit();

    showToast('Order placed! You can track it in My Orders.');
    setOrderTab('current');
    showView('orders-view', document.querySelector('[data-view=orders-view]'));

  } catch (err) {
    console.error(err);
    showToast('Could not place the order. Please try again.');
  } finally {
    placingOrder = false;
    renderCart();
  }
}


/* ============ FAVORITES: ADD / DELETE / BROWSE ============ */

async function toggleFavorite(menuItemId) {
  const existing = favorites.find(f => f.id === menuItemId);

  try {

    if (existing) {
      await db.collection('students').doc(currentUid).collection('favorites').doc(menuItemId).delete();
      showToast('Removed from favorites.');
      return;
    }

    const item = menuItems.find(i => i.id === menuItemId);
    if (!item) return;

    const canteen = canteenById(item.canteenId);

    await db.collection('students').doc(currentUid).collection('favorites').doc(menuItemId).set({
      menuItemId,
      canteenId: item.canteenId,
      canteenName: canteen ? canteen.name : '',
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl || '',
      addedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('Added to favorites!');

  } catch (err) {
    console.error(err);
    showToast('Could not update favorites.');
  }
}

function renderFavoritesView() {
  const el = document.getElementById('favorites-grid');
  if (!el) return;

  if (favorites.length === 0) {
    el.innerHTML = '<p class="empty-note">No favorites yet.</p>';
    return;
  }

  el.innerHTML = favorites.map(f => {
    const live = menuItems.find(i => i.id === f.menuItemId);
    const canteen = canteenById(f.canteenId);
    const disabled = !live || (canteen && canteen.status !== 'open') || Number(live?.stock || 0) <= 0;

    return `
      <article class="food-card">
        <div ${foodThumbAttrs(f.imageUrl, f.id, 'food-thumb')}></div>
        <div class="food-canteen-tag">${escapeHtml(f.canteenName)}</div>
        <div class="food-name">${escapeHtml(f.name)}</div>
        <div class="food-price">${pesos(f.price)}</div>
        <div class="food-actions">
          <button class="fav-btn is-fav" onclick="toggleFavorite('${f.id}')">${icon('heart')}</button>
          <button class="add-btn" ${disabled ? 'disabled' : ''} onclick="addToCart('${f.menuItemId}', 1)">${!live ? 'Unavailable' : 'Add'}</button>
        </div>
      </article>
    `;
  }).join('');
}


/* ============ ORDERS: BROWSE / READ / CANCEL (delete-like) ============ */

function orderStatusTone(status) {
  if (['pending', 'confirmed', 'preparing'].includes(status)) return { cls: 'tone-current', label: 'Current Order' };
  if (status === 'ready') return { cls: 'tone-ready', label: 'Ready for Pickup' };
  if (status === 'completed') return { cls: 'tone-completed', label: 'Completed' };
  if (status === 'cancelled') return { cls: 'tone-cancelled', label: 'Cancelled' };
  return { cls: 'tone-neutral', label: escapeHtml(status || 'Unknown') };
}

// "Oct 27, 2025 • 10:12 AM"
function orderDateText(ts) {
  if (!ts || !ts.toDate) return 'Just now';
  const d = ts.toDate();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' • ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function orderItemImage(item) {
  if (item.imageUrl) return item.imageUrl;
  const live = menuItems.find(m => m.id === item.menuItemId);
  return live ? live.imageUrl : '';
}

function orderStepperHtml(status, compact) {
  const idx = ORDER_STEP_INDEX[status];
  if (idx === undefined) return '';

  return `<ol class="stepper ${compact ? 'compact' : ''}">` + ORDER_STEPS.map((label, i) => {
    const state = (i < idx || status === 'completed') ? 'done' : (i === idx ? 'current' : 'todo');
    return `<li class="${state}"><span class="step-dot">${state === 'done' ? icon('check') : ''}</span><span class="step-label">${label}</span></li>`;
  }).join('') + '</ol>';
}

function setOrderTab(tab) {
  orderTab = tab;
  ordersPage = 1;
  selectedOrderId = null;

  const cur = document.getElementById('tab-current');
  const his = document.getElementById('tab-history');
  if (cur) cur.classList.toggle('active', tab === 'current');
  if (his) his.classList.toggle('active', tab === 'history');

  renderOrders();
}

function setOrdersPage(page) {
  ordersPage = page;
  renderOrders();
}

function selectOrder(orderId, openModalOnNarrow) {
  selectedOrderId = orderId;
  renderOrders();
  // on narrow screens the details panel sits below the list, so open the modal instead
  if (openModalOnNarrow && window.innerWidth <= 1250) openOrderModal(orderId);
}

function renderOrderCard(o) {
  const items = o.items || [];
  const active = ACTIVE_STATUSES.includes(o.status);
  const tone = orderStatusTone(o.status);
  const eta = Number(o.etaMinutes || o.estimatedMinutes || 0);
  const canReorder = ['ready', 'completed'].includes(o.status);
  const shown = items.slice(0, 2);
  const extra = items.length - shown.length;

  let statusBlock = '';
  if (o.status === 'completed') statusBlock = `<span class="ord-pill tone-completed">${icon('check')}Completed</span>`;
  else if (o.status === 'cancelled') statusBlock = `<span class="ord-pill tone-cancelled">${icon('x')}Cancelled</span>`;
  else if (o.status === 'ready') statusBlock = `<span class="ord-pill tone-ready">${icon('box')}Ready for Pickup</span>`;
  else if (active && eta) statusBlock = `<div class="ord-eta">Est. Time<b>${icon('clock')}${eta} min</b></div>`;

  return `
    <article class="ord-card ${o.id === selectedOrderId ? 'selected' : ''}" onclick="selectOrder('${o.id}')">
      <div ${foodThumbAttrs(items[0] ? orderItemImage(items[0]) : '', o.id, 'ord-thumb')}></div>

      <div class="ord-main">
        <div class="ord-head">
          <span class="ord-code">Order #${orderCode(o.id)}</span>
          <span class="ord-badge ${tone.cls}">${tone.label}</span>
        </div>
        <div class="ord-meta">${icon('store')}<span>${escapeHtml(o.canteenName)}</span></div>
        <div class="ord-meta"><span>${orderDateText(o.createdAt)}</span></div>
        <div class="ord-lines">
          ${shown.map(i => `<div class="ord-line"><span>${i.qty}x ${escapeHtml(i.name)}</span><span>${pesos(Number(i.price || 0) * Number(i.qty || 0))}</span></div>`).join('')}
          ${extra > 0 ? `<div class="ord-line"><span>+${extra} more item${extra === 1 ? '' : 's'}</span><span></span></div>` : ''}
        </div>
        ${active ? orderStepperHtml(o.status, false) : ''}
      </div>

      <div class="ord-side">
        <div class="ord-total-wrap">
          <div class="ord-total-label">Total Amount</div>
          <div class="ord-total">${pesos(o.total)}</div>
        </div>
        ${statusBlock}
        <div class="ord-actions">
          <button type="button" class="btn-outline btn-sm" onclick="event.stopPropagation(); selectOrder('${o.id}', true)">View Details ${icon('arrow')}</button>
          ${canReorder ? `<button type="button" class="btn-outline btn-sm" onclick="event.stopPropagation(); reorderOrder('${o.id}')">${icon('refresh')}Reorder</button>` : ''}
        </div>
      </div>
    </article>`;
}

function renderOrderDetail(o) {
  const el = document.getElementById('order-detail-panel');
  if (!el) return;

  if (!o) {
    el.innerHTML = '<p class="empty-note">Select an order to see its details.</p>';
    return;
  }

  const items = o.items || [];
  const subtotal = items.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0);
  const fee = Math.max(0, Number(o.total || 0) - subtotal);
  const tone = orderStatusTone(o.status);
  const progress = o.status === 'cancelled'
    ? `<span class="ord-pill tone-cancelled">${icon('x')}Cancelled</span>`
    : orderStepperHtml(o.status, true);

  el.innerHTML = `
    <div class="od-head"><h2>Order #${orderCode(o.id)}</h2><span class="ord-badge ${tone.cls}">${tone.label}</span></div>
    <div class="od-meta">${icon('store')}<span>${escapeHtml(o.canteenName)}</span></div>
    <div class="od-meta">${icon('clock')}<span>${orderDateText(o.createdAt)}</span></div>

    <div class="od-divider"></div>
    <div class="od-title">Order Items</div>
    ${items.map(i => `
      <div class="od-item">
        <div ${foodThumbAttrs(orderItemImage(i), i.menuItemId, 'od-thumb')}></div>
        <div class="od-item-info">
          <div class="od-item-name">${escapeHtml(i.name)}</div>
          <div class="od-item-price">${pesosShort(i.price)}</div>
        </div>
        <span class="od-qty">${i.qty}</span>
        <span class="od-item-total">${pesos(Number(i.price || 0) * Number(i.qty || 0))}</span>
      </div>`).join('')}

    <div class="od-divider"></div>
    <div class="sum-rows">
      <div class="sum-row"><span>Subtotal</span><span>${pesos(subtotal)}</span></div>
      <div class="sum-row"><span>Delivery / Service Fee</span><span>${pesos(fee)}</span></div>
    </div>
    <div class="od-divider"></div>
    <div class="sum-total"><span>Total Amount</span><span>${pesos(o.total)}</span></div>

    <div class="od-divider"></div>
    <div class="od-title">Order Status</div>
    ${progress}

    <div class="od-actions">
      <button type="button" class="btn-outline" onclick="openOrderModal('${o.id}')">View Full Order Details ${icon('arrow')}</button>
      ${CANCELABLE_STATUSES.includes(o.status) ? `<button type="button" class="btn-outline danger" onclick="cancelOrder('${o.id}')">Cancel Order</button>` : ''}
    </div>`;
}

function renderOrders() {
  const el = document.getElementById('orders-list');
  if (!el) return;

  const list = orders.filter(o => (orderTab === 'current') === ACTIVE_STATUSES.includes(o.status));

  const pages = Math.max(1, Math.ceil(list.length / ORDERS_PER_PAGE));
  if (ordersPage > pages) ordersPage = pages;

  if (!list.some(o => o.id === selectedOrderId)) {
    selectedOrderId = list.length ? list[0].id : null;
  }

  if (list.length === 0) {
    el.innerHTML = orderTab === 'current'
      ? '<p class="empty-note">You have no current orders.</p>'
      : '<p class="empty-note">No past orders yet.</p>';
  } else {
    const start = (ordersPage - 1) * ORDERS_PER_PAGE;
    el.innerHTML = list.slice(start, start + ORDERS_PER_PAGE).map(renderOrderCard).join('');
  }

  // ---- pagination ----
  const pager = document.getElementById('orders-pager');
  if (pager) {
    if (pages <= 1) {
      pager.innerHTML = '';
    } else {
      let html = `<button type="button" class="pg" aria-label="Previous page" ${ordersPage === 1 ? 'disabled' : ''} onclick="setOrdersPage(${ordersPage - 1})">${icon('chev-left')}</button>`;
      for (let p = 1; p <= pages; p++) {
        html += `<button type="button" class="pg ${p === ordersPage ? 'active' : ''}" onclick="setOrdersPage(${p})">${p}</button>`;
      }
      html += `<button type="button" class="pg" aria-label="Next page" ${ordersPage === pages ? 'disabled' : ''} onclick="setOrdersPage(${ordersPage + 1})">${icon('chev-right')}</button>`;
      pager.innerHTML = html;
    }
  }

  renderOrderDetail(list.find(o => o.id === selectedOrderId));
}

async function reorderOrder(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  let added = 0;
  let skipped = 0;

  for (const i of (order.items || [])) {
    const ok = await addToCart(i.menuItemId, Number(i.qty || 1), true);
    if (ok) added++; else skipped++;
  }

  if (added === 0) {
    showToast('Those items are not available right now.');
    return;
  }

  showToast(skipped
    ? `Added ${added} item${added === 1 ? '' : 's'} to your cart. ${skipped} unavailable.`
    : 'Items added to your cart.');
  showView('cart-view', document.querySelector('[data-view=cart-view]'));
}

function openOrderModal(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  orderModalId = orderId;

  document.getElementById('order-modal-canteen').textContent = order.canteenName;
  document.getElementById('order-modal-items').innerHTML = order.items.map(i =>
    `<div class="order-line"><span>${i.qty}x ${escapeHtml(i.name)}</span><span>${pesos(i.price * i.qty)}</span></div>`
  ).join('');
  document.getElementById('order-modal-total').textContent = pesos(order.total);
  document.getElementById('order-modal-status').textContent = `Status: ${order.status}`;

  const cancelBtn = document.getElementById('order-modal-cancel-btn');
  cancelBtn.style.display = CANCELABLE_STATUSES.includes(order.status) ? 'block' : 'none';

  document.getElementById('order-modal-overlay').classList.add('show');
}

function closeOrderModal() {
  document.getElementById('order-modal-overlay').classList.remove('show');
  orderModalId = null;
}

async function cancelOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order?')) return;

  try {
    const order = orders.find(o => o.id === orderId);

    await db.collection('orders').doc(orderId).update({
      status: 'cancelled',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await addNotification('orderNotifs', {
      title: 'Order Cancelled',
      message: `Your order at ${order ? order.canteenName : 'the canteen'} was cancelled.`,
      read: false,
      orderId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('Order cancelled.');

  } catch (err) {
    console.error(err);
    showToast('Could not cancel the order.');
  }
}

function cancelOrderFromModal() {
  if (!orderModalId) return;
  cancelOrder(orderModalId);
  closeOrderModal();
}


/* ============ SMALL SHARED HELPERS (new pages) ============ */

function goTo(viewId) {
  showView(viewId, document.querySelector('[data-view="' + viewId + '"]'));
}

function triggerLogout() {
  document.getElementById('logout-link').click();
}

// Creates a notification for this student unless they turned that kind off in Settings.
function addNotification(settingKey, payload) {
  const s = studentProfile.settings || {};
  if (s[settingKey] === false) return Promise.resolve(null);
  return db.collection('students').doc(currentUid).collection('notifications').add(payload);
}


/* ============ NOTIFICATIONS: BROWSE / EDIT (mark read) / DELETE ============ */

let notifTab = 'all';   // 'all' | 'orders' | 'canteen' | 'system'
const notifVisible = { orders: true, canteen: true, system: true };

function notifCategory(n) {
  const t = String(n.category || n.type || '').toLowerCase();
  if (t.startsWith('order')) return 'orders';
  if (t.startsWith('canteen') || t === 'promo' || t === 'announcement') return 'canteen';
  if (t === 'system') return 'system';
  if (n.orderId) return 'orders';
  if (n.canteenId || n.canteenName) return 'canteen';
  return 'system';
}

// icon + tone for one notification, based on what it says
function notifLook(n, cat) {
  const text = ((n.title || '') + ' ' + (n.message || '')).toLowerCase();
  if (/cancel|reject|declin/.test(text)) return { icon: 'x', tone: 'is-danger' };
  if (/ready|pickup/.test(text))        return { icon: 'shield', tone: '' };
  if (/complet/.test(text))             return { icon: 'check', tone: '' };
  if (/prepar/.test(text))              return { icon: 'utensils', tone: '' };
  if (/confirm|placed/.test(text))      return { icon: 'cart', tone: '' };
  if (/promo|discount|off\b|%/.test(text)) return { icon: 'star', tone: 'is-promo' };
  if (cat === 'canteen') return { icon: 'store', tone: '' };
  if (cat === 'system')  return { icon: 'info', tone: '' };
  return { icon: 'box', tone: '' };
}

// "Canteen name • Order #CM-1024"
function notifMeta(n) {
  const order = n.orderId ? orders.find(o => o.id === n.orderId) : null;
  const parts = [];
  const canteenName = (order && order.canteenName) || n.canteenName;
  if (canteenName) parts.push(canteenName);
  if (n.orderId) parts.push('Order #' + orderCode(n.orderId));
  if (!parts.length) parts.push('Campus Cart');
  return parts.join(' • ');
}

function renderNotifPreview() {
  const el = document.getElementById('notif-preview-list');
  if (!el) return;

  updateSideBadge('notif-badge', notifications.filter(n => !n.read).length);

  if (notifications.length === 0) {
    el.innerHTML = '<li class="empty-note">No notifications yet.</li>';
    return;
  }

  el.innerHTML = notifications.slice(0, 3).map(n => `
    <li>
      <span class="notif-dot ${n.read ? 'read' : ''}"></span>
      <span class="notif-msg">${escapeHtml(n.message)}</span>
      <em class="notif-time">${timeAgo(n.createdAt)}</em>
    </li>
  `).join('');
}

function renderNotifFull() {
  const el = document.getElementById('notif-full-list');
  if (!el) return;

  // ---- tab counts ----
  const counts = { all: notifications.length, orders: 0, canteen: 0, system: 0 };
  notifications.forEach(n => { counts[notifCategory(n)]++; });
  Object.keys(counts).forEach(k => {
    const c = document.getElementById('notif-count-' + k);
    if (c) c.textContent = counts[k];
  });

  // ---- "all caught up" card ----
  const unread = notifications.filter(n => !n.read).length;
  const titleEl = document.getElementById('notif-status-title');
  const subEl = document.getElementById('notif-status-sub');
  if (titleEl) titleEl.textContent = unread ? `${unread} unread notification${unread === 1 ? '' : 's'}` : "You're all caught up!";
  if (subEl) subEl.textContent = unread ? 'Open one to mark it as read.' : 'No new notifications at the moment.';

  // ---- footer buttons ----
  const foot = document.getElementById('notif-foot');
  const markAll = document.getElementById('notif-markall-btn');
  if (foot) foot.hidden = notifications.length === 0;
  if (markAll) markAll.hidden = unread === 0;

  // ---- list ----
  const list = notifications.filter(n => {
    const cat = notifCategory(n);
    return (notifTab === 'all' || notifTab === cat) && notifVisible[cat];
  });

  if (list.length === 0) {
    el.innerHTML = notifications.length === 0
      ? '<li class="empty-note">No notifications yet. Updates about your orders and canteens will show up here.</li>'
      : '<li class="empty-note">Nothing to show. Try another tab or turn on more filters.</li>';
    return;
  }

  el.innerHTML = list.map(n => {
    const cat = notifCategory(n);
    const look = notifLook(n, cat);
    const id = escapeHtml(n.id);
    return `
      <li class="notif-item ${n.read ? '' : 'unread'} ${look.tone}" tabindex="0" role="button"
          onclick="openNotification('${id}')"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openNotification('${id}')}">
        <span class="notif-icon">${icon(look.icon)}</span>
        <div class="notif-body">
          <div class="notif-title-row"><span class="notif-full-title">${escapeHtml(n.title || 'Notification')}</span></div>
          <p class="notif-text">${escapeHtml(n.message)}</p>
          <span class="notif-meta">${escapeHtml(notifMeta(n))}</span>
        </div>
        <div class="notif-side">
          <span class="notif-when">${timeAgo(n.createdAt)}</span>
          <div class="notif-actions">
            <button type="button" class="notif-del" aria-label="Delete notification"
                    onclick="event.stopPropagation(); deleteNotification('${id}')">${icon('trash')}</button>
            ${n.orderId ? icon('chev-right', 'notif-go') : ''}
          </div>
        </div>
      </li>`;
  }).join('');
}

function setNotifTab(tab) {
  notifTab = tab;
  document.querySelectorAll('#notif-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  renderNotifFull();
}

function syncNotifFilterSwitches() {
  Object.keys(notifVisible).forEach(k => {
    const input = document.getElementById('nf-' + k);
    if (input) input.checked = notifVisible[k];
  });
  const all = document.getElementById('nf-all');
  if (all) all.checked = Object.values(notifVisible).every(Boolean);
}

function onNotifFilterChange(input) {
  const key = input.dataset.filter;
  if (key === 'all') {
    Object.keys(notifVisible).forEach(k => { notifVisible[k] = input.checked; });
  } else {
    notifVisible[key] = input.checked;
  }
  syncNotifFilterSwitches();
  renderNotifFull();
}

// click on a notification: mark it read, and jump to the order if it has one
function openNotification(id) {
  const n = notifications.find(x => x.id === id);
  if (!n) return;

  if (!n.read) markNotifRead(id);
  if (!n.orderId) return;

  const order = orders.find(o => o.id === n.orderId);
  if (!order) { showToast('This order is no longer available.'); return; }

  const tab = ACTIVE_STATUSES.includes(order.status) ? 'current' : 'history';
  setOrderTab(tab);

  // make sure the order's page is the one showing
  const sameTab = orders.filter(o => (tab === 'current') === ACTIVE_STATUSES.includes(o.status));
  const index = sameTab.findIndex(o => o.id === order.id);
  ordersPage = Math.floor(Math.max(0, index) / ORDERS_PER_PAGE) + 1;

  goTo('orders-view');
  selectOrder(order.id, true);
}

function updateSideBadge(id, count) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

async function markNotifRead(id) {
  try {
    await db.collection('students').doc(currentUid).collection('notifications').doc(id).update({ read: true });
  } catch (err) {
    console.error(err);
  }
}

async function markAllNotifRead() {
  const unread = notifications.filter(n => !n.read);
  if (unread.length === 0) return;

  try {
    const batch = db.batch();
    unread.forEach(n => {
      batch.update(db.collection('students').doc(currentUid).collection('notifications').doc(n.id), { read: true });
    });
    await batch.commit();
    showToast('All notifications marked as read.');
  } catch (err) {
    console.error(err);
    showToast('Could not update the notifications.');
  }
}

async function deleteNotification(id) {
  try {
    await db.collection('students').doc(currentUid).collection('notifications').doc(id).delete();
  } catch (err) {
    console.error(err);
    showToast('Could not delete the notification.');
  }
}

async function clearAllNotifications() {
  if (notifications.length === 0) { showToast('You have no notifications to clear.'); return; }
  if (!confirm('Delete all notifications?')) return;

  try {
    const batch = db.batch();
    notifications.forEach(n => {
      batch.delete(db.collection('students').doc(currentUid).collection('notifications').doc(n.id));
    });
    await batch.commit();
    showToast('All notifications cleared.');
  } catch (err) {
    console.error(err);
    showToast('Could not clear notifications.');
  }
}


/* ============ PROFILE: READ / EDIT ============ */

// fills every [data-pf] element (hero, personal details, account info)
function renderProfileView() {
  const p = studentProfile || {};
  const values = {
    name: p.name,
    studentId: p.studentIdNum,
    course: p.course,
    email: p.email || (auth.currentUser && auth.currentUser.email),
    contact: p.contact
  };

  document.querySelectorAll('[data-pf]').forEach(el => {
    const v = values[el.dataset.pf];
    el.textContent = v || (el.dataset.pf === 'name' ? 'Student' : 'Not set');
    el.classList.toggle('is-empty', !v && el.dataset.pf !== 'name');
  });

  renderAvatars();
  renderProfileActivity();
}

function renderProfileForm() {
  document.getElementById('profile-name').value = studentProfile.name || '';
  document.getElementById('profile-email').value = studentProfile.email || (auth.currentUser && auth.currentUser.email) || '';
  document.getElementById('profile-course').value = studentProfile.course || '';
  document.getElementById('profile-student-id').value = studentProfile.studentIdNum || '';
  document.getElementById('profile-contact').value = studentProfile.contact || '';
  renderProfileView();
}

function openProfileModal(focusId) {
  renderProfileForm();   // discard any half-typed edits from last time
  document.getElementById('profile-error').classList.remove('show');
  document.getElementById('profile-modal-overlay').classList.add('show');

  setTimeout(() => {
    const field = document.getElementById(focusId || 'profile-name');
    if (field && !field.disabled) field.focus();
  }, 60);
}

function closeProfileModal() {
  document.getElementById('profile-modal-overlay').classList.remove('show');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeProfileModal();
});

async function saveProfile(event) {
  event.preventDefault();

  const errorEl = document.getElementById('profile-error');
  errorEl.classList.remove('show');

  const name = document.getElementById('profile-name').value.trim();

  if (!name) {
    errorEl.textContent = 'Name is required.';
    errorEl.classList.add('show');
    return false;
  }

  const btn = document.getElementById('profile-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const payload = {
    name,
    course: document.getElementById('profile-course').value.trim(),
    studentIdNum: document.getElementById('profile-student-id').value.trim(),
    contact: document.getElementById('profile-contact').value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('students').doc(currentUid).update(payload);

    if (auth.currentUser) {
      await auth.currentUser.updateProfile({ displayName: name });
    }

    studentProfile = { ...studentProfile, ...payload };
    updateGreeting(name);
    renderProfileForm();
    closeProfileModal();

    showToast('Profile saved!');

  } catch (err) {
    console.error(err);
    errorEl.textContent = 'Could not save the profile. Please try again.';
    errorEl.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }

  return false;
}

/* ---- profile photo (stored as a small square JPEG on the student document) ---- */

function renderAvatars() {
  const url = studentProfile.photoData || '';
  const valid = url.startsWith('data:image/');

  document.querySelectorAll('[data-avatar]').forEach(el => {
    el.style.backgroundImage = valid ? `url("${url}")` : '';
    el.classList.toggle('has-photo', valid);
  });

}

function pickProfilePhoto() {
  document.getElementById('profile-photo-input').click();
}

function handleProfilePhoto(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    showToast('Please choose a JPG or PNG image.');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('That photo is over 2 MB. Please choose a smaller one.');
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => showToast('Could not read that image.');
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => showToast('Could not read that image.');
    img.onload = async () => {
      // center-crop to a 256x256 square so it stays tiny in Firestore
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const side = Math.min(img.width, img.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      const photoData = canvas.toDataURL('image/jpeg', 0.85);

      try {
        await db.collection('students').doc(currentUid).update({
          photoData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        studentProfile.photoData = photoData;
        renderAvatars();
        showToast('Profile photo updated!');
      } catch (err) {
        console.error(err);
        showToast('Could not save the photo. Please try again.');
      }
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ---- recent activity (built from the cart + orders that are already loaded) ---- */

function activityMillis(ts) {
  // a just-written server timestamp is still null locally, so treat it as "now"
  return ts && ts.toMillis ? ts.toMillis() : Date.now();
}

function activityDate(ts) {
  if (!ts || !ts.toDate) return 'Just now';
  const d = ts.toDate();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function renderProfileActivity() {
  const el = document.getElementById('profile-activity');
  if (!el) return;

  const events = [];

  cart.forEach(i => events.push({ icon: 'cart', title: 'Added to Cart', sub: i.name, ts: i.addedAt }));

  orders.forEach(o => {
    const code = 'Order #' + orderCode(o.id);
    events.push({ icon: 'box', title: 'Placed Order', sub: code, ts: o.createdAt });
    if (o.status === 'completed') events.push({ icon: 'check', title: 'Order Completed', sub: code, ts: o.updatedAt });
    if (o.status === 'cancelled') events.push({ icon: 'x', title: 'Order Cancelled', sub: code, ts: o.updatedAt });
  });

  events.sort((a, b) => activityMillis(b.ts) - activityMillis(a.ts));

  if (events.length === 0) {
    el.innerHTML = '<p class="empty-note">No activity yet. Add something to your cart or place an order to see it here.</p>';
    return;
  }

  el.innerHTML = events.slice(0, 3).map(e => `
    <div class="activity-card">
      <span class="info-icon">${icon(e.icon)}</span>
      <div>
        <strong>${escapeHtml(e.title)}</strong>
        <small>${escapeHtml(e.sub)}</small>
        <small>${activityDate(e.ts)}</small>
      </div>
    </div>
  `).join('');
}


/* ============ SETTINGS: READ / EDIT ============ */

function renderSettingsForm() {
  const s = studentProfile.settings || {};
  document.getElementById('setting-order-notifs').checked = s.orderNotifs !== false;
  document.getElementById('setting-promo-notifs').checked = s.promoNotifs !== false;
  document.getElementById('setting-system-notifs').checked = s.systemNotifs !== false;

  const email = studentProfile.email || (auth.currentUser && auth.currentUser.email) || '—';
  document.getElementById('settings-email').textContent = email;
}

async function saveSettings(event) {
  event.preventDefault();

  const settings = {
    orderNotifs: document.getElementById('setting-order-notifs').checked,
    promoNotifs: document.getElementById('setting-promo-notifs').checked,
    systemNotifs: document.getElementById('setting-system-notifs').checked
  };

  try {
    await db.collection('students').doc(currentUid).update({
      settings,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    studentProfile.settings = settings;
    showToast('Settings saved!');

  } catch (err) {
    console.error(err);
    showToast('Could not save settings.');
  }

  return false;
}

async function sendPasswordReset() {
  if (!auth.currentUser || !auth.currentUser.email) return;

  try {
    await auth.sendPasswordResetEmail(auth.currentUser.email);
    showToast('Password reset email sent!');
  } catch (err) {
    console.error(err);
    showToast('Could not send the reset email.');
  }
}


/* ============ HELP / SUPPORT ============ */

const SUPPORT_EMAIL = 'campuscart.support@example.com';   // change to your real support address
let helpCategory = 'all';

function setHelpCategory(cat) {
  helpCategory = cat;
  document.querySelectorAll('#help-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.helpCat === cat));
  filterHelp();
}

function filterHelp() {
  const input = document.getElementById('help-search-input');
  const q = (input ? input.value : '').trim().toLowerCase();
  let shown = 0;

  document.querySelectorAll('#faq-list .faq-item').forEach(item => {
    const okCategory = helpCategory === 'all' || item.dataset.cat === helpCategory;
    const okText = !q || item.textContent.toLowerCase().includes(q);
    item.hidden = !(okCategory && okText);
    if (!item.hidden) shown++;
  });

  document.getElementById('help-empty').hidden = shown > 0;
}

// no backend needed: opens the student's email app with the message filled in
function sendSupportMessage(event) {
  event.preventDefault();

  const errorEl = document.getElementById('support-error');
  errorEl.classList.remove('show');

  const topic = document.getElementById('support-topic').value;
  const message = document.getElementById('support-message').value.trim();

  if (message.length < 10) {
    errorEl.textContent = 'Please describe your concern in at least 10 characters.';
    errorEl.classList.add('show');
    return false;
  }

  const email = (auth.currentUser && auth.currentUser.email) || studentProfile.email || '';
  const body = `${message}\n\n---\nName: ${studentProfile.name || 'Student'}\nEmail: ${email}`;

  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[Campus Cart] ' + topic)}&body=${encodeURIComponent(body)}`;
  showToast('Opening your email app...');
  return false;
}


/* ============ LOGOUT ============ */

document.getElementById('logout-link').addEventListener('click', (e) => {
  e.preventDefault();

  unsubList.forEach(u => u && u());

  auth.signOut()
    .then(() => window.location.href = HOME_PATH)
    .catch(() => window.location.href = HOME_PATH);
});