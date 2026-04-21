'use strict';

const REGISTERED_USERS_KEY = 'medisync_registered_users';

let currentUser = null;
let authUsers = {};

function loadRegisteredUsers() {
  try {
    const stored = localStorage.getItem(REGISTERED_USERS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    authUsers = { ...parsed };
  } catch {
    authUsers = {};
  }
  return authUsers;
}

function saveRegisteredUser(email, userData) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem(REGISTERED_USERS_KEY) || '{}');
    } catch {
      return {};
    }
  })();

  stored[normalizedEmail] = { ...stored[normalizedEmail], ...userData };
  localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(stored));
  loadRegisteredUsers();
  return { email: normalizedEmail, ...authUsers[normalizedEmail] };
}

function syncSessionUser(user) {
  currentUser = user ? { ...user } : null;
  if (currentUser) {
    sessionStorage.setItem('medisync_user', JSON.stringify(currentUser));
  } else {
    sessionStorage.removeItem('medisync_user');
  }
  return currentUser;
}

loadRegisteredUsers();

const Auth = (() => {
  const login = (email, password) => {
    loadRegisteredUsers();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = authUsers[normalizedEmail];
    if (!user || user.password !== password) throw new Error('Invalid credentials');
    return syncSessionUser({ email: normalizedEmail, ...user });
  };

  const logout = () => {
    syncSessionUser(null);
    showLoginScreen();
  };

  const restore = () => {
    loadRegisteredUsers();
    try {
      const stored = sessionStorage.getItem('medisync_user');
      if (!stored) return false;

      const sessionUser = JSON.parse(stored);
      const refreshed = authUsers[sessionUser.email]
        ? { email: sessionUser.email, ...authUsers[sessionUser.email] }
        : sessionUser;
      syncSessionUser(refreshed);
      return true;
    } catch {
      return false;
    }
  };

  const getUser = () => currentUser;

  const updateUser = (updates) => {
    if (!currentUser?.email) return null;
    const merged = {
      ...authUsers[currentUser.email],
      ...updates
    };
    saveRegisteredUser(currentUser.email, merged);
    return syncSessionUser({ email: currentUser.email, ...merged });
  };

  return { login, logout, restore, getUser, updateUser };
})();

const Router = (() => {
  const showPage = (id) => {
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    const page = document.getElementById(id);
    if (page) page.classList.add('active');
  };

  const setRole = (role) => {
    if (role === 'patient') loadPatientDashboard();
    else if (role === 'doctor') loadDoctorDashboard();
    else if (role === 'hospital') loadHospitalDashboard();
    else if (role === 'paramedic') loadParamedicDashboard();
  };

  return { showPage, setRole };
})();

const Toast = (() => {
  const getContainer = () => document.getElementById('toast-container') || (() => {
    const element = document.createElement('div');
    element.className = 'toast-container';
    element.id = 'toast-container';
    document.body.appendChild(element);
    return element;
  })();

  const show = (title, msg, type = 'info', duration = 4000) => {
    const icons = { info: 'i', success: 'OK', alarm: 'AL', danger: '!', warning: '!' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'i'}</span>
      <div style="flex:1">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
      <span style="cursor:pointer;color:var(--text-muted);font-size:1rem;margin-left:8px;flex-shrink:0;" onclick="this.parentElement.remove()">x</span>
    `;
    getContainer().appendChild(toast);
    if (duration > 0) setTimeout(() => toast.remove(), duration);
    return toast;
  };

  return { show };
})();

const Modal = (() => {
  const open = (id) => {
    const element = document.getElementById(id);
    if (element) element.classList.add('open');
  };

  const close = (id) => {
    const element = document.getElementById(id);
    if (element) element.classList.remove('open');
  };

  const closeAll = () => {
    document.querySelectorAll('.modal-overlay').forEach((element) => element.classList.remove('open'));
  };

  return { open, close, closeAll };
})();

const Utils = {
  formatDate: (date) => new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }),
  timeAgo: (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  },
  formatMarkdown: (text) => text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p style="margin-top:8px;">')
    .replace(/\n/g, '<br>')
};

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('role-select').style.display = 'none';
  renderLoginForm('login');
}

function renderLoginForm(tab) {
  ['login', 'register'].forEach((name) => {
    const element = document.getElementById('login-tab-' + name);
    if (element) element.classList.toggle('active', name === tab);
  });

  document.getElementById('login-form-area').innerHTML = tab === 'register'
    ? registerFormHTML()
    : loginFormHTML();

  if (tab === 'register') toggleRoleFields();
}

function loginFormHTML() {
  return `
  <div id="login-error" style="display:none;" class="login-error"></div>

  <label class="login-label">Role</label>
  <select class="login-select" id="login-role">
    <option value="patient">Patient</option>
    <option value="doctor">Doctor</option>
    <option value="hospital">Hospital</option>
    <option value="paramedic">Paramedic</option>
  </select>

  <label class="login-label">Email Address</label>
  <input class="login-input" id="login-email" type="email" placeholder="you@example.com" />

  <label class="login-label">Password</label>
  <input class="login-input" id="login-password" type="password" placeholder="Password"
    onkeydown="if(event.key==='Enter')doLogin()" />

  <button class="login-btn" id="login-submit-btn" onclick="doLogin()" style="margin-top:14px;">Login</button>
  <p style="text-align:center;font-size:0.82rem;color:#64748B;margin-top:14px;">
    New here? <a style="color:#60A5FA;font-weight:600;cursor:pointer;" onclick="renderLoginForm('register')">Create an account</a>
  </p>
  `;
}

function registerFormHTML() {
  return `
  <div id="login-error" style="display:none;" class="login-error"></div>

  <label class="login-label">Role</label>
  <select class="login-select" id="reg-role" onchange="toggleRoleFields()">
    <option value="patient">Patient</option>
    <option value="doctor">Doctor</option>
    <option value="hospital">Hospital</option>
    <option value="paramedic">Paramedic</option>
  </select>

  <label class="login-label" id="reg-name-label">Full Name</label>
  <input class="login-input" id="reg-name" type="text" placeholder="Your full name" />

  <label class="login-label">Email Address</label>
  <input class="login-input" id="reg-email" type="email" placeholder="you@example.com" />

  <label class="login-label">Password</label>
  <input class="login-input" id="reg-password" type="password" placeholder="Min 6 characters" />

  <div id="patient-fields" style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
    <label class="login-label">Phone Number</label>
    <input class="login-input" id="reg-phone" type="text" placeholder="+91 98765 43210" />
    <label class="login-label">Blood Group</label>
    <select class="login-select" id="reg-blood">
      <option value="">Select blood group</option>
      <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
      <option>O+</option><option>O-</option><option>AB+</option><option>AB-</option>
    </select>
    <label class="login-label">Known Allergies (optional)</label>
    <input class="login-input" id="reg-allergies" type="text" placeholder="e.g. Penicillin, Aspirin" />
  </div>

  <div id="doctor-fields" style="display:none;flex-direction:column;gap:10px;margin-top:4px;">
    <label class="login-label">Specialization</label>
    <input class="login-input" id="reg-specialization" type="text" placeholder="e.g. Cardiologist" />
    <label class="login-label">Hospital / Clinic Name</label>
    <input class="login-input" id="reg-hospital-name" type="text" placeholder="e.g. Max Healthcare" />
    <label class="login-label">Medical License Number</label>
    <input class="login-input" id="reg-license" type="text" placeholder="e.g. MCI-2024-XXXX" />
  </div>

  <div id="hospital-fields" style="display:none;flex-direction:column;gap:10px;margin-top:4px;">
    <label class="login-label">Hospital Phone</label>
    <input class="login-input" id="reg-hosp-phone" type="text" placeholder="+91 98765 43210" />
    <label class="login-label">Address</label>
    <input class="login-input" id="reg-address" type="text" placeholder="Full hospital address" />
    <label class="login-label">Departments (optional)</label>
    <input class="login-input" id="reg-departments" type="text" placeholder="e.g. Cardiology, Neurology" />
  </div>

  <div id="paramedic-fields" style="display:none;flex-direction:column;gap:10px;margin-top:4px;">
    <label class="login-label">Phone Number (optional)</label>
    <input class="login-input" id="reg-paramedic-phone" type="text" placeholder="+91 98765 43210" />
    <p style="font-size:0.85rem;color:#64748B;margin:0;padding:8px;background:#F1F5F9;border-radius:6px;">
      Quick registration for emergency responders. Additional details can be added later.
    </p>
  </div>

  <button class="login-btn" id="reg-submit-btn" onclick="doRegister()" style="margin-top:18px;">Create Account</button>
  <p style="text-align:center;font-size:0.82rem;color:#64748B;margin-top:14px;">
    Already have an account? <a style="color:#60A5FA;font-weight:600;cursor:pointer;" onclick="renderLoginForm('login')">Login</a>
  </p>
  `;
}

window.toggleRoleFields = function toggleRoleFields() {
  const role = document.getElementById('reg-role')?.value || 'patient';
  const nameLabel = document.getElementById('reg-name-label');
  const nameInput = document.getElementById('reg-name');

  ['patient-fields', 'doctor-fields', 'hospital-fields', 'paramedic-fields'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
  });

  const map = {
    patient: { id: 'patient-fields', label: 'Full Name', placeholder: 'Your full name' },
    doctor: { id: 'doctor-fields', label: 'Full Name', placeholder: 'Dr. First Last' },
    hospital: { id: 'hospital-fields', label: 'Hospital Name', placeholder: 'e.g. Max Healthcare' },
    paramedic: { id: 'paramedic-fields', label: 'Full Name / Unit ID', placeholder: 'e.g. John Doe or Unit-7' }
  };

  const config = map[role] || map.patient;
  const block = document.getElementById(config.id);
  if (block) block.style.display = 'flex';
  if (nameLabel) nameLabel.textContent = config.label;
  if (nameInput) nameInput.placeholder = config.placeholder;
};

function doLogin() {
  const selectedRole = document.getElementById('login-role')?.value || 'patient';
  const email = document.getElementById('login-email')?.value?.trim().toLowerCase() || '';
  const password = document.getElementById('login-password')?.value || '';

  if (!email || !password) {
    showLoginError('Please enter your email and password.');
    return;
  }

  try {
    const user = Auth.login(email, password);
    if (user.role !== selectedRole) {
      syncSessionUser(null);
      showLoginError(`This account is registered as a ${user.role}. Please select the correct role.`);
      return;
    }

    if (window.MediSyncDB?.initializeUserData) {
      MediSyncDB.initializeUserData(user);
    }

    launchApp(user);
  } catch {
    showLoginError('Incorrect email or password.');
  }
}

function doRegister() {
  loadRegisteredUsers();

  const role = document.getElementById('reg-role')?.value || 'patient';
  const name = document.getElementById('reg-name')?.value?.trim() || '';
  const email = document.getElementById('reg-email')?.value?.trim().toLowerCase() || '';
  const password = document.getElementById('reg-password')?.value || '';

  if (!name || !email || !password) {
    showLoginError('Please fill in name, email, and password.');
    return;
  }
  if (password.length < 6) {
    showLoginError('Password must be at least 6 characters.');
    return;
  }
  if (authUsers[email]) {
    showLoginError('This email is already registered. Please login instead.');
    return;
  }

  const newUser = { name, password, role };

  if (role === 'patient') {
    newUser.phone = document.getElementById('reg-phone')?.value?.trim() || '';
    newUser.bloodGroup = document.getElementById('reg-blood')?.value || '';
    newUser.allergies = document.getElementById('reg-allergies')?.value?.trim() || '';
  } else if (role === 'doctor') {
    newUser.specialization = document.getElementById('reg-specialization')?.value?.trim() || '';
    newUser.hospitalName = document.getElementById('reg-hospital-name')?.value?.trim() || '';
    newUser.license = document.getElementById('reg-license')?.value?.trim() || '';
    newUser.phone = '';
    newUser.experience = '';
    newUser.consultationFee = '';
    newUser.bio = '';
  } else if (role === 'hospital') {
    newUser.phone = document.getElementById('reg-hosp-phone')?.value?.trim() || '';
    newUser.address = document.getElementById('reg-address')?.value?.trim() || '';
    newUser.departments = document.getElementById('reg-departments')?.value?.trim() || '';
  } else if (role === 'paramedic') {
    newUser.phone = document.getElementById('reg-paramedic-phone')?.value?.trim() || '';
    newUser.unitId = name;
  }

  saveRegisteredUser(email, newUser);

  try {
    const user = Auth.login(email, password);
    if (window.MediSyncDB?.initializeUserData) {
      MediSyncDB.initializeUserData(user);
    }
    Toast.show('Welcome!', `Account created for ${name}`, 'success');
    launchApp(user);
  } catch {
    showLoginError('Registration error. Please try again.');
  }
}

function quickLogin(email) {
  loadRegisteredUsers();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = authUsers[normalizedEmail];
  if (!user) return;
  const sessionUser = Auth.login(normalizedEmail, user.password);
  if (window.MediSyncDB?.initializeUserData) {
    MediSyncDB.initializeUserData(sessionUser);
  }
  launchApp(sessionUser);
}

function showLoginError(msg) {
  const element = document.getElementById('login-error');
  if (element) {
    element.textContent = msg;
    element.style.display = 'block';
  }
}

function launchApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('role-select').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  Router.setRole(user.role);
}

function doLogout() {
  if (window.ReminderEngine) ReminderEngine.clearAll();
  Auth.logout();
}

document.addEventListener('DOMContentLoaded', () => {
  loadRegisteredUsers();

  if (Auth.restore()) {
    const user = Auth.getUser();
    if (window.MediSyncDB?.initializeUserData) {
      MediSyncDB.initializeUserData(user);
    }
    launchApp(user);
  } else {
    showLoginScreen();
  }

  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal-overlay')) Modal.closeAll();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      Modal.closeAll();
      if (typeof closeEmergency === 'function') closeEmergency();
    }
  });

  if (window.ReminderEngine) {
    ReminderEngine.onAlarm((reminder, slot) => {
      // Show full-screen alarm overlay with snooze (3x) and mark-taken
      if (typeof showAlarmOverlay === 'function') {
        showAlarmOverlay(reminder, slot);
      } else {
        Toast.show('Medication Reminder', `Time to take ${reminder.medicine} - ${reminder.dose} (${slot})`, 'alarm', 0);
      }
      document.querySelectorAll('.bell-icon').forEach((bell) => bell.classList.add('ringing'));
      setTimeout(() => {
        document.querySelectorAll('.bell-icon').forEach((bell) => bell.classList.remove('ringing'));
      }, 5000);
    });
  }
});

window.Auth = Auth;
window.Router = Router;
window.Toast = Toast;
window.Modal = Modal;
window.Utils = Utils;
window.showLoginScreen = showLoginScreen;
window.renderLoginForm = renderLoginForm;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.quickLogin = quickLogin;
window.doLogout = doLogout;
window.launchApp = launchApp;
