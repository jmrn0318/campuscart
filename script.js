/* ============ FIREBASE CONFIG (accounts + login) ============ */
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


/* ============ EMAILJS CONFIG (sends the 6-digit code) ============ */
const EMAILJS_SERVICE_ID  = "service_vt6w3fa";
const EMAILJS_TEMPLATE_ID = "template_tbglht8";
const EMAILJS_PUBLIC_KEY  = "QevxOHkXwJ6uQVNxW";

emailjs.init({
  publicKey: EMAILJS_PUBLIC_KEY
});


/* ============ CONFIG ============ */
const CANTEEN_VERIFICATION_CODE = "CAMPUSCART-2026";
const CODE_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_SEC = 30;

let pendingIntent = "login";
let pendingSignup = null;


/* ============ FORGOT PASSWORD STATE ============ */
let studentForgotData = {
  email: '',
  code: '',
  expiresAt: 0,
  verified: false
};

let canteenForgotData = {
  email: '',
  code: '',
  expiresAt: 0,
  verified: false
};


/* ============ SMOOTH SCROLL + ACTIVE NAV ============ */
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    const targetId = link.getAttribute('data-target');
    const targetEl = document.getElementById(targetId);

    if (targetEl) {
      e.preventDefault();

      targetEl.scrollIntoView({
        behavior: 'smooth'
      });
    }
  });
});


/* ============ ACTIVE NAV + HEADER BACKGROUND ============ */

const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');
const header = document.querySelector('header');

const spy = new IntersectionObserver((entries) => {
  entries.forEach(entry => {

    if (!entry.isIntersecting) return;

    const sectionId = entry.target.id;

    // Active navigation
    navLinks.forEach(link => {
      link.classList.toggle(
        'active',
        link.dataset.target === sectionId
      );
    });

    // Header background
    if (sectionId === 'home') {
      header.classList.remove('light-header');
    } else {
      header.classList.add('light-header');
    }
  });
}, {
  rootMargin: '-35% 0px -55% 0px'
});

sections.forEach(section => spy.observe(section));

/* ============ REVEAL ON SCROLL ============ */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.15
});

document
  .querySelectorAll('.reveal, .reveal-up')
  .forEach(el => revealObserver.observe(el));


window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.hero .reveal-up').forEach(el => {
    requestAnimationFrame(() => {
      el.classList.add('in-view');
    });
  });
});


/* ============ ANIMATED STAT COUNTERS ============ */
const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    entry.target.querySelectorAll('.stat-num').forEach(numEl => {
      const target = parseInt(numEl.dataset.count, 10);

      let current = 0;
      const step = Math.max(1, Math.ceil(target / 40));

      const tick = () => {
        current += step;

        if (current >= target) {
          numEl.textContent = target;
          return;
        }

        numEl.textContent = current;
        requestAnimationFrame(tick);
      };

      tick();
    });

    statObserver.unobserve(entry.target);
  });
}, {
  threshold: 0.4
});

document
  .querySelectorAll('.stats')
  .forEach(el => statObserver.observe(el));


/* ============ OVERLAY HELPERS ============ */

function closeAllOverlays() {
  document
    .querySelectorAll('.overlay')
    .forEach(o => o.classList.remove('show'));

  document.body.style.overflow = '';
}


function openOverlay(id) {
  closeAllOverlays();

  const overlay = document.getElementById(id);

  if (!overlay) return;

  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}


/* ============ ROLE SELECT ============ */

function openRoleSelect(intent) {
  pendingIntent = intent;

  const title = document.getElementById('role-title');

  if (title) {
    title.textContent =
      intent === 'signup'
        ? 'Create an account'
        : 'Log in to Campus Cart';
  }

  openOverlay('role-overlay');
}


function selectRole(role) {
  if (role === 'student') {
    showAuthView(
      pendingIntent === 'signup'
        ? 'student-signup'
        : 'student-login'
    );
  } else {
    showAuthView(
      pendingIntent === 'signup'
        ? 'canteen-signup'
        : 'canteen-login'
    );
  }
}


function backToRoleSelect() {
  openRoleSelect(pendingIntent);
}


function showAuthView(viewKey) {
  const overlayId =
    viewKey.startsWith('student')
      ? 'student-overlay'
      : 'canteen-overlay';

  openOverlay(overlayId);

  document
    .querySelectorAll('#' + overlayId + ' .modal-wrap')
    .forEach(el => {
      el.style.display = 'none';
    });

  const view = document.getElementById('view-' + viewKey);

  if (view) {
    view.style.display = 'block';
  }


  if (viewKey === 'student-signup') {
    document.getElementById('student-signup-form-wrap').style.display = 'block';
    document.getElementById('student-verify-panel').style.display = 'none';
    document.getElementById('student-success-panel').style.display = 'none';

    document.getElementById('student-signup-form').reset();
  }


  if (viewKey === 'canteen-signup') {
    document.getElementById('canteen-signup-form-wrap').style.display = 'block';
    document.getElementById('canteen-verify-panel').style.display = 'none';
    document.getElementById('canteen-success').style.display = 'none';

    document.getElementById('canteen-signup-form').reset();
  }


  if (viewKey === 'student-forgot') {
    showStudentForgotEmailPanel();

    const input = document.getElementById('student-forgot-email');

    if (input) {
      input.focus();
    }
  }


  if (viewKey === 'canteen-forgot') {
    showCanteenForgotEmailPanel();

    const input = document.getElementById('canteen-forgot-email');

    if (input) {
      input.focus();
    }
  }
}


/* ============ PASSWORD VISIBILITY TOGGLE ============ */

document.querySelectorAll('.eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');

    if (!input) return;

    input.type =
      input.type === 'password'
        ? 'text'
        : 'password';
  });
});


/* ============ SHARED HELPERS ============ */

function showFormError(el, message) {
  if (!el) return;

  el.textContent = message;
  el.classList.add('show');
}


function clearFormError(el) {
  if (!el) return;

  el.classList.remove('show');
  el.textContent = '';
}


function setButtonLoading(btn, text) {
  if (!btn) return;

  btn.dataset.original = btn.innerHTML;
  btn.classList.add('is-loading');
  btn.innerHTML = text;
}


function resetButtonLoading(btn, fallbackText) {
  if (!btn) return;

  btn.classList.remove('is-loading');

  btn.innerHTML =
    btn.dataset.original || fallbackText;
}


function generateCode() {
  return String(
    Math.floor(100000 + Math.random() * 900000)
  );
}


/* ============ FIREBASE ERROR MESSAGES ============ */

function mapAuthError(err) {
  switch (err.code) {

    case 'auth/user-not-found':
      return 'No account is registered with this email yet. Please sign up first.';

    case 'auth/wrong-password':
      return 'Incorrect password. Try again or use Forgot Password.';

    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'No account is registered with this email, or the password is incorrect.';

    case 'auth/invalid-email':
      return 'Invalid email address.';

    case 'auth/email-already-in-use':
      return 'An account already exists using this email. Please log in instead.';

    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';

    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment before trying again.';

    case 'auth/network-request-failed':
      return 'No internet connection. Please try again.';

    default:
      return 'Something went wrong. Please try again.';
  }
}


/* ============ EMAILJS ============ */

function sendVerificationCode(toEmail, toName, code) {
  return emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    {
      to_email: toEmail,
      to_name: toName,
      code: code
    }
  );
}


/* ============ RESEND COOLDOWN ============ */

function startResendCooldown(linkEl, onDone) {
  if (!linkEl) return;

  let seconds = RESEND_COOLDOWN_SEC;

  const originalText = 'Resend code';

  linkEl.style.pointerEvents = 'none';
  linkEl.style.opacity = '0.5';

  linkEl.textContent =
    `Resend code (${seconds}s)`;

  const interval = setInterval(() => {

    seconds--;

    if (seconds <= 0) {
      clearInterval(interval);

      linkEl.style.pointerEvents = 'auto';
      linkEl.style.opacity = '1';
      linkEl.textContent = originalText;

      if (onDone) {
        onDone();
      }

    } else {
      linkEl.textContent =
        `Resend code (${seconds}s)`;
    }

  }, 1000);
}


/* =========================================================
   ACCOUNT EXISTENCE CHECK
   ========================================================= */

/*
   IMPORTANT:

   Hindi na tayo gumagamit ng
   fetchSignInMethodsForEmail()

   dahil maaaring naka-enable ang Firebase
   Email Enumeration Protection.

   Sa halip, ang backend ang magche-check kung
   existing ang email sa Firebase Authentication.

   Expected backend:

   POST /api/check-account

   Body:
   {
      email: "...",
      role: "student"
   }

   Expected success:
   {
      exists: true
   }

   Kapag walang account:
   {
      exists: false
   }
*/

async function checkRegisteredAccount(email, role) {

  try {

    const response = await fetch('/api/check-account', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        email: email,
        role: role
      })
    });


    const raw = await response.text();

    let result = {};

    try {
      result = raw
        ? JSON.parse(raw)
        : {};
    } catch (_) {
      result = {};
    }


    if (!response.ok) {

      throw new Error(
        result.message ||
        `Hindi ma-check ang account. Server status: ${response.status}`
      );
    }


    return result;

  } catch (err) {

    console.error(
      'Account existence check error:',
      err
    );

    throw err;
  }
}


/* ============ STUDENT: START SIGN UP ============ */

async function studentSignupStart(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById('student-signup-error');

  clearFormError(errorEl);


  const name =
    document
      .getElementById('student-signup-name')
      .value
      .trim();

  const email =
    document
      .getElementById('student-signup-email')
      .value
      .trim();

  const password =
    document
      .getElementById('student-signup-password')
      .value;

  const confirm =
    document
      .getElementById('student-signup-confirm')
      .value;


  if (!name || !email || !password || !confirm) {

    showFormError(
      errorEl,
      'Please fill in all fields before signing up.'
    );

    return false;
  }


  if (password !== confirm) {

    showFormError(
      errorEl,
      'Password and confirm password do not match.'
    );

    return false;
  }


  if (password.length < 6) {

    showFormError(
      errorEl,
      'Password must be at least 6 characters.'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );

  setButtonLoading(
    btn,
    'Sending code...'
  );


  try {

    const code = generateCode();

    await sendVerificationCode(
      email,
      name,
      code
    );


    pendingSignup = {
      role: 'student',
      name,
      email,
      password,
      code,
      expiresAt:
        Date.now() + CODE_EXPIRY_MS
    };


    document.getElementById(
      'student-signup-form-wrap'
    ).style.display = 'none';

    document.getElementById(
      'student-verify-panel'
    ).style.display = 'block';

    document.getElementById(
      'student-verify-email-label'
    ).textContent = email;

    document.getElementById(
      'student-verify-code'
    ).value = '';

    clearFormError(
      document.getElementById(
        'student-verify-error'
      )
    );

  } catch (err) {

    console.error(err);

    showFormError(
      errorEl,
      'The code could not be sent. Check your EmailJS setup, or try again.'
    );

  } finally {

    resetButtonLoading(
      btn,
      'Create Account'
    );
  }

  return false;
}


/* ============ STUDENT: VERIFY SIGNUP CODE ============ */

async function studentVerifyCode(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'student-verify-error'
    );

  clearFormError(errorEl);


  const entered =
    document
      .getElementById(
        'student-verify-code'
      )
      .value
      .trim();


  if (
    !pendingSignup ||
    pendingSignup.role !== 'student'
  ) {

    showFormError(
      errorEl,
      'Something went wrong, please try signing up again.'
    );

    return false;
  }


  if (
    Date.now() >
    pendingSignup.expiresAt
  ) {

    showFormError(
      errorEl,
      'The code has expired. Click "Resend code".'
    );

    return false;
  }


  if (
    entered !== pendingSignup.code
  ) {

    showFormError(
      errorEl,
      'Incorrect code. Please try again.'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );

  setButtonLoading(
    btn,
    'Creating account...'
  );


  try {

    const {
      name,
      email,
      password
    } = pendingSignup;


    const cred =
      await auth.createUserWithEmailAndPassword(
        email,
        password
      );


    await cred.user.updateProfile({
      displayName: name
    });


    // Create the student's Firestore profile (used later for
    // order info like student name/email).
    await db.collection('students').doc(cred.user.uid).set({
      name: name,
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });


    await auth.signOut();


    document.getElementById(
      'student-verify-panel'
    ).style.display = 'none';

    document.getElementById(
      'student-success-title'
    ).textContent =
      `Verified, ${name}!`;

    document.getElementById(
      'student-success-panel'
    ).style.display = 'block';


    pendingSignup = null;

  } catch (err) {

    showFormError(
      errorEl,
      mapAuthError(err)
    );

  } finally {

    resetButtonLoading(
      btn,
      'Verify Code'
    );
  }

  return false;
}


/* ============ STUDENT: RESEND SIGNUP CODE ============ */

async function resendStudentCode() {

  if (
    !pendingSignup ||
    pendingSignup.role !== 'student'
  ) {
    return;
  }


  const link =
    document.getElementById(
      'student-resend-link'
    );


  try {

    const code = generateCode();


    await sendVerificationCode(
      pendingSignup.email,
      pendingSignup.name,
      code
    );


    pendingSignup.code = code;

    pendingSignup.expiresAt =
      Date.now() + CODE_EXPIRY_MS;


    showToast(
      'The code has been resent.'
    );


    startResendCooldown(link);

  } catch (err) {

    showToast(
      'Could not resend, please try again.'
    );
  }
}


/* ============ STUDENT: LOGIN ============ */

async function studentLogin(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'student-login-error'
    );

  clearFormError(errorEl);


  const email =
    document
      .getElementById(
        'student-login-email'
      )
      .value
      .trim();

  const password =
    document
      .getElementById(
        'student-login-password'
      )
      .value;


  if (!email || !password) {

    showFormError(
      errorEl,
      'Please fill in email and password.'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );

  setButtonLoading(
    btn,
    'Logging in...'
  );


  try {

    const cred =
      await auth.signInWithEmailAndPassword(
        email,
        password
      );


    showToast(
      `Welcome back, ${cred.user.displayName || 'Student'}!`
    );


    closeAllOverlays();

    window.location.href = 'student-dashboard.html';

  } catch (err) {

    showFormError(
      errorEl,
      mapAuthError(err)
    );

  } finally {

    resetButtonLoading(
      btn,
      'Login'
    );
  }

  return false;
}


/* =========================================================
   STUDENT: FORGOT PASSWORD
   ========================================================= */

async function studentForgotPassword(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'student-forgot-error'
    );

  clearFormError(errorEl);


  const emailInput =
    document.getElementById(
      'student-forgot-email'
    );


  const email =
    emailInput.value
      .trim()
      .toLowerCase();


  if (!email) {

    showFormError(
      errorEl,
      'Enter your email address.'
    );

    return false;
  }


  if (!emailInput.checkValidity()) {

    showFormError(
      errorEl,
      'Invalid email address.'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );

  setButtonLoading(
    btn,
    'Checking account...'
  );


  try {

    /*
      FIRST:
      Check kung registered talaga ang email.
    */

    const account =
      await checkRegisteredAccount(
        email,
        'student'
      );


    /*
      Kapag walang account,
      HUWAG magpadala ng code.
    */

    if (!account.exists) {

      showFormError(
        errorEl,
        'There is no registered student account using this email yet. Please sign up first.'
      );

      return false;
    }


    /*
      Existing account lamang ang
      makakatanggap ng verification code.
    */

    const code = generateCode();


    studentForgotData = {
      email,
      code,
      expiresAt:
        Date.now() + CODE_EXPIRY_MS,
      verified: false
    };


    await sendVerificationCode(
      email,
      'Student',
      code
    );


    document.getElementById(
      'student-forgot-email-label'
    ).textContent = email;


    document.getElementById(
      'student-forgot-email-panel'
    ).style.display = 'none';


    document.getElementById(
      'student-forgot-code-panel'
    ).style.display = 'block';


    document.getElementById(
      'student-forgot-code'
    ).value = '';


    clearFormError(
      document.getElementById(
        'student-forgot-code-error'
      )
    );


    startResendCooldown(
      document.getElementById(
        'student-forgot-resend'
      )
    );


    showToast(
      'The 6-digit code has been sent to your Gmail!'
    );


  } catch (err) {

    console.error(
      'Student forgot password error:',
      err
    );


    showFormError(
      errorEl,
      err.message ||
      'Could not check the account. Please try again.'
    );

  } finally {

    resetButtonLoading(
      btn,
      'Send Code'
    );
  }

  return false;
}


/* ============ STUDENT FORGOT CODE ============ */

function verifyStudentForgotCode(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'student-forgot-code-error'
    );

  clearFormError(errorEl);


  const enteredCode =
    document
      .getElementById(
        'student-forgot-code'
      )
      .value
      .trim();


  if (!/^\d{6}$/.test(enteredCode)) {

    showFormError(
      errorEl,
      'Enter a valid 6-digit code.'
    );

    return false;
  }


  if (!studentForgotData.code) {

    showFormError(
      errorEl,
      'No active verification code. Please request again.'
    );

    return false;
  }


  if (
    Date.now() >
    studentForgotData.expiresAt
  ) {

    showFormError(
      errorEl,
      'The code has expired. Request a new code.'
    );

    return false;
  }


  if (
    enteredCode !==
    studentForgotData.code
  ) {

    showFormError(
      errorEl,
      'Incorrect verification code.'
    );

    return false;
  }


  studentForgotData.verified = true;


  document.getElementById(
    'student-forgot-code-panel'
  ).style.display = 'none';


  document.getElementById(
    'student-forgot-password-panel'
  ).style.display = 'block';


  document.getElementById(
    'student-new-password'
  ).value = '';


  document.getElementById(
    'student-confirm-new-password'
  ).value = '';


  document.getElementById(
    'student-new-password'
  ).focus();


  showToast(
    'Code verified! Create your new password.'
  );


  return false;
}


/* ============ STUDENT RESEND FORGOT CODE ============ */

async function resendStudentForgotCode() {

  const link =
    document.getElementById(
      'student-forgot-resend'
    );


  if (
    link.style.pointerEvents === 'none'
  ) {
    return false;
  }


  const email =
    studentForgotData.email;


  if (!email) {

    showStudentForgotEmailPanel();

    return false;
  }


  const newCode =
    generateCode();


  try {

    await sendVerificationCode(
      email,
      'Student',
      newCode
    );


    studentForgotData.code =
      newCode;

    studentForgotData.expiresAt =
      Date.now() + CODE_EXPIRY_MS;

    studentForgotData.verified =
      false;


    startResendCooldown(link);


    showToast(
      'A new code has been sent to your Gmail!'
    );


  } catch (err) {

    console.error(err);

    showToast(
      'The new code could not be sent.'
    );
  }


  return false;
}


/* ============ STUDENT FORGOT EMAIL PANEL ============ */

function showStudentForgotEmailPanel() {

  document.getElementById(
    'student-forgot-email-panel'
  ).style.display = 'block';


  document.getElementById(
    'student-forgot-code-panel'
  ).style.display = 'none';


  document.getElementById(
    'student-forgot-password-panel'
  ).style.display = 'none';


  document.getElementById(
    'student-forgot-success-panel'
  ).style.display = 'none';
}


/* ============ STUDENT SAVE NEW PASSWORD ============ */

async function saveStudentNewPassword(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'student-new-password-error'
    );

  clearFormError(errorEl);


  if (!studentForgotData.verified) {

    showFormError(
      errorEl,
      'Please verify your email code first.'
    );

    return false;
  }


  if (
    Date.now() >
    studentForgotData.expiresAt
  ) {

    showFormError(
      errorEl,
      'The verification has expired. Please request a new code.'
    );

    return false;
  }


  const password =
    document.getElementById(
      'student-new-password'
    ).value;


  const confirmPassword =
    document.getElementById(
      'student-confirm-new-password'
    ).value;


  if (password.length < 6) {

    showFormError(
      errorEl,
      'Password must be at least 6 characters.'
    );

    return false;
  }


  if (password !== confirmPassword) {

    showFormError(
      errorEl,
      'The two passwords do not match.'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    btn,
    'Changing password...'
  );


  try {

    const response =
      await fetch(
        '/api/reset-password',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            email:
              studentForgotData.email,

            code:
              studentForgotData.code,

            password,

            role: 'student'
          })
        }
      );


    const raw =
      await response.text();


    let result = {};

    try {
      result =
        raw
          ? JSON.parse(raw)
          : {};
    } catch (_) {
      result = {};
    }


    if (!response.ok) {

      throw new Error(
        result.message ||
        `Hindi ma-reach ang password reset server (status ${response.status}).`
      );
    }


    studentForgotData = {
      email: '',
      code: '',
      expiresAt: 0,
      verified: false
    };


    document.getElementById(
      'student-forgot-password-panel'
    ).style.display = 'none';


    document.getElementById(
      'student-forgot-success-panel'
    ).style.display = 'block';


    showToast(
      'Password changed successfully!'
    );


  } catch (err) {

    console.error(err);

    showFormError(
      errorEl,
      err.message ||
      'Could not update the password. Please try again.'
    );

  } finally {

    resetButtonLoading(
      btn,
      'Change Password'
    );
  }


  return false;
}


/* =========================================================
   CANTEEN: SIGN UP
   ========================================================= */

async function canteenSignupStart(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'canteen-signup-error'
    );

  clearFormError(errorEl);


  const name =
    document
      .getElementById('canteen-name')
      .value
      .trim();

  const ownerName =
    document
      .getElementById('canteen-owner')
      .value
      .trim();

  const contact =
    document
      .getElementById('canteen-contact')
      .value
      .trim();

  const email =
    document
      .getElementById('canteen-email')
      .value
      .trim();

  const password =
    document
      .getElementById('canteen-password')
      .value;

  const confirm =
    document
      .getElementById('canteen-confirm')
      .value;

  const pin =
    document
      .getElementById('canteen-pin')
      .value
      .trim();


  const pinWrap =
    document
      .getElementById('canteen-pin')
      .closest('.input-wrap');

  const pinError =
    document.getElementById(
      'canteen-pin-error'
    );


  pinWrap.classList.remove(
    'has-error'
  );

  pinError.classList.remove(
    'show'
  );


  if (
    !name ||
    !ownerName ||
    !contact ||
    !email ||
    !password ||
    !confirm ||
    !pin
  ) {

    showFormError(
      errorEl,
      'Please fill in all fields.'
    );

    return false;
  }


  if (password !== confirm) {

    showFormError(
      errorEl,
      'Password and confirm password do not match.'
    );

    return false;
  }


  if (password.length < 6) {

    showFormError(
      errorEl,
      'Password must be at least 6 characters.'
    );

    return false;
  }


  if (pin !== CANTEEN_VERIFICATION_CODE) {

    pinWrap.classList.add(
      'has-error'
    );

    pinError.classList.add(
      'show'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    btn,
    'Sending code...'
  );


  try {

    const code =
      generateCode();


    await sendVerificationCode(
      email,
      name,
      code
    );


    pendingSignup = {
      role: 'canteen',
      name,
      ownerName,
      contact,
      email,
      password,
      code,
      expiresAt:
        Date.now() + CODE_EXPIRY_MS
    };


    document.getElementById(
      'canteen-signup-form-wrap'
    ).style.display = 'none';


    document.getElementById(
      'canteen-verify-panel'
    ).style.display = 'block';


    document.getElementById(
      'canteen-verify-email-label'
    ).textContent = email;


    document.getElementById(
      'canteen-verify-code'
    ).value = '';


    clearFormError(
      document.getElementById(
        'canteen-verify-error'
      )
    );


  } catch (err) {

    showFormError(
      errorEl,
      'The code could not be sent. Check your EmailJS setup, or try again.'
    );

  } finally {

    resetButtonLoading(
      btn,
      'Create Canteen Account'
    );
  }


  return false;
}


/* ============ CANTEEN VERIFY SIGNUP CODE ============ */

async function canteenVerifyCode(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'canteen-verify-error'
    );

  clearFormError(errorEl);


  const entered =
    document
      .getElementById(
        'canteen-verify-code'
      )
      .value
      .trim();


  if (
    !pendingSignup ||
    pendingSignup.role !== 'canteen'
  ) {

    showFormError(
      errorEl,
      'Something went wrong, please try signing up again.'
    );

    return false;
  }


  if (
    Date.now() >
    pendingSignup.expiresAt
  ) {

    showFormError(
      errorEl,
      'The code has expired. Click "Resend code".'
    );

    return false;
  }


  if (
    entered !== pendingSignup.code
  ) {

    showFormError(
      errorEl,
      'Incorrect code. Please try again.'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    btn,
    'Creating account...'
  );


  try {

    const {
      name,
      ownerName,
      contact,
      email,
      password
    } = pendingSignup;


    const cred =
      await auth.createUserWithEmailAndPassword(
        email,
        password
      );


    await cred.user.updateProfile({
      displayName: name
    });


    // Create the canteen's Firestore profile so it registers
    // automatically in the student dashboard's canteen list.
    // ownerName/contact come straight from the signup form now,
    // so the dashboard's Canteen Profile page shows them right
    // away instead of needing the owner to type them in again.
    await db.collection('canteens').doc(cred.user.uid).set({
      name: name,
      ownerName: ownerName,
      email: email,
      description: '',
      location: '',
      hours: '',
      contact: contact,
      logoUrl: '',
      status: 'closed',
      ownerUid: cred.user.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });


    await auth.signOut();


    document.getElementById(
      'canteen-verify-panel'
    ).style.display = 'none';


    document.getElementById(
      'canteen-success-title'
    ).textContent =
      `Welcome, ${name}!`;


    document.getElementById(
      'canteen-success'
    ).style.display = 'block';


    pendingSignup = null;


  } catch (err) {

    showFormError(
      errorEl,
      mapAuthError(err)
    );

  } finally {

    resetButtonLoading(
      btn,
      'Verify Code'
    );
  }


  return false;
}


/* ============ CANTEEN RESEND SIGNUP CODE ============ */

async function resendCanteenCode() {

  if (
    !pendingSignup ||
    pendingSignup.role !== 'canteen'
  ) {
    return;
  }


  const link =
    document.getElementById(
      'canteen-resend-link'
    );


  try {

    const code =
      generateCode();


    await sendVerificationCode(
      pendingSignup.email,
      pendingSignup.name,
      code
    );


    pendingSignup.code =
      code;


    pendingSignup.expiresAt =
      Date.now() + CODE_EXPIRY_MS;


    showToast(
      'The code has been resent.'
    );


    startResendCooldown(link);


  } catch (err) {

    showToast(
      'Could not resend, please try again.'
    );
  }
}


/* ============ CANTEEN LOGIN ============ */

async function canteenLogin(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'canteen-login-error'
    );

  clearFormError(errorEl);


  const email =
    document
      .getElementById(
        'canteen-login-email'
      )
      .value
      .trim();


  const password =
    document
      .getElementById(
        'canteen-login-password'
      )
      .value;


  if (!email || !password) {

    showFormError(
      errorEl,
      'Please fill in email and password.'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    btn,
    'Logging in...'
  );


  try {

    const cred =
      await auth.signInWithEmailAndPassword(
        email,
        password
      );


    showToast(
      `Welcome back, ${cred.user.displayName || 'Canteen'}!`
    );


    closeAllOverlays();

    window.location.href = 'Canteen/canteen-dashboard.html';


  } catch (err) {

    showFormError(
      errorEl,
      mapAuthError(err)
    );


  } finally {

    resetButtonLoading(
      btn,
      'Login'
    );
  }


  return false;
}


/* =========================================================
   CANTEEN: FORGOT PASSWORD
   ========================================================= */

async function canteenForgotPassword(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'canteen-forgot-error'
    );

  clearFormError(errorEl);


  const emailInput =
    document.getElementById(
      'canteen-forgot-email'
    );


  const email =
    emailInput.value
      .trim()
      .toLowerCase();


  if (!email) {

    showFormError(
      errorEl,
      'Enter the canteen email address.'
    );

    return false;
  }


  if (!emailInput.checkValidity()) {

    showFormError(
      errorEl,
      'Invalid email address.'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    btn,
    'Checking account...'
  );


  try {

    /*
      FIRST:
      Check kung registered talaga
      ang canteen email.
    */

    const account =
      await checkRegisteredAccount(
        email,
        'canteen'
      );


    /*
      Kapag walang account,
      HUWAG magpadala ng code.
    */

    if (!account.exists) {

      showFormError(
        errorEl,
        'There is no registered canteen account using this email yet. Please sign up first.'
      );

      return false;
    }


    const code =
      generateCode();


    canteenForgotData = {
      email,
      code,
      expiresAt:
        Date.now() + CODE_EXPIRY_MS,
      verified: false
    };


    await sendVerificationCode(
      email,
      'Canteen',
      code
    );


    document.getElementById(
      'canteen-forgot-email-label'
    ).textContent = email;


    document.getElementById(
      'canteen-forgot-email-panel'
    ).style.display = 'none';


    document.getElementById(
      'canteen-forgot-code-panel'
    ).style.display = 'block';


    document.getElementById(
      'canteen-forgot-code'
    ).value = '';


    clearFormError(
      document.getElementById(
        'canteen-forgot-code-error'
      )
    );


    startResendCooldown(
      document.getElementById(
        'canteen-forgot-resend'
      )
    );


    showToast(
      'The 6-digit code has been sent to your Gmail!'
    );


  } catch (err) {

    console.error(
      'Canteen forgot password error:',
      err
    );


    showFormError(
      errorEl,
      err.message ||
      'Could not check the account. Please try again.'
    );


  } finally {

    resetButtonLoading(
      btn,
      'Send Code'
    );
  }


  return false;
}


/* ============ CANTEEN FORGOT CODE ============ */

function verifyCanteenForgotCode(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'canteen-forgot-code-error'
    );

  clearFormError(errorEl);


  const enteredCode =
    document
      .getElementById(
        'canteen-forgot-code'
      )
      .value
      .trim();


  if (!/^\d{6}$/.test(enteredCode)) {

    showFormError(
      errorEl,
      'Enter a valid 6-digit code.'
    );

    return false;
  }


  if (!canteenForgotData.code) {

    showFormError(
      errorEl,
      'No active verification code. Please request again.'
    );

    return false;
  }


  if (
    Date.now() >
    canteenForgotData.expiresAt
  ) {

    showFormError(
      errorEl,
      'The code has expired. Request a new code.'
    );

    return false;
  }


  if (
    enteredCode !==
    canteenForgotData.code
  ) {

    showFormError(
      errorEl,
      'Incorrect verification code.'
    );

    return false;
  }


  canteenForgotData.verified = true;


  document.getElementById(
    'canteen-forgot-code-panel'
  ).style.display = 'none';


  document.getElementById(
    'canteen-forgot-password-panel'
  ).style.display = 'block';


  document.getElementById(
    'canteen-new-password'
  ).value = '';


  document.getElementById(
    'canteen-confirm-new-password'
  ).value = '';


  document.getElementById(
    'canteen-new-password'
  ).focus();


  showToast(
    'Code verified! Create your new password.'
  );


  return false;
}


/* ============ CANTEEN RESEND FORGOT CODE ============ */

async function resendCanteenForgotCode() {

  const link =
    document.getElementById(
      'canteen-forgot-resend'
    );


  if (
    link.style.pointerEvents === 'none'
  ) {
    return false;
  }


  const email =
    canteenForgotData.email;


  if (!email) {

    showCanteenForgotEmailPanel();

    return false;
  }


  const newCode =
    generateCode();


  try {

    await sendVerificationCode(
      email,
      'Canteen',
      newCode
    );


    canteenForgotData.code =
      newCode;

    canteenForgotData.expiresAt =
      Date.now() + CODE_EXPIRY_MS;

    canteenForgotData.verified =
      false;


    startResendCooldown(link);


    showToast(
      'A new code has been sent to your Gmail!'
    );


  } catch (err) {

    console.error(err);

    showToast(
      'The new code could not be sent.'
    );
  }


  return false;
}


/* ============ CANTEEN FORGOT EMAIL PANEL ============ */

function showCanteenForgotEmailPanel() {

  document.getElementById(
    'canteen-forgot-email-panel'
  ).style.display = 'block';


  document.getElementById(
    'canteen-forgot-code-panel'
  ).style.display = 'none';


  document.getElementById(
    'canteen-forgot-password-panel'
  ).style.display = 'none';


  document.getElementById(
    'canteen-forgot-success-panel'
  ).style.display = 'none';
}


/* ============ CANTEEN SAVE NEW PASSWORD ============ */

async function saveCanteenNewPassword(event) {

  event.preventDefault();

  const errorEl =
    document.getElementById(
      'canteen-new-password-error'
    );

  clearFormError(errorEl);


  if (!canteenForgotData.verified) {

    showFormError(
      errorEl,
      'Please verify your email code first.'
    );

    return false;
  }


  if (
    Date.now() >
    canteenForgotData.expiresAt
  ) {

    showFormError(
      errorEl,
      'The verification has expired. Please request a new code.'
    );

    return false;
  }


  const password =
    document.getElementById(
      'canteen-new-password'
    ).value;


  const confirmPassword =
    document.getElementById(
      'canteen-confirm-new-password'
    ).value;


  if (password.length < 6) {

    showFormError(
      errorEl,
      'Password must be at least 6 characters.'
    );

    return false;
  }


  if (password !== confirmPassword) {

    showFormError(
      errorEl,
      'The two passwords do not match.'
    );

    return false;
  }


  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );


  setButtonLoading(
    btn,
    'Changing password...'
  );


  try {

    const response =
      await fetch(
        '/api/reset-password',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            email:
              canteenForgotData.email,

            code:
              canteenForgotData.code,

            password,

            role: 'canteen'
          })
        }
      );


    const raw =
      await response.text();


    let result = {};

    try {
      result =
        raw
          ? JSON.parse(raw)
          : {};
    } catch (_) {
      result = {};
    }


    if (!response.ok) {

      throw new Error(
        result.message ||
        `Hindi ma-reach ang password reset server (status ${response.status}).`
      );
    }


    canteenForgotData = {
      email: '',
      code: '',
      expiresAt: 0,
      verified: false
    };


    document.getElementById(
      'canteen-forgot-password-panel'
    ).style.display = 'none';


    document.getElementById(
      'canteen-forgot-success-panel'
    ).style.display = 'block';


    showToast(
      'Password changed successfully!'
    );


  } catch (err) {

    console.error(err);

    showFormError(
      errorEl,
      err.message ||
      'Could not update the password. Please try again.'
    );


  } finally {

    resetButtonLoading(
      btn,
      'Change Password'
    );
  }


  return false;
}


/* ============ TOAST ============ */

let toastTimer = null;

function showToast(message) {

  const toast =
    document.getElementById('toast');

  if (!toast) return;


  toast.innerHTML =
    `<svg><use href="#icon-check"></use></svg> ${message}`;


  toast.classList.add('show');


  clearTimeout(toastTimer);


  toastTimer =
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
}


/* ============ CLOSE OVERLAYS ON ESCAPE ============ */

document.addEventListener(
  'keydown',
  (e) => {

    if (e.key === 'Escape') {
      closeAllOverlays();
    }

  }
);

// ---------- ACTIVE HEADER NAVIGATION ----------

document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll("header nav a");

  const sections = [
    { id: "home", link: navLinks[0] },
    { id: "how-it-works", link: navLinks[1] },
    { id: "about", link: navLinks[2] }
  ];

  function updateActiveNav() {
    const scrollPosition = window.scrollY + 180;

    let activeSection = "home";

    sections.forEach(({ id }) => {
      const section = document.getElementById(id);

      if (section && scrollPosition >= section.offsetTop) {
        activeSection = id;
      }
    });

    navLinks.forEach(link => {
      link.classList.remove("active");
    });

    const current = sections.find(item => item.id === activeSection);

    if (current && current.link) {
      current.link.classList.add("active");
    }
  }

  window.addEventListener("scroll", updateActiveNav);

  updateActiveNav();
});