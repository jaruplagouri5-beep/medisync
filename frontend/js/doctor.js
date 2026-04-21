// ═══════════════════════════════════════════════════
//  MediSync — Doctor Dashboard (Full Restored Version)
// ═══════════════════════════════════════════════════

'use strict';

let html5QrcodeScanner = null;

// ─── ROUTING HELPER ───
window.goToScanner = function(params = '') {
    const isFrontendDir = window.location.pathname.includes('/frontend');
    const basePath = isFrontendDir ? 'scanner.html' : 'frontend/scanner.html';
    window.location.href = basePath + params;
};

window.doLogout = function() {
    if (window.Auth && Auth.logout) Auth.logout();
    else localStorage.removeItem('medisync_current_user');
    
    const isFrontendDir = window.location.pathname.includes('/frontend');
    window.location.href = isFrontendDir ? '../index.html' : 'index.html';
};

// ─── APPOINTMENTS LOGIC ───
function getAppointments() {
  const defaultAppts = [
    { id: 1, time: '10:00 AM', name: 'Rajesh Kumar Sharma', reason: 'Diabetes follow-up', done: true },
    { id: 2, time: '02:30 PM', name: 'Meena Gupta', reason: 'HbA1c review', done: false }
  ];
  const stored = localStorage.getItem('medisync_appointments');
  return stored ? JSON.parse(stored) : defaultAppts;
}

function saveAppointments(appts) {
  localStorage.setItem('medisync_appointments', JSON.stringify(appts));
}

// ─── DASHBOARD INIT ───
function loadDoctorDashboard() {
  const user = (window.Auth && Auth.getUser) ? Auth.getUser() : null;
  const name = (user && user.name) ? user.name : 'Dr. Priya Mehta';
  const spec  = (user && user.specialization) ? user.specialization : 'Endocrinologist';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'DR';

  const navName = document.getElementById('nav-name');
  const navAvatar = document.getElementById('nav-avatar');
  if (navName) navName.textContent = name;
  if (navAvatar) {
      navAvatar.textContent = initials;
      navAvatar.className = 'avatar green';
  }

  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.innerHTML = doctorSidebar(name, spec, initials);
  
  const topnav = document.getElementById('topnav-links');
  if (topnav) topnav.innerHTML = '';

  const logoutBtn = document.getElementById('nav-logout');
  if (logoutBtn) logoutBtn.onclick = window.doLogout;
  
  renderDoctorContent('overview');
}

function doctorSidebar(name, spec, initials) {
  return `
  <div class="sidebar-user">
    <div class="avatar green" style="width:36px;height:36px;font-size:0.78rem;flex-shrink:0;">${initials}</div>
    <div class="sidebar-user-info">
      <div class="sidebar-user-name">${name}</div>
      <div class="sidebar-user-role">${spec}</div>
    </div>
  </div>
  <div class="sidebar-section">Navigation</div>
  <ul class="sidebar-menu">
    <li><a href="#" data-tab="overview" onclick="renderDoctorContent('overview');return false;" class="active"><span class="icon">🏠</span> Overview</a></li>
    <li><a href="#" data-tab="patients" onclick="renderDoctorContent('patients');return false;"><span class="icon">👥</span> My Patients</a></li>
    <li><a href="#" data-tab="scan" onclick="renderDoctorContent('scan');return false;"><span class="icon">📷</span> Scan Patient QR</a></li>
    <li><a href="#" data-tab="history" onclick="renderDoctorContent('history');return false;"><span class="icon">📋</span> Access History</a></li>
    <li><a href="#" data-tab="profile" onclick="renderDoctorContent('profile');return false;"><span class="icon">👤</span> My Profile</a></li>
  </ul>
  <div class="sidebar-spacer"></div>
  <div class="sidebar-logout">
    <ul class="sidebar-menu">
      <li><a href="#" onclick="doLogout();return false;"><span class="icon">🚪</span> Logout</a></li>
    </ul>
  </div>`;
}

function renderDoctorContent(tab) {
  if (html5QrcodeScanner) {
    try { html5QrcodeScanner.clear(); } catch(e) {}
    html5QrcodeScanner = null;
  }

  document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
  const link = document.querySelector(`[data-tab="${tab}"]`);
  if (link) link.classList.add('active');
  const main = document.getElementById('main-content');
  if (!main) return;
  
  if      (tab === 'overview') main.innerHTML = doctorOverview();
  else if (tab === 'patients') main.innerHTML = doctorPatients();
  else if (tab === 'scan')     main.innerHTML = doctorScan();
  else if (tab === 'history')  main.innerHTML = doctorHistory();
  else if (tab === 'profile')  main.innerHTML = doctorProfile();
}

// ─── OVERVIEW ───
function doctorOverview() {
  const user = (window.Auth && Auth.getUser) ? Auth.getUser() : null;
  const name = (user && user.name) ? user.name : 'Dr. Priya Mehta';
  const spec = (user && user.specialization) ? user.specialization : 'Endocrinologist';
  const hosp = (user && user.hospitalName)   ? user.hospitalName   : 'Max Healthcare, Roorkee';

  const dynamicHistory = JSON.parse(localStorage.getItem('medisync_history') || '[]');
  const reviewedCount = 2 + dynamicHistory.length; 
  
  const appts = getAppointments();
  const apptsHTML = appts.length > 0 ? appts.map(a => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--glass-border2);">
      <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px 10px;text-align:center;min-width:75px;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);">${a.time}</div>
      </div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary);">${a.name}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);">${a.reason}</div>
      </div>
      <span class="badge badge-${a.done ? 'green' : 'amber'}" style="cursor:pointer;" onclick="toggleAppointment(${a.id})">${a.done ? 'Done' : 'Upcoming'}</span>
      <button class="btn btn-ghost btn-sm" style="padding:6px; font-size:0.9rem;" title="Edit" onclick="editAppointment(${a.id})">✏️</button>
      <button class="btn btn-ghost btn-sm" style="padding:6px; font-size:0.9rem; color:var(--red);" title="Delete" onclick="deleteAppointment(${a.id})">🗑️</button>
    </div>
  `).join('') : `<div style="padding:20px; text-align:center; color:var(--text-muted);">No appointments today.</div>`;

  return `
  <div class="section-header">
    <div class="section-title">Good morning, ${name} 👩‍⚕️</div>
    <div class="section-sub">${spec} · ${hosp}</div>
  </div>

  <div class="stat-grid mb-6">
    <div class="stat-card blue"><div class="stat-icon">👥</div><div class="stat-value">48</div><div class="stat-label">Total Patients</div></div>
    <div class="stat-card green"><div class="stat-icon">📅</div><div class="stat-value" style="color:white">${appts.length}</div><div class="stat-label">Today's Appointments</div></div>
    <div class="stat-card teal"><div class="stat-icon">📷</div><div class="stat-value" style="color:white">1</div><div class="stat-label">Pending Consents</div></div>
    <div class="stat-card amber"><div class="stat-icon">📋</div><div class="stat-value" style="color:white">${reviewedCount}</div><div class="stat-label">Records Reviewed</div></div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div class="card-title">📅 Today's Appointments</div>
        <button class="btn btn-primary btn-sm" onclick="addAppointment()">+ Add</button>
      </div>
      <div style="max-height: 350px; overflow-y: auto; padding-right:5px;">
        ${apptsHTML}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">🔍 Quick Actions</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn btn-primary w-full" onclick="goToScanner()" style="justify-content:center;">📷 Open QR Scanner Portal</button>
        <button class="btn btn-ghost w-full" onclick="renderDoctorContent('patients')" style="justify-content:center;">👥 View Patient List</button>
        <button class="btn btn-ghost w-full" onclick="renderDoctorContent('profile')" style="justify-content:center;">👤 Edit My Profile</button>
        
        <div style="background:var(--blue-light);border-radius:var(--radius-sm);padding:14px;margin-top:10px; border:1px solid rgba(59,130,246,0.15);">
          <div style="font-size:0.75rem;font-weight:800;color:var(--blue);margin-bottom:6px;text-transform:uppercase;">HOW CONSENT WORKS</div>
          <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.5;">Scan a patient's QR code using the portal → Patient enters OTP → You receive secure 15-minute read-only access.</div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── CRUD FUNCTIONS ───
function addAppointment() {
  const name = prompt("Enter Patient Name:");
  if(!name) return;
  const time = prompt("Enter Time (e.g., 11:30 AM):", "10:00 AM");
  const reason = prompt("Enter Reason for visit:");
  const appts = getAppointments();
  appts.push({ id: Date.now(), time: time || "TBD", name: name, reason: reason || "General Checkup", done: false });
  saveAppointments(appts);
  renderDoctorContent('overview');
}

function editAppointment(id) {
  const appts = getAppointments();
  const appt = appts.find(a => a.id === id);
  if(!appt) return;
  const name = prompt("Edit Patient Name:", appt.name);
  if(!name) return;
  const time = prompt("Edit Time:", appt.time);
  const reason = prompt("Edit Reason:", appt.reason);
  appt.name = name; appt.time = time; appt.reason = reason;
  saveAppointments(appts);
  renderDoctorContent('overview');
}

function deleteAppointment(id) {
  if(confirm("Are you sure you want to remove this appointment?")) {
    let appts = getAppointments();
    appts = appts.filter(a => a.id !== id);
    saveAppointments(appts);
    renderDoctorContent('overview');
  }
}

function toggleAppointment(id) {
  const appts = getAppointments();
  const appt = appts.find(a => a.id === id);
  if(appt) {
     appt.done = !appt.done;
     saveAppointments(appts);
     renderDoctorContent('overview');
  }
}

// ─── PATIENTS ───
function doctorPatients() {
  return `
  <div class="section-header">
    <div class="section-title">👥 My Patients</div>
    <div class="section-sub">1 patient currently registered</div>
  </div>
  <div class="card">
    <table class="table">
      <thead>
        <tr><th>Patient</th><th>Age / Blood</th><th>Conditions</th><th>Action</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="avatar" style="width:34px;height:34px;font-size:0.8rem;background:var(--blue);color:white;">RS</div>
              <div>
                <div style="font-weight:600;">Rajesh Kumar Sharma</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">P-24114045</div>
              </div>
            </div>
          </td>
          <td>
            <div>45y · Male</div>
            <div style="font-size:0.78rem;"><span class="badge badge-red">B+</span></div>
          </td>
          <td>
            <div style="font-size:0.8rem;">Type 2 Diabetes, Hypertension</div>
            <div style="font-size:0.75rem;color:var(--red);">⚠ Penicillin, Sulfonamides</div>
          </td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="goToScanner('?patientId=P-24114045')">Request Access</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

// ─── SCANNER ───
function doctorScan() {
  return `
  <div class="section-header">
    <div class="section-title">📷 Scan Patient QR</div>
    <div class="section-sub">Use your device camera or open manual entry portal</div>
  </div>

  <div class="grid-2">
    <div class="card text-center" style="display:flex; flex-direction:column; align-items:center;">
      <div id="qr-reader" style="width: 100%; max-width: 400px; min-height: 250px; background: rgba(0,0,0,0.2); border-radius: 12px; margin-bottom: 20px; overflow: hidden; border: 1px solid var(--glass-border);">
         <div style="padding: 100px 0; color: var(--text-muted);">Camera Preview Off</div>
      </div>
      <button class="btn btn-primary w-full mb-3" style="justify-content:center;" onclick="startCameraScanner()">📹 Start Camera Scanner</button>
      <div style="font-size:0.75rem; color:var(--text-muted);">Please allow camera permissions if prompted.</div>
    </div>

    <div class="card" id="consent-panel">
      <div class="card-title mb-4">Fallback Options</div>
      
      <div style="background:var(--slate-100); border-radius:8px; padding:16px; margin-bottom:20px; border:1px solid rgba(255,255,255,0.05);">
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">If camera scanning fails, you can manually open the portal to enter the patient ID and request an OTP.</p>
        <button class="btn btn-ghost w-full" style="justify-content:center; border: 1px solid var(--glass-border);" onclick="goToScanner()">Manual Entry (Open Portal)</button>
      </div>

      <div class="card-title mb-3 mt-4">Consent Flow Guide</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${[
          ['1', 'Scan QR', 'Scan patient\'s MediSync QR code', 'blue'],
          ['2', 'Request Sent', 'Patient receives approval request via SMS', 'amber'],
          ['3', 'Patient Approves', 'Doctor enters OTP in the Portal', 'green'],
          ['4', 'View History', '15-minute read-only access granted', 'purple'],
        ].map(([num, title, desc, color]) => `
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--${color}-light);color:var(--${color});display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0;">${num}</div>
            <div>
              <div style="font-weight:600;font-size:0.875rem;">${title}</div>
              <div style="font-size:0.78rem;color:var(--text-muted);">${desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>`;
}

function startCameraScanner() {
    const readerDiv = document.getElementById('qr-reader');
    if(!readerDiv) return;
    readerDiv.innerHTML = '<div style="padding: 100px 0; color: var(--text-primary);">Requesting camera access...</div>';

    if (typeof Html5QrcodeScanner === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.onload = initializeScanner;
        document.head.appendChild(script);
    } else {
        initializeScanner();
    }
}

function initializeScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
    }
    html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader", { fps: 10, qrbox: {width: 250, height: 250}, rememberLastUsedCamera: true }, false
    );
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function onScanSuccess(decodedText, decodedResult) {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
    }
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = decodedText.match(urlRegex);
    
    if (matches && matches.length > 0) {
        alert("Patient QR Detected! Redirecting to verification portal...");
        window.location.href = matches[0]; 
    } else if(decodedText.includes('scanner.html')) {
        alert("Patient QR Detected! Redirecting to verification portal...");
        goToScanner();
    } else {
        alert("Emergency Data Scanned:\n\n" + decodedText);
    }
}

function onScanFailure(error) { /* Silent failure */ }

// ─── HISTORY ───
function doctorHistory() {
  const staticHistory = [
    { date: '10 Mar 2026, 10:15 AM', patient: 'Rajesh Kumar Sharma', duration: '8 min', status: 'completed' },
    { date: '22 Jan 2026, 3:00 PM', patient: 'Rajesh Kumar Sharma', duration: '15 min', status: 'completed' }
  ];
  const dynamicHistory = JSON.parse(localStorage.getItem('medisync_history') || '[]');
  const allHistory = [...dynamicHistory, ...staticHistory]; 

  const rows = allHistory.map(h => `
    <tr>
      <td style="font-size:0.85rem;">${h.date}</td>
      <td style="font-weight:500;">${h.patient}</td>
      <td style="font-size:0.85rem; color:${h.status === 'Expired' ? 'var(--red)' : 'inherit'};">${h.duration}</td>
      <td><span class="badge badge-${h.status === 'Expired' ? 'red' : 'green'}">${h.status}</span></td>
    </tr>
  `).join('');

  return `
  <div class="section-header">
    <div class="section-title">📋 Access History</div>
    <div class="section-sub">All consent-based access events logged securely</div>
  </div>
  <div class="card"><table class="table"><thead><tr><th>Date & Time</th><th>Patient</th><th>Duration</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ─── PROFILE ───
function doctorProfile() {
  const user    = (window.Auth && Auth.getUser) ? Auth.getUser() : {};
  const name    = user.name            || 'Dr. Priya Mehta';
  const spec    = user.specialization  || 'Endocrinologist';
  const hosp    = user.hospitalName    || 'Max Healthcare, Roorkee';
  const phone   = user.phone           || '';
  const license = user.license         || '';
  const exp     = user.experience      || '';
  const fee     = user.consultationFee || '';
  const bio     = user.bio             || '';
  const email   = user.email           || 'doctor@demo.com';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'DR';

  const esc = (v) => String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  return `
  <div class="section-header">
    <div class="section-title">👤 My Profile</div>
    <div class="section-sub">View and update your doctor details</div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
        <div class="avatar green" style="width:56px;height:56px;font-size:1.1rem;">${initials}</div>
        <div>
          <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;">${name}</div>
          <div style="font-size:0.85rem;color:var(--slate-500);">${spec}</div>
        </div>
      </div>
      <div style="display:grid;gap:10px;font-size:0.9rem;">
        <div><strong>🏥 Hospital:</strong> ${hosp   || '<span style="color:var(--slate-400)">Not added yet</span>'}</div>
        <div><strong>📞 Phone:</strong>    ${phone  || '<span style="color:var(--slate-400)">Not added yet</span>'}</div>
        <div><strong>🪪 License:</strong>  ${license|| '<span style="color:var(--slate-400)">Not added yet</span>'}</div>
        <div><strong>🕒 Experience:</strong>${exp   || '<span style="color:var(--slate-400)">Not added yet</span>'}</div>
        <div><strong>💰 Consultation Fee:</strong> ${fee ? 'Rs. ' + fee : '<span style="color:var(--slate-400)">Not added yet</span>'}</div>
      </div>
      ${bio ? `<div style="margin-top:14px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;color:var(--text-secondary);font-size:0.85rem;">${bio}</div>` : ''}
      <button class="btn btn-primary" style="margin-top:18px;" onclick="if(window.Modal) Modal.open('doctor-profile-modal')">✏️ Edit Profile</button>
    </div>
  </div>

  <div class="modal-overlay" id="doctor-profile-modal">
    <div class="modal" style="background: var(--bg-dark); border: 1px solid var(--glass-border);">
      <div class="modal-header">
        <div class="modal-title" style="color: var(--text-primary);">✏️ Edit Doctor Profile</div>
        <button class="modal-close" onclick="if(window.Modal) Modal.close('doctor-profile-modal')">✕</button>
      </div>
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-control" id="dp-name" value="${esc(name)}"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="dp-phone" value="${esc(phone)}"></div>
      <div class="grid-2">
        <div class="form-group"><label class="form-label">Specialization</label><input class="form-control" id="dp-spec" value="${esc(spec)}"></div>
        <div class="form-group"><label class="form-label">Hospital</label><input class="form-control" id="dp-hosp" value="${esc(hosp)}"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
        <button class="btn btn-ghost" onclick="if(window.Modal) Modal.close('doctor-profile-modal')">Cancel</button>
        <button class="btn btn-primary" onclick="saveDoctorProfile()">💾 Save</button>
      </div>
    </div>
  </div>`;
}

function saveDoctorProfile() {
  const name  = document.getElementById('dp-name')?.value?.trim()  || '';
  const phone = document.getElementById('dp-phone')?.value?.trim() || '';
  const spec  = document.getElementById('dp-spec')?.value?.trim()  || '';
  const hosp  = document.getElementById('dp-hosp')?.value?.trim()  || '';

  if (!name) return alert('Name is required.');

  if (window.Auth && Auth.updateUser) {
    Auth.updateUser({ name, phone, specialization: spec, hospitalName: hosp });
  }

  if(window.Modal) Modal.close('doctor-profile-modal');
  loadDoctorDashboard(); // Reload sidebar and UI
}

// ─── EXPORTS ───
window.loadDoctorDashboard = loadDoctorDashboard;
window.renderDoctorContent = renderDoctorContent;
window.addAppointment = addAppointment;
window.editAppointment = editAppointment;
window.deleteAppointment = deleteAppointment;
window.toggleAppointment = toggleAppointment;
window.startCameraScanner = startCameraScanner;
window.saveDoctorProfile = saveDoctorProfile;
window.doLogout = doLogout;
window.goToScanner = goToScanner;