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

      showToast('Student account ito, hindi canteen.');

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

    showToast('Na-recover ang canteen profile mo.');

  } catch (err) {

    console.error(err);

    showToast('Hindi ma-load ang canteen data.');
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
      'Buod ng iyong canteen ngayong araw.'
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

  if (!confirm('Alisin ang profile picture ng canteen mo?')) {
    return;
  }

  setAvatarPreview('');

  try {

    await db.collection('canteens').doc(currentUid).update({
      logoUrl: '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('Naalis ang profile picture.');

  } catch (err) {

    console.error(err);

    showToast('Hindi na-alis ang profile picture.');
  }
}

async function removeBanner() {

  if (!confirm('Alisin ang banner ng canteen mo?')) {
    return;
  }

  setBannerPreview('');

  try {

    await db.collection('canteens').doc(currentUid).update({
      bannerUrl: '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('Naalis ang banner.');

  } catch (err) {

    console.error(err);

    showToast('Hindi na-alis ang banner.');
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
    showToast('PNG o JPG lang ang tinatanggap na image.');
    event.target.value = '';
    return;
  }

  const maxSizeBytes = 5 * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    showToast('Masyadong malaki ang image. 5MB max lang.');
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

        showToast('Na-update ang profile picture.');

      } catch (err) {

        console.error(err);

        showToast('Hindi na-save ang profile picture.');
      }
    },
    () => {
      showToast('Hindi ma-process ang image na ito. Subukan ng ibang file.');
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
    showToast('PNG o JPG lang ang tinatanggap na image.');
    event.target.value = '';
    return;
  }

  const maxSizeBytes = 5 * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    showToast('Masyadong malaki ang image. 5MB max lang.');
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

        showToast('Na-update ang banner.');

      } catch (err) {

        console.error(err);

        showToast('Hindi na-save ang banner.');
      }
    },
    () => {
      showToast('Hindi ma-process ang image na ito. Subukan ng ibang file.');
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
        ? 'Bukas na ang canteen mo.'
        : 'Sarado na ang canteen mo.'
    );

  } catch (err) {

    console.error(err);

    checkbox.checked =
      !checkbox.checked;

    showToast(
      'Hindi na-update ang status.'
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
      'Kailangan ng pangalan ng canteen.'
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
      'Na-save ang profile ng canteen!'
    );

  } catch (err) {

    console.error(err);

    showFormError(
      errorEl,
      'Hindi na-save ang profile. Subukan ulit.'
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
            'Hindi ma-load ang menu items.'
          );
        }
      );
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
      'Hindi na-update ang availability.'
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
      'PNG o JPG lang ang tinatanggap na image.'
    );

    event.target.value = '';

    return;
  }

  const maxSizeBytes = 5 * 1024 * 1024;

  if (file.size > maxSizeBytes) {

    showFormError(
      errorEl,
      'Masyadong malaki ang image. 5MB max lang.'
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
        'Hindi ma-process ang image na ito. Subukan ng ibang file.'
      );
    };

    img.src = reader.result;
  };

  reader.onerror = () => {

    showFormError(
      errorEl,
      'Hindi ma-upload ang image. Subukan ulit.'
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
        ? 'Detalye ng food item na ito.'
        : 'I-update ang detalye ng food item na ito.';


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
      'Ilagay ang detalye ng food item na ilalagay sa iyong menu.';


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
      'Kumpletuhin ang pangalan, price, at stock (di dapat negative).'
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
      'Na-update ang food item!'
    );

    db
      .collection('menuItems')
      .doc(id)
      .update(payload)
      .catch((err) => {

        console.error(err);

        showToast(
          'Hindi na-sync ang pagbabago. Suriin ang connection at subukan ulit.'
        );
      });

  } else {

    payload.createdAt =
      firebase.firestore.FieldValue.serverTimestamp();

    showToast(
      'Naidagdag ang food item!'
    );

    db
      .collection('menuItems')
      .add(payload)
      .catch((err) => {

        console.error(err);

        showToast(
          'Hindi na-sync ang bagong item. Suriin ang connection at subukan ulit.'
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
      `Alisin ang "${name}" sa menu? Hindi na ito mababawi.`
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
      'Naalis ang food item.'
    );

  } catch (err) {

    console.error(err);

    showToast(
      'Hindi na-delete ang food item.'
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