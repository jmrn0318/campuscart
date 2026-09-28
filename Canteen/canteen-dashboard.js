/* ============ FIREBASE CONFIG (same project as script.js) ============ */

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

const LOW_STOCK_THRESHOLD = 5;

const WEEK_DAYS = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday']
];

let currentUid = null;
let menuItems = [];
let activeCategory = 'all';
let searchQuery = '';
let menuUnsub = null;
let orders = [];          // orders where canteenId == uid
let ordersUnsub = null;
let ordersLoaded = false;
let suggestions = [];     // suggestions where canteenId == uid
let suggestionsUnsub = null;
let suggestionFilter = 'all';
let reportRange = '7d';


/* ============ AUTH GUARD ============ */

auth.onAuthStateChanged(async (user) => {

  /*
   * IMPORTANT:
   * canteen-dashboard.html is inside /Canteen/
   * while index.html is in the project root.
   *
   * Therefore:
   * index.html     -> WRONG
   * ../index.html  -> CORRECT
   */

  if (!user) {
    window.location.href = '../index.html';
    return;
  }

  currentUid = user.uid;

  // Start the menu items listener right away, independent of the
  // canteen profile fetch below. onSnapshot has its own built-in
  // retry/reconnect logic, so even if the network is briefly "offline"
  // right now, the menu list will still populate once it reconnects —
  // instead of never loading at all if the profile fetch below fails.
  listenToMenuItems(user.uid);
  listenToOrders(user.uid);
  listenToSuggestions(user.uid);

  try {

    const doc = await db.collection('canteens').doc(user.uid).get();

    if (doc.exists) {
      applyProfileToUI(doc.data(), user);
      return;
    }

    // No canteen profile yet.
    // Check if this is actually a student account.
    const studentDoc = await db.collection('students').doc(user.uid).get();

    if (studentDoc.exists) {

      showToast('This is a student account, not a canteen account.');

      await auth.signOut();

      window.location.href = '../index.html';

      return;
    }

    /*
     * Neither profile exists.
     *
     * Self-heal by creating the canteen profile.
     */
    const fallbackProfile = {

      name: user.displayName || 'My Canteen',

      email: user.email || '',

      description: '',

      location: '',

      ownerName: '',

      canteenType: 'Food & Beverages',

      serviceType: 'Dine-in + Take-out',

      establishedSince: '',

      contact: '',

      logoUrl: '',

      bannerUrl: '',

      operatingHours: buildDefaultOperatingHours(),

      status: 'closed',

      ownerUid: user.uid,

      createdAt:
        firebase.firestore.FieldValue.serverTimestamp(),

      updatedAt:
        firebase.firestore.FieldValue.serverTimestamp()
    };

    await db
      .collection('canteens')
      .doc(user.uid)
      .set(fallbackProfile);

    applyProfileToUI(fallbackProfile, user);

    showToast('Your canteen profile was recovered.');

  } catch (err) {

    console.error(err);

    showToast('Could not load canteen data.');
  }
});


function canteenLogout() {
  const modal = document.getElementById('logoutModal');

  if (modal) {
    modal.classList.add('show');
  }
}

function closeLogoutModal() {
  const modal = document.getElementById('logoutModal');

  if (modal) {
    modal.classList.remove('show');
  }
}

function confirmCanteenLogout() {
  auth.signOut()
    .then(() => {
      window.location.href = '../index.html';
    })
    .catch((error) => {
      console.error('Logout error:', error);
      window.location.href = '../index.html';
    });
}


/* ============ VIEW SWITCHING ============ */

function showView(viewId, navEl) {

  document
    .querySelectorAll('.dash-view')
    .forEach(v => v.classList.remove('active'));

  document
    .getElementById(viewId)
    .classList.add('active');


  document
    .querySelectorAll('.dash-nav-item[data-view]')
    .forEach(n => n.classList.remove('active'));


  if (navEl) {
    navEl.classList.add('active');
  }


  const titles = {

    'dashboard-view': [
      'Dashboard',
      'Summary of your canteen today.'
    ],

    'orders-view': [
      'Order Management',
      'Accept orders and update their status.'
    ],

    'history-view': [
      'Order History',
      'Completed and cancelled orders.'
    ],

    'reports-view': [
      'Sales & Reports',
      'View your sales, top items and order trends.'
    ],

    'suggestions-view': [
      'Student Suggestions',
      'Suggestions from students for your canteen.'
    ],

    'notifications-view': [
      'Notifications',
      'New orders, cancellations and suggestions.'
    ],

    'menu-view': [
      'Menu Management',
      'Easily manage your canteen menu. Add, edit, and organize food items for your students.'
    ],

    'profile-view': [
      'Canteen Profile',
      'Manage your canteen information, update your details, and keep your students informed.'
    ]

  };


  const [title, sub] =
    titles[viewId] || ['Dashboard', ''];


  document.getElementById('topbar-title').textContent = title;

  document.getElementById('topbar-sub').textContent = sub;
}


/* ============ DEFAULT OPERATING HOURS ============ */

function buildDefaultOperatingHours() {

  const hours = {};

  WEEK_DAYS.forEach(([key]) => {
    hours[key] = { enabled: false, time: '' };
  });

  return hours;
}


/* ============ PROFILE ============ */

function applyProfileToUI(data, user) {

  document.getElementById('profile-name').value =
    data.name || '';

  document.getElementById('profile-owner').value =
    data.ownerName || '';

  document.getElementById('profile-contact').value =
    data.contact || '';

  document.getElementById('profile-email').value =
    data.email || (user && user.email) || '';

  document.getElementById('profile-description').value =
    data.description || '';

  document.getElementById('profile-location').value =
    data.location || '';

  document.getElementById('profile-type').value =
    data.canteenType || 'Food & Beverages';

  document.getElementById('profile-service').value =
    data.serviceType || 'Dine-in + Take-out';

  document.getElementById('profile-established').value =
    data.establishedSince || '';


  setAvatarPreview(data.logoUrl || '');

  setBannerPreview(data.bannerUrl || '');

  renderOperatingHours(data.operatingHours || buildDefaultOperatingHours());


  const isOpen = data.status === 'open';


  document.getElementById('profile-status-toggle').checked =
    isOpen;


  document.getElementById('profile-status-label').textContent =
    isOpen ? 'Open' : 'Closed';


  document.getElementById('topbar-sub').textContent =
    data.name ? `${data.name}` : 'Canteen';


  updateStatusPill(isOpen);
}


function updateStatusPill(isOpen) {

  const topbarPill =
    document.getElementById('status-pill-topbar');

  topbarPill.textContent =
    isOpen ? 'OPEN' : 'CLOSED';

  topbarPill.className =
    'status-pill ' + (isOpen ? 'open' : 'closed');


  const profilePill =
    document.getElementById('profile-status-pill');

  if (profilePill) {

    profilePill.textContent =
      isOpen ? 'OPEN' : 'CLOSED';

    profilePill.className =
      'status-pill ' + (isOpen ? 'open' : 'closed');
  }
}


/* ============ AVATAR / BANNER PREVIEWS ============ */

function setAvatarPreview(url) {

  const el = document.getElementById('profile-avatar');

  if (!el) return;

  const removeBtn =
    document.getElementById('avatar-remove-btn');

  if (url) {

    el.style.backgroundImage = `url('${escapeHtml(url)}')`;

    el.classList.add('has-image');

    if (removeBtn) removeBtn.style.display = '';

  } else {

    el.style.backgroundImage = '';

    el.classList.remove('has-image');

    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function setBannerPreview(url) {

  const el = document.getElementById('profile-banner');

  if (!el) return;

  const removeBtn =
    document.getElementById('banner-remove-btn');

  if (url) {

    el.style.backgroundImage = `url('${escapeHtml(url)}')`;

    el.classList.add('has-image');

    if (removeBtn) removeBtn.style.display = '';

  } else {

    el.style.backgroundImage = '';

    el.classList.remove('has-image');

    if (removeBtn) removeBtn.style.display = 'none';
  }
}

async function removeAvatar() {

  if (!confirm('Remove your canteen profile picture?')) {
    return;
  }

  setAvatarPreview('');

  try {

    await db.collection('canteens').doc(currentUid).update({
      logoUrl: '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('Profile picture removed.');

  } catch (err) {

    console.error(err);

    showToast('Could not remove the profile picture.');
  }
}

async function removeBanner() {

  if (!confirm('Remove your canteen banner?')) {
    return;
  }

  setBannerPreview('');

  try {

    await db.collection('canteens').doc(currentUid).update({
      bannerUrl: '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('Banner removed.');

  } catch (err) {

    console.error(err);

    showToast('Could not remove the banner.');
  }
}

async function handleAvatarUpload(event) {

  const file =
    event.target.files &&
    event.target.files[0];

  if (!file) return;

  const isImage =
    file.type === 'image/png' ||
    file.type === 'image/jpeg';

  if (!isImage) {
    showToast('Only PNG or JPG images are accepted.');
    event.target.value = '';
    return;
  }

  const maxSizeBytes = 5 * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    showToast('Image is too large. Maximum size is 5MB.');
    event.target.value = '';
    return;
  }

  resizeImageFile(
    file,
    500,
    async (dataUrl) => {

      setAvatarPreview(dataUrl);

      try {

        await db.collection('canteens').doc(currentUid).update({
          logoUrl: dataUrl,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Profile picture updated.');

      } catch (err) {

        console.error(err);

        showToast('Could not save the profile picture.');
      }
    },
    () => {
      showToast('Could not process this image. Try a different file.');
    }
  );

  event.target.value = '';
}

async function handleBannerUpload(event) {

  const file =
    event.target.files &&
    event.target.files[0];

  if (!file) return;

  const isImage =
    file.type === 'image/png' ||
    file.type === 'image/jpeg';

  if (!isImage) {
    showToast('Only PNG or JPG images are accepted.');
    event.target.value = '';
    return;
  }

  const maxSizeBytes = 5 * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    showToast('Image is too large. Maximum size is 5MB.');
    event.target.value = '';
    return;
  }

  resizeImageFile(
    file,
    800,
    async (dataUrl) => {

      setBannerPreview(dataUrl);

      try {

        await db.collection('canteens').doc(currentUid).update({
          bannerUrl: dataUrl,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Banner updated.');

      } catch (err) {

        console.error(err);

        showToast('Could not save the banner.');
      }
    },
    () => {
      showToast('Could not process this image. Try a different file.');
    }
  );

  event.target.value = '';
}

// Shared helper: reads an image file, downsizes it to fit within
// maxDimension (keeping aspect ratio), and hands back a compressed
// JPEG data URL — same approach already used for food item images,
// so everything stays well under Firestore's per-document size limit.
function resizeImageFile(file, maxDimension, onDone, onError) {

  const reader = new FileReader();

  reader.onload = () => {

    const img = new Image();

    img.onload = () => {

      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {

        if (width > height) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        } else {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      onDone(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = onError;

    img.src = reader.result;
  };

  reader.onerror = onError;

  reader.readAsDataURL(file);
}


/* ============ OPERATING HOURS ============ */

function renderOperatingHours(hours) {

  const wrap = document.getElementById('hours-list');

  if (!wrap) return;

  wrap.innerHTML =
    WEEK_DAYS.map(([key, label]) => {

      const day = hours[key] || { enabled: false, time: '' };

      return `
        <div class="hours-row" data-day="${key}">
          <span class="hours-day">${label}</span>
          <input
            type="text"
            class="hours-time-input"
            id="hours-${key}-time"
            placeholder="e.g. 7:00 AM - 5:00 PM"
            value="${escapeHtml(day.time || '')}"
          >
          <button
            type="button"
            class="hours-toggle-pill ${day.enabled ? 'open' : 'closed'}"
            id="hours-${key}-toggle"
            onclick="toggleDayOpen('${key}')"
          >${day.enabled ? 'Open' : 'Closed'}</button>
        </div>
      `;

    }).join('');
}

function toggleDayOpen(key) {

  const btn = document.getElementById(`hours-${key}-toggle`);

  if (!btn) return;

  const nowOpen = btn.classList.contains('closed');

  btn.classList.toggle('open', nowOpen);
  btn.classList.toggle('closed', !nowOpen);

  btn.textContent = nowOpen ? 'Open' : 'Closed';
}

function collectOperatingHours() {

  const hours = {};

  WEEK_DAYS.forEach(([key]) => {

    const timeInput = document.getElementById(`hours-${key}-time`);
    const toggleBtn = document.getElementById(`hours-${key}-toggle`);

    hours[key] = {
      enabled: !!(toggleBtn && toggleBtn.classList.contains('open')),
      time: timeInput ? timeInput.value.trim() : ''
    };
  });

  return hours;
}


/* ============ STATUS TOGGLE ============ */

async function onStatusToggle(checkbox) {

  const newStatus =
    checkbox.checked ? 'open' : 'closed';


  document.getElementById(
    'profile-status-label'
  ).textContent =
    checkbox.checked ? 'Open' : 'Closed';


  try {

    await db
      .collection('canteens')
      .doc(currentUid)
      .update({

        status: newStatus,

        updatedAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });


    updateStatusPill(checkbox.checked);


    showToast(
      checkbox.checked
        ? 'Your canteen is now open.'
        : 'Your canteen is now closed.'
    );

  } catch (err) {

    console.error(err);

    checkbox.checked =
      !checkbox.checked;

    showToast(
      'Could not update the status.'
    );
  }
}


/* ============ SAVE PROFILE ============ */

async function saveProfile(event) {

  event.preventDefault();


  const errorEl =
    document.getElementById('profile-error');


  clearFormError(errorEl);


  const name =
    document
      .getElementById('profile-name')
      .value
      .trim();


  if (!name) {

    showFormError(
      errorEl,
      'Canteen name is required.'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    btn,
    'Sine-save...'
  );


  try {

    await db
      .collection('canteens')
      .doc(currentUid)
      .update({

        name: name,

        ownerName:
          document
            .getElementById('profile-owner')
            .value
            .trim(),

        contact:
          document
            .getElementById('profile-contact')
            .value
            .trim(),

        description:
          document
            .getElementById('profile-description')
            .value
            .trim(),

        location:
          document
            .getElementById('profile-location')
            .value
            .trim(),

        canteenType:
          document
            .getElementById('profile-type')
            .value,

        serviceType:
          document
            .getElementById('profile-service')
            .value,

        establishedSince:
          document
            .getElementById('profile-established')
            .value,

        operatingHours:
          collectOperatingHours(),

        updatedAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });


    document.getElementById(
      'topbar-sub'
    ).textContent = name;


    showToast(
      'Canteen profile saved!'
    );

  } catch (err) {

    console.error(err);

    showFormError(
      errorEl,
      'Could not save the profile. Please try again.'
    );

  } finally {

    resetButtonLoading(
      btn,
      'Save Changes'
    );
  }


  return false;
}


/* ============ MENU MANAGEMENT ============ */

function listenToMenuItems(uid) {

  if (menuUnsub) {
    menuUnsub();
  }


  menuUnsub =
    db
      .collection('menuItems')
      .where('canteenId', '==', uid)
      .onSnapshot(

        (snap) => {

          menuItems =
            snap.docs.map(d => ({
              id: d.id,
              ...d.data()
            }));


          renderCategoryOptions();

          renderMenuTable();

          renderStats();
        },

        (err) => {

          console.error(err);

          showToast(
            'Could not load menu items.'
          );
        }
      );
}


/* ============ ORDERS (real-time, from students' checkout) ============ */

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];

// pending -> preparing -> ready -> completed
// (we skip "confirmed" on purpose: Firestore rules only let a student
//  cancel while the order is pending or preparing)
const NEXT_STATUS = {
  pending:   { to: 'preparing', label: 'Accept & Prepare' },
  confirmed: { to: 'preparing', label: 'Start Preparing' },
  preparing: { to: 'ready',     label: 'Mark Ready' },
  ready:     { to: 'completed', label: 'Mark Completed' }
};

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

function pesos(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function orderMillis(ts) {
  // a just-written server timestamp is still null locally, so treat it as "now"
  return ts && ts.toMillis ? ts.toMillis() : Date.now();
}

function orderDateText(ts) {
  const d = new Date(orderMillis(ts));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' • ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isToday(ms) {
  return new Date(ms).toDateString() === new Date().toDateString();
}

function listenToOrders(uid) {

  if (ordersUnsub) ordersUnsub();

  // Single-field query on purpose, so no composite index is needed.
  // Sorting is done here in the browser.
  ordersUnsub = db
    .collection('orders')
    .where('canteenId', '==', uid)
    .onSnapshot(
      (snap) => {
        if (ordersLoaded) {
          snap.docChanges().forEach(ch => {
            if (ch.type === 'added' && ch.doc.data().status === 'pending' && !ch.doc.metadata.hasPendingWrites) {
              showToast('New order received!');
            }
          });
        }
        ordersLoaded = true;

        orders = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => orderMillis(b.createdAt) - orderMillis(a.createdAt));

        renderOrders();
        renderOrderStats();
        renderRecentOrders();
        renderReports();
        renderNotifications();
      },
      (err) => {
        console.error(err);
        showToast('Could not load orders.');
      }
    );
}

function orderCardHtml(o, withActions) {

  const items = (o.items || []).map(i => `
    <li>
      <span class="ord-qty">${Number(i.qty || 0)}×</span>
      <span class="ord-name">${escapeHtml(i.name || 'Item')}</span>
      <span class="ord-line">${pesos(Number(i.price || 0) * Number(i.qty || 0))}</span>
    </li>`).join('');

  const next = NEXT_STATUS[o.status];
  const canCancel = ACTIVE_STATUSES.includes(o.status);

  const actions = withActions && (next || canCancel) ? `
    <div class="ord-actions">
      ${next ? `<button type="button" class="btn btn-green btn-sm" onclick="updateOrderStatus('${o.id}', '${next.to}')">${next.label}</button>` : ''}
      ${canCancel ? `<button type="button" class="btn btn-danger btn-sm" onclick="cancelOrder('${o.id}')">Cancel</button>` : ''}
    </div>` : '';

  return `
    <article class="ord-card">
      <div class="ord-head">
        <div>
          <strong>#${escapeHtml(o.id.slice(0, 6).toUpperCase())}</strong>
          <span class="ord-student">${escapeHtml(o.studentName || 'Student')}</span>
        </div>
        <span class="ord-badge ${escapeHtml(o.status || 'pending')}">${escapeHtml(STATUS_LABELS[o.status] || o.status || 'Pending')}</span>
      </div>
      <ul class="ord-items">${items}</ul>
      <div class="ord-foot">
        <span class="ord-time">${escapeHtml(orderDateText(o.createdAt))}</span>
        <span class="ord-total">Total: <b>${pesos(o.total)}</b></span>
      </div>
      ${actions}
    </article>`;
}

function renderOrders() {

  const active = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  const past = orders.filter(o => !ACTIVE_STATUSES.includes(o.status));

  const listEl = document.getElementById('orders-list');
  if (listEl) {
    listEl.innerHTML = active.length
      ? `<div class="ord-grid">${active.map(o => orderCardHtml(o, true)).join('')}</div>`
      : '<div class="empty-state"><svg><use href="#i-inbox"></use></svg>No active orders yet.</div>';
  }

  const histEl = document.getElementById('history-list');
  if (histEl) {
    histEl.innerHTML = past.length
      ? `<div class="ord-grid">${past.map(o => orderCardHtml(o, false)).join('')}</div>`
      : '<div class="empty-state"><svg><use href="#i-inbox"></use></svg>No order history yet.</div>';
  }

  const activeCount = document.getElementById('orders-active-count');
  if (activeCount) activeCount.textContent = `${active.length} active`;

  const histCount = document.getElementById('history-count');
  if (histCount) histCount.textContent = `${past.length} order${past.length === 1 ? '' : 's'}`;

  // small badge on the sidebar for orders waiting to be accepted
  const pending = orders.filter(o => o.status === 'pending').length;
  const badge = document.getElementById('nav-orders-count');
  if (badge) {
    badge.textContent = pending;
    badge.style.display = pending ? 'inline-flex' : 'none';
  }
}

function renderOrderStats() {

  const setStat = (id, value) => {
    const el = document.querySelector(`#${id} .stat-card-value`);
    if (el) el.textContent = value;
  };

  const todays = orders.filter(o => isToday(orderMillis(o.createdAt)));
  const completedToday = orders.filter(o => o.status === 'completed' && isToday(orderMillis(o.updatedAt)));

  setStat('stat-today', todays.length);
  setStat('stat-pending', orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length);
  setStat('stat-preparing', orders.filter(o => o.status === 'preparing').length);
  setStat('stat-ready', orders.filter(o => o.status === 'ready').length);
  setStat('stat-completed', completedToday.length);
  setStat('stat-sales', pesos(completedToday.reduce((sum, o) => sum + Number(o.total || 0), 0)));
}

function renderRecentOrders() {

  const el = document.getElementById('recent-orders');
  if (!el) return;

  const recent = orders.slice(0, 5);

  el.innerHTML = recent.length
    ? `<div class="ord-grid">${recent.map(o => orderCardHtml(o, false)).join('')}</div>`
    : '<div class="empty-state"><svg><use href="#i-inbox"></use></svg>No orders yet.</div>';
}

async function updateOrderStatus(orderId, status, extra) {

  try {
    await db.collection('orders').doc(orderId).update({
      status,
      ...(extra || {}),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Order marked as ${STATUS_LABELS[status] || status}.`);
  } catch (err) {
    console.error(err);
    showToast('Could not update the order. Please try again.');
  }
}

async function cancelOrder(orderId) {

  if (!confirm('Cancel this order?')) return;

  await updateOrderStatus(orderId, 'cancelled', { cancelledBy: 'canteen' });
}


/* ============ SALES & REPORTS (built from the orders above) ============ */

function setReportRange(value) {
  reportRange = value;
  renderReports();
}

function localDayKey(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function reportStart() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 24 * 60 * 60 * 1000;
  if (reportRange === 'today') return today;
  if (reportRange === '7d') return today - 6 * DAY;
  if (reportRange === '30d') return today - 29 * DAY;
  return 0;
}

function reportBuckets(completed, start) {

  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;
  const buckets = [];

  if (reportRange === 'today') {
    for (let h = 0; h < 24; h++) {
      const label = (h % 3 === 0) ? ((h % 12 || 12) + (h < 12 ? 'a' : 'p')) : '';
      buckets.push({ key: h, label, title: (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'), value: 0 });
    }
    completed.forEach(o => { buckets[new Date(orderMillis(o.updatedAt)).getHours()].value += Number(o.total || 0); });
    return { buckets, heading: 'Sales by hour (today)' };
  }

  if (reportRange === '7d' || reportRange === '30d') {
    const days = reportRange === '7d' ? 7 : 30;
    const map = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start + i * DAY);
      const b = {
        key: localDayKey(d.getTime()),
        label: (days === 7 || i % 5 === 0 || i === days - 1)
          ? (days === 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
          : '',
        title: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: 0
      };
      map[b.key] = b;
      buckets.push(b);
    }
    completed.forEach(o => {
      const b = map[localDayKey(orderMillis(o.updatedAt))];
      if (b) b.value += Number(o.total || 0);
    });
    return { buckets, heading: `Daily sales (last ${days} days)` };
  }

  // all time -> last 12 months
  const map = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const b = {
      key,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      title: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      value: 0
    };
    map[key] = b;
    buckets.push(b);
  }
  completed.forEach(o => {
    const d = new Date(orderMillis(o.updatedAt));
    const b = map[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')];
    if (b) b.value += Number(o.total || 0);
  });
  return { buckets, heading: 'Monthly sales (last 12 months)' };
}

function renderReports() {

  const chartEl = document.getElementById('rep-chart');
  if (!chartEl) return;

  const start = reportStart();
  const completed = orders.filter(o => o.status === 'completed' && orderMillis(o.updatedAt) >= start);
  const cancelled = orders.filter(o => o.status === 'cancelled' && orderMillis(o.updatedAt) >= start);
  const placed = orders.filter(o => orderMillis(o.createdAt) >= start);

  const total = completed.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const avg = completed.length ? total / completed.length : 0;

  const setStat = (id, value) => {
    const el = document.querySelector(`#${id} .stat-card-value`);
    if (el) el.textContent = value;
  };
  setStat('rep-sales', pesos(total));
  setStat('rep-completed', completed.length);
  setStat('rep-avg', pesos(avg));
  setStat('rep-cancelled', cancelled.length);

  // ---- chart ----
  const { buckets, heading } = reportBuckets(completed, start);
  document.getElementById('rep-chart-title').textContent = heading;

  const max = Math.max(...buckets.map(b => b.value), 0);
  if (max === 0) {
    chartEl.innerHTML = '<div class="empty-state"><svg><use href="#i-chart"></use></svg>No sales in this period yet.</div>';
  } else {
    chartEl.innerHTML = `<div class="rep-chart">${buckets.map(b => `
      <div class="rep-col" title="${escapeHtml(b.title)}: ${pesos(b.value)}">
        <div class="rep-bar-wrap"><div class="rep-bar" style="height:${Math.max(b.value / max * 100, b.value ? 3 : 0)}%"></div></div>
        <span class="rep-label">${escapeHtml(b.label)}</span>
      </div>`).join('')}</div>`;
  }

  // ---- top selling items ----
  const tally = {};
  completed.forEach(o => (o.items || []).forEach(i => {
    const key = i.menuItemId || i.name;
    if (!tally[key]) tally[key] = { name: i.name || 'Item', qty: 0, revenue: 0 };
    tally[key].qty += Number(i.qty || 0);
    tally[key].revenue += Number(i.qty || 0) * Number(i.price || 0);
  }));
  const top = Object.values(tally).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const topEl = document.getElementById('rep-top-items');
  topEl.innerHTML = top.length
    ? top.map((t, idx) => `
      <div class="rep-row">
        <div class="rep-row-head"><span>${idx + 1}. ${escapeHtml(t.name)}</span><b>${t.qty} sold</b></div>
        <div class="rep-meter"><span style="width:${t.qty / top[0].qty * 100}%"></span></div>
        <small>${pesos(t.revenue)}</small>
      </div>`).join('')
    : '<div class="empty-state"><svg><use href="#i-food"></use></svg>No items sold yet.</div>';

  // ---- orders by status ----
  const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
  const counts = statuses.map(st => ({ st, n: placed.filter(o => o.status === st).length })).filter(x => x.n > 0);
  const statusEl = document.getElementById('rep-status');
  statusEl.innerHTML = counts.length
    ? counts.map(x => `
      <div class="rep-row">
        <div class="rep-row-head"><span>${escapeHtml(STATUS_LABELS[x.st])}</span><b>${x.n}</b></div>
        <div class="rep-meter ${x.st}"><span style="width:${x.n / placed.length * 100}%"></span></div>
      </div>`).join('')
    : '<div class="empty-state"><svg><use href="#i-inbox"></use></svg>No orders in this period yet.</div>';
}

function exportSalesCsv() {

  const start = reportStart();
  const rows = orders.filter(o => o.status === 'completed' && orderMillis(o.updatedAt) >= start);

  if (rows.length === 0) { showToast('There are no completed orders to export.'); return; }

  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [['Order ID', 'Completed', 'Student', 'Items', 'Total'].map(q).join(',')];

  rows.forEach(o => {
    const items = (o.items || []).map(i => `${i.qty}x ${i.name}`).join('; ');
    lines.push([o.id, new Date(orderMillis(o.updatedAt)).toLocaleString('en-US'), o.studentName || 'Student', items, Number(o.total || 0).toFixed(2)].map(q).join(','));
  });

  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sales-${localDayKey(Date.now())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}


/* ============ STUDENT SUGGESTIONS (students' "Share Your Suggestion") ============ */

const SUGGESTION_ACTIONS = [
  { to: 'reviewed', label: 'Mark Reviewed' },
  { to: 'accepted', label: 'Accept' },
  { to: 'rejected', label: 'Reject' }
];

function listenToSuggestions(uid) {

  if (suggestionsUnsub) suggestionsUnsub();

  suggestionsUnsub = db
    .collection('suggestions')
    .where('canteenId', '==', uid)
    .onSnapshot(
      (snap) => {
        suggestions = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => orderMillis(b.createdAt) - orderMillis(a.createdAt));

        renderSuggestions();
        renderNotifications();
      },
      (err) => {
        console.error(err);
        showToast('Could not load suggestions.');
      }
    );
}

function setSuggestionFilter(value) {
  suggestionFilter = value;
  document.querySelectorAll('#sugg-filters .sugg-filter').forEach(b => {
    b.classList.toggle('active', b.dataset.sugg === value);
  });
  renderSuggestions();
}

function timeAgoText(ms) {
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderSuggestions() {

  const listEl = document.getElementById('suggestions-list');
  if (!listEl) return;

  const shown = suggestionFilter === 'all'
    ? suggestions
    : suggestions.filter(s => (s.status || 'pending') === suggestionFilter);

  const countEl = document.getElementById('sugg-count');
  if (countEl) countEl.textContent = `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`;

  listEl.innerHTML = shown.length
    ? `<div class="sugg-list">${shown.map(s => {
        const status = s.status || 'pending';
        const buttons = SUGGESTION_ACTIONS
          .filter(a => a.to !== status)
          .map(a => `<button type="button" class="btn btn-sm ${a.to === 'accepted' ? 'btn-green' : (a.to === 'rejected' ? 'btn-danger' : 'btn-ghost')}" onclick="updateSuggestionStatus('${s.id}', '${a.to}')">${a.label}</button>`)
          .join('');
        return `
          <article class="sugg-card">
            <div class="ord-head">
              <div>
                <strong>${escapeHtml(s.studentName || 'Student')}</strong>
                <span class="ord-student">${escapeHtml(timeAgoText(orderMillis(s.createdAt)))}</span>
              </div>
              <span class="ord-badge sugg-${escapeHtml(status)}">${escapeHtml(status.charAt(0).toUpperCase() + status.slice(1))}</span>
            </div>
            <p class="sugg-msg">${escapeHtml(s.message || '')}</p>
            <div class="ord-actions">${buttons}</div>
          </article>`;
      }).join('')}</div>`
    : `<div class="empty-state"><svg><use href="#i-inbox"></use></svg>${suggestions.length ? 'No suggestions match this filter.' : 'No suggestions yet.'}</div>`;

  const pending = suggestions.filter(s => (s.status || 'pending') === 'pending').length;
  const badge = document.getElementById('nav-suggestions-count');
  if (badge) {
    badge.textContent = pending;
    badge.style.display = pending ? 'inline-flex' : 'none';
  }
}

async function updateSuggestionStatus(id, status) {

  try {
    await db.collection('suggestions').doc(id).update({
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(`Suggestion marked as ${status}.`);
  } catch (err) {
    console.error(err);
    showToast('Could not update the suggestion. Please try again.');
  }
}


/* ============ NOTIFICATIONS (built from orders + suggestions) ============ */
/* No extra Firestore rules needed: the feed is computed from data the canteen
   can already read. "Read" state is remembered in this browser only. */

function notifSeenKey() { return 'canteenNotifSeen:' + currentUid; }

function getNotifSeen() {
  try { return Number(localStorage.getItem(notifSeenKey())) || 0; } catch (e) { return 0; }
}

function buildNotifications() {

  const list = [];

  orders.forEach(o => {
    const code = '#' + o.id.slice(0, 6).toUpperCase();
    const name = o.studentName || 'A student';
    const qty = (o.items || []).reduce((sum, i) => sum + Number(i.qty || 0), 0);

    list.push({
      ts: orderMillis(o.createdAt), kind: 'order', view: 'orders-view',
      title: `New order ${code}`,
      text: `${name} ordered ${qty} item${qty === 1 ? '' : 's'} (${pesos(o.total)}).`
    });

    if (o.status === 'cancelled' && o.cancelledBy !== 'canteen') {
      list.push({
        ts: orderMillis(o.updatedAt), kind: 'cancel', view: 'history-view',
        title: `Order ${code} cancelled`,
        text: `${name} cancelled this order.`
      });
    }
  });

  suggestions.forEach(s => {
    list.push({
      ts: orderMillis(s.createdAt), kind: 'suggestion', view: 'suggestions-view',
      title: 'New student suggestion',
      text: `${s.studentName || 'A student'}: ${(s.message || '').slice(0, 90)}${(s.message || '').length > 90 ? '…' : ''}`
    });
  });

  return list.sort((a, b) => b.ts - a.ts).slice(0, 50);
}

function renderNotifications() {

  const listEl = document.getElementById('notif-list');
  if (!listEl) return;

  const feed = buildNotifications();
  const seen = getNotifSeen();
  const unread = feed.filter(n => n.ts > seen).length;

  const icons = { order: 'i-package', cancel: 'i-x', suggestion: 'i-bulb' };

  listEl.innerHTML = feed.length
    ? `<ul class="notif-feed">${feed.map(n => `
        <li class="notif-item ${n.ts > seen ? 'unread' : ''}" onclick="openNotification('${n.view}')">
          <span class="notif-icon ${n.kind}"><svg><use href="#${icons[n.kind]}"></use></svg></span>
          <span class="notif-body">
            <strong>${escapeHtml(n.title)}</strong>
            <span>${escapeHtml(n.text)}</span>
          </span>
          <span class="notif-time">${escapeHtml(timeAgoText(n.ts))}</span>
        </li>`).join('')}</ul>`
    : '<div class="empty-state"><svg><use href="#i-bell"></use></svg>No notifications yet.</div>';

  const badge = document.getElementById('nav-notif-count');
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread ? 'inline-flex' : 'none';
  }
}

function markNotificationsRead() {
  try { localStorage.setItem(notifSeenKey(), String(Date.now())); } catch (e) { /* private mode: ignore */ }
  renderNotifications();
}

function openNotification(viewId) {
  showView(viewId, document.querySelector(`[data-view="${viewId}"]`));
}


/* ============ CATEGORY FILTER (dropdown) ============ */

function renderCategoryOptions() {

  const select =
    document.getElementById('menu-cat-filter');

  if (!select) return;


  const cats =
    Array.from(
      new Set(
        menuItems
          .map(i => i.category)
          .filter(Boolean)
      )
    );


  const previousValue = select.value || 'all';


  select.innerHTML =
    '<option value="all">All Categories</option>' +
    cats.map(cat =>
      `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
    ).join('');


  if (cats.includes(previousValue) || previousValue === 'all') {
    select.value = previousValue;
  } else {
    select.value = 'all';
    activeCategory = 'all';
  }
}


/* ============ SET MENU FILTER / SEARCH ============ */

function setMenuFilter(cat) {

  activeCategory = cat;

  renderMenuTable();
}

function setMenuSearch(value) {

  searchQuery = value.trim().toLowerCase();

  renderMenuTable();
}


/* ============ RENDER MENU TABLE ============ */

function renderMenuTable() {

  const tbody =
    document.getElementById(
      'menu-table-body'
    );


  const emptyEl =
    document.getElementById(
      'menu-empty'
    );


  if (menuItems.length === 0) {

    tbody.innerHTML = '';

    emptyEl.style.display =
      'block';

    return;
  }


  const list =
    menuItems.filter(item => {

      const matchesCategory =
        activeCategory === 'all' ||
        item.category === activeCategory;

      const matchesSearch =
        !searchQuery ||
        (item.name || '')
          .toLowerCase()
          .includes(searchQuery);

      return matchesCategory && matchesSearch;
    });


  if (list.length === 0) {

    tbody.innerHTML = '';

    emptyEl.style.display = 'block';

    return;
  }


  emptyEl.style.display =
    'none';


  tbody.innerHTML =
    list.map(item => {

      const stock =
        Number(item.stock || 0);


      const isOut =
        stock <= 0;


      const isLow =
        !isOut &&
        stock <= LOW_STOCK_THRESHOLD;


      const available =
        item.available !== false &&
        !isOut;


      const stockClass =
        isOut
          ? 'out'
          : (isLow ? 'low' : '');


      const statusClass =
        isOut
          ? 'closed'
          : (available ? 'open' : 'neutral');


      const statusText =
        isOut
          ? 'Out of Stock'
          : (available ? 'Available' : 'Unavailable');


      const imgCell =
        item.imageUrl
          ? `<div class="menu-thumb" style="background-image:url('${escapeHtml(item.imageUrl)}')"></div>`
          : `<div class="menu-thumb"><svg><use href="#i-image"></use></svg></div>`;


      return `

        <tr>

          <td>${imgCell}</td>

          <td>
            <div class="menu-table-name">${escapeHtml(item.name || '')}</div>
            <div class="menu-table-desc">${escapeHtml(item.description || '')}</div>
          </td>

          <td><span class="item-card-cat">${escapeHtml(item.category || 'Others')}</span></td>

          <td class="menu-table-price">₱${Number(item.price || 0).toFixed(2)}</td>

          <td class="${stockClass ? 'item-card-stock ' + stockClass : ''}">${stock}</td>

          <td>
            <button
              type="button"
              class="status-pill ${statusClass} status-pill-btn"
              ${isOut ? 'disabled' : ''}
              onclick="toggleAvailability('${item.id}', ${!available})"
              title="${isOut ? 'Out of stock' : 'Click to toggle availability'}"
            >${statusText}</button>
          </td>

          <td>
            <div class="item-card-actions">

              <button
                class="icon-btn"
                title="View"
                onclick='openFoodModal(${JSON.stringify(item).replace(/'/g, "&apos;")}, "view")'
              >
                <svg><use href="#i-eye"></use></svg>
              </button>

              <button
                class="icon-btn"
                title="Edit"
                onclick='openFoodModal(${JSON.stringify(item).replace(/'/g, "&apos;")}, "edit")'
              >
                <svg><use href="#i-edit"></use></svg>
              </button>

              <button
                class="icon-btn danger"
                title="Delete"
                onclick="deleteFood('${item.id}', '${escapeHtml(item.name || 'item').replace(/'/g, "\\'")}')"
              >
                <svg><use href="#i-trash"></use></svg>
              </button>

            </div>
          </td>

        </tr>

      `;

    }).join('');
}


/* ============ STATS ============ */

function renderStats() {

  const activeCount =
    menuItems.filter(
      i =>
        i.available !== false &&
        Number(i.stock || 0) > 0
    ).length;


  const lowOrUnavailable =
    menuItems.filter(i => {

      const stock =
        Number(i.stock || 0);


      return (
        stock <= LOW_STOCK_THRESHOLD ||
        i.available === false
      );

    }).length;


  document
    .querySelector(
      '#stat-active-items .stat-card-value'
    )
    .textContent =
    activeCount;


  document
    .querySelector(
      '#stat-low-stock .stat-card-value'
    )
    .textContent =
    lowOrUnavailable;
}


/* ============ TOGGLE AVAILABILITY ============ */

async function toggleAvailability(
  itemId,
  checked
) {

  try {

    await db
      .collection('menuItems')
      .doc(itemId)
      .update({

        available: checked,

        updatedAt:
          firebase.firestore.FieldValue.serverTimestamp()
      });

  } catch (err) {

    console.error(err);

    showToast(
      'Could not update availability.'
    );
  }
}


/* ============ ADD / EDIT FOOD PANEL ============ */

function updateFoodImgPreview() {

  const url =
    document.getElementById('food-image').value.trim();

  const preview =
    document.getElementById('food-img-preview');

  if (!preview) return;

  if (url) {

    preview.style.backgroundImage = `url('${escapeHtml(url)}')`;

    preview.classList.add('has-image');

  } else {

    preview.style.backgroundImage = '';

    preview.classList.remove('has-image');
  }
}


/* ============ HANDLE FOOD IMAGE UPLOAD ============ */

function handleFoodImageUpload(event) {

  const file =
    event.target.files &&
    event.target.files[0];

  if (!file) return;

  const errorEl =
    document.getElementById('food-error');

  clearFormError(errorEl);

  const isImage =
    file.type === 'image/png' ||
    file.type === 'image/jpeg';

  if (!isImage) {

    showFormError(
      errorEl,
      'Only PNG or JPG images are accepted.'
    );

    event.target.value = '';

    return;
  }

  const maxSizeBytes = 5 * 1024 * 1024;

  if (file.size > maxSizeBytes) {

    showFormError(
      errorEl,
      'Image is too large. Maximum size is 5MB.'
    );

    event.target.value = '';

    return;
  }

  const reader = new FileReader();

  reader.onload = () => {

    const img = new Image();

    img.onload = () => {

      // Resize/compress so the image fits comfortably
      // inside a Firestore document as a data URL.
      const maxDimension = 800;

      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {

        if (width > height) {

          height =
            Math.round(height * (maxDimension / width));

          width = maxDimension;

        } else {

          width =
            Math.round(width * (maxDimension / height));

          height = maxDimension;
        }
      }

      const canvas =
        document.createElement('canvas');

      canvas.width = width;
      canvas.height = height;

      canvas
        .getContext('2d')
        .drawImage(img, 0, 0, width, height);

      const dataUrl =
        canvas.toDataURL('image/jpeg', 0.8);

      document
        .getElementById('food-image')
        .value = dataUrl;

      updateFoodImgPreview();
    };

    img.onerror = () => {

      showFormError(
        errorEl,
        'Could not process this image. Try a different file.'
      );
    };

    img.src = reader.result;
  };

  reader.onerror = () => {

    showFormError(
      errorEl,
      'Could not upload the image. Please try again.'
    );
  };

  reader.readAsDataURL(file);
}

function setFoodFormMode(mode) {

  const isView = mode === 'view';

  const fieldIds = [
    'food-name',
    'food-category',
    'food-price',
    'food-description',
    'food-stock',
    'food-available'
  ];

  fieldIds.forEach(id => {

    const el = document.getElementById(id);

    if (el) el.disabled = isView;
  });

  const fileInput =
    document.getElementById('food-image-file');

  if (fileInput) fileInput.disabled = isView;

  const preview =
    document.getElementById('food-img-preview');

  if (preview) {

    preview.classList.toggle('view-mode', isView);

    preview.style.cursor =
      isView ? 'default' : 'pointer';
  }

  const submitBtn =
    document.getElementById('food-submit-btn');

  const closeBtn =
    document.getElementById('food-close-btn');

  if (submitBtn) {
    submitBtn.style.display =
      isView ? 'none' : '';
  }

  if (closeBtn) {
    closeBtn.style.display =
      isView ? '' : 'none';
  }
}

function openFoodModal(item, mode) {

  const errorEl =
    document.getElementById(
      'food-error'
    );


  clearFormError(errorEl);


  document
    .getElementById('food-form')
    .reset();


  document
    .getElementById('food-available')
    .checked = true;


  document
    .getElementById('food-image')
    .value = '';


  const resolvedMode =
    mode ||
    (item && item.id ? 'edit' : 'add');


  if (item && item.id) {

    document
      .getElementById(
        'food-modal-title'
      )
      .textContent =
      resolvedMode === 'view'
        ? 'Food Item Details'
        : 'Edit Food Item';


    document
      .getElementById(
        'food-modal-subtitle'
      )
      .textContent =
      resolvedMode === 'view'
        ? 'Details of this food item.'
        : 'Update the details of this food item.';


    document
      .getElementById('food-id')
      .value =
      item.id;


    document
      .getElementById('food-name')
      .value =
      item.name || '';


    document
      .getElementById(
        'food-description'
      )
      .value =
      item.description || '';


    document
      .getElementById('food-price')
      .value =
      item.price || 0;


    document
      .getElementById('food-category')
      .value =
      item.category || 'Others';


    document
      .getElementById('food-stock')
      .value =
      item.stock || 0;


    document
      .getElementById('food-image')
      .value =
      item.imageUrl || '';


    document
      .getElementById('food-available')
      .checked =
      item.available !== false;

  } else {

    document
      .getElementById(
        'food-modal-title'
      )
      .textContent =
      'Add Food Item';


    document
      .getElementById(
        'food-modal-subtitle'
      )
      .textContent =
      'Enter the details of the food item to add to your menu.';


    document
      .getElementById('food-id')
      .value = '';
  }


  setFoodFormMode(resolvedMode);

  updateFoodImgPreview();


  document
    .getElementById('food-modal-overlay')
    ?.classList.add('active');
}


/* ============ CLOSE FOOD MODAL ============ */

function closeFoodModal() {

  document
    .getElementById('food-modal-overlay')
    ?.classList.remove('active');


  document
    .getElementById('food-form')
    .reset();


  document
    .getElementById('food-image')
    .value = '';


  updateFoodImgPreview();
}


/* ============ SAVE FOOD ============ */

async function saveFood(event) {

  event.preventDefault();


  if (document.getElementById('food-name').disabled) {

    // Form is in read-only "view" mode — nothing to save.
    return false;
  }


  const errorEl =
    document.getElementById(
      'food-error'
    );


  clearFormError(errorEl);


  const id =
    document.getElementById(
      'food-id'
    ).value;


  const name =
    document
      .getElementById('food-name')
      .value
      .trim();


  const description =
    document
      .getElementById(
        'food-description'
      )
      .value
      .trim();


  const price =
    parseFloat(
      document.getElementById(
        'food-price'
      ).value
    );


  const category =
    document.getElementById(
      'food-category'
    ).value;


  const stock =
    parseInt(
      document.getElementById(
        'food-stock'
      ).value,
      10
    );


  const imageUrl =
    document
      .getElementById(
        'food-image'
      )
      .value
      .trim();


  let available =
    document.getElementById(
      'food-available'
    ).checked;


  if (
    !name ||
    isNaN(price) ||
    price < 0 ||
    isNaN(stock) ||
    stock < 0
  ) {

    showFormError(
      errorEl,
      'Please complete the name, price and stock (values must not be negative).'
    );

    return false;
  }


  if (stock <= 0) {
    available = false;
  }


  const payload = {

    canteenId:
      currentUid,

    name,

    description,

    price,

    category,

    stock,

    imageUrl,

    available,

    updatedAt:
      firebase.firestore.FieldValue.serverTimestamp()
  };


  // Close the modal and confirm right away instead of waiting for
  // the Firestore round-trip — Firestore applies the write to its
  // local cache immediately, so the table already updates instantly
  // via the onSnapshot listener. The actual sync to the server just
  // keeps going quietly in the background.
  closeFoodModal();


  if (id) {

    showToast(
      'Food item updated!'
    );

    db
      .collection('menuItems')
      .doc(id)
      .update(payload)
      .catch((err) => {

        console.error(err);

        showToast(
          'Could not sync your changes. Check your connection and try again.'
        );
      });

  } else {

    payload.createdAt =
      firebase.firestore.FieldValue.serverTimestamp();

    showToast(
      'Food item added!'
    );

    db
      .collection('menuItems')
      .add(payload)
      .catch((err) => {

        console.error(err);

        showToast(
          'Could not sync the new item. Check your connection and try again.'
        );
      });
  }


  return false;
}


/* ============ DELETE FOOD ============ */

async function deleteFood(
  itemId,
  name
) {

  if (
    !confirm(
      `Remove "${name}" from the menu? This cannot be undone.`
    )
  ) {
    return;
  }


  try {

    await db
      .collection('menuItems')
      .doc(itemId)
      .delete();


    showToast(
      'Food item removed.'
    );

  } catch (err) {

    console.error(err);

    showToast(
      'Could not delete the food item.'
    );
  }
}


/* ============ SHARED UI HELPERS ============ */

function showFormError(
  el,
  message
) {

  if (!el) return;


  el.textContent =
    message;


  el.classList.add(
    'show'
  );
}


function clearFormError(el) {

  if (!el) return;


  el.classList.remove(
    'show'
  );


  el.textContent =
    '';
}


function setButtonLoading(
  btn,
  text
) {

  if (!btn) return;


  btn.dataset.original =
    btn.innerHTML;


  btn.classList.add(
    'is-loading'
  );


  btn.innerHTML =
    text;
}


function resetButtonLoading(
  btn,
  fallbackText
) {

  if (!btn) return;


  btn.classList.remove(
    'is-loading'
  );


  btn.innerHTML =
    btn.dataset.original ||
    fallbackText;
}


/* ============ ESCAPE HTML ============ */

function escapeHtml(str) {

  return String(str)

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    );
}


/* ============ TOAST ============ */

let toastTimer = null;


function showToast(message) {

  const toast =
    document.getElementById(
      'toast'
    );


  if (!toast) return;


  toast.textContent =
    message;


  toast.classList.add(
    'show'
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () =>
        toast.classList.remove(
          'show'
        ),
      2400
    );
}