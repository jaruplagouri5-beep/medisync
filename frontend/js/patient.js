// ═══════════════════════════════════════════════════
//  MediSync v3 — Patient Dashboard
//  frontend/js/patient.js
// ═══════════════════════════════════════════════════
'use strict';

let patientTabState = 'overview';
let serverRecords = []; 
let isUploading = false;     
let isChatbotTyping = false; 
let chatSession = null;
let chatMessages = [];

// --- Fetch Records from DB (Updated with Smart Categorization) ---
async function fetchRecordsFromServer() {
  try {
    const res = await fetch('http://localhost:5001/api/records');
    const data = await res.json();
    if (data.success) {
      serverRecords = data.data.map(dbRec => {
        const rawType = dbRec.category || 'Lab Report';
        const typeLower = rawType.toLowerCase();
        let finalType = 'Lab Report';
        let color = 'blue';

        if (typeLower.includes('prescription') || typeLower.includes('medication')) {
            finalType = 'Prescription';
            color = 'green';
        } else if (typeLower.includes('imag') || typeLower.includes('x-ray') || typeLower.includes('scan') || typeLower.includes('radiology') || typeLower.includes('mri')) {
            finalType = 'Imaging';
            color = 'purple';
        } else if (typeLower.includes('discharge') || typeLower.includes('summary')) {
            finalType = 'Discharge Summary';
            color = 'amber';
        }

        return {
          id: dbRec._id,
          title: dbRec.documentName || 'Medical Document',
          date: dbRec.year ? `${dbRec.year}-01-01` : new Date().toISOString(),
          hospital: 'MediSync DB',
          summary: 'Uploaded via IPFS & AI',
          category: color,
          type: finalType,
          fileUrl: dbRec.ipfsGatewayUrl,
          size: 'IPFS Secured'
        };
      });
    }
  } catch (error) {
    console.error("Failed to fetch records:", error);
  }
}

async function loadPatientDashboard() {
  const patient = MediSyncDB.getPatient();
  const user = Auth.getUser();
  document.getElementById('nav-name').textContent = (user?.name || patient.name).split(' ')[0];
  document.getElementById('nav-avatar').textContent = patient.avatar;
  document.getElementById('nav-avatar').className = 'avatar';
  document.getElementById('app-sidebar').innerHTML = patientSidebar();
  document.getElementById('topnav-links').innerHTML = '';
  document.getElementById('nav-logout').onclick = doLogout;
  
  if (!document.getElementById('upload-modal')) document.body.insertAdjacentHTML('beforeend', uploadModalHTML());
  if (!document.getElementById('add-reminder-modal')) document.body.insertAdjacentHTML('beforeend', addReminderModalHTML());
  
  await fetchRecordsFromServer();
  renderPatientContent('overview');
  if (window.ReminderEngine) ReminderEngine.scheduleAll(MediSyncDB.getReminders());
}

function patientSidebar() {
  const p = MediSyncDB.getPatient();
  const tabs = [
    ['overview','🏠','Overview'],
    ['records','📁','My Records'],
    ['reminders','🔔','Reminders'],
    ['chatbot','🤖','AI Assistant'],
    ['qr','📱','My QR Code'],
    ['profile','👤','Profile'],
  ];
  const links = tabs.map(([t,i,l]) =>
    `<li><a href="#" data-tab="${t}" onclick="renderPatientContent('${t}');return false;"><span class="icon">${i}</span> ${l}</a></li>`
  ).join('');
  return `
    <div class="sidebar-user">
      <div class="avatar" style="width:36px;height:36px;font-size:0.8rem;flex-shrink:0;">${p.avatar}</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name">${p.name.split(' ').slice(0,2).join(' ')}</div>
        <div class="sidebar-user-role">Patient · ${p.bloodGroup}</div>
      </div>
    </div>
    <div class="sidebar-section">Navigation</div>
    <ul class="sidebar-menu">${links}</ul>
    <div class="sidebar-spacer"></div>
    <div class="sidebar-logout">
      <ul class="sidebar-menu">
        <li><a href="#" onclick="doLogout();return false;"><span class="icon">🚪</span> Logout</a></li>
      </ul>
    </div>`;
}

async function renderPatientContent(tab) {
  patientTabState = tab;
  document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
  const link = document.querySelector(`[data-tab="${tab}"]`);
  if (link) link.classList.add('active');
  const main = document.getElementById('main-content');
  
  if (tab === 'overview' || tab === 'records') {
      await fetchRecordsFromServer(); 
  }

  if      (tab === 'overview')  main.innerHTML = patientOverview();
  else if (tab === 'records')   main.innerHTML = patientRecords();
  else if (tab === 'reminders') main.innerHTML = patientReminders();
  else if (tab === 'chatbot')   main.innerHTML = patientChatbot();
  else if (tab === 'qr')        main.innerHTML = patientQR();
  else if (tab === 'profile')   main.innerHTML = patientProfile();
  
  if (tab === 'qr') generatePatientQR();
  if (tab === 'reminders') initReminders();
  if (tab === 'chatbot') initChatbot();
}

// ── Overview ──
function patientOverview() {
  const p = MediSyncDB.getPatient();
  const records = serverRecords; 
  const reminders = MediSyncDB.getReminders();
  const activeRem = reminders.filter(r => r.active).length;
  
  const byYear = {};
  records.forEach(r => {
      const year = new Date(r.date).getFullYear() || new Date().getFullYear();
      if(!byYear[year]) byYear[year] = [];
      byYear[year].push(r);
  });
  const years = Object.keys(byYear).sort((a,b) => b-a);

  const timelineHTML = years.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">No records found.</div>' : years.map(year => {
    const items = byYear[year].map(r => `
      <div class="timeline-item">
        <div class="timeline-dot ${r.category}"></div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex:1;">
          <div>
            <div style="font-weight:600;font-size:0.875rem;color:var(--text-primary);cursor:pointer;" onclick="window.open('${r.fileUrl}', '_blank')">${r.title}</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);">${r.date.split('T')[0]} · ${r.hospital}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">${r.summary}</div>
          </div>
          <span class="badge badge-${r.category}">${r.type}</span>
        </div>
      </div>`).join('');
    return `<div class="mb-4">
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">${year}</div>
      <div class="timeline">${items}</div>
    </div>`;
  }).join('');

  const medRows = reminders.map(r => {
    const btns = r.times.map((t, i) => {
      const slot = ['morning','afternoon','evening','night'][i] || 'morning';
      const taken = r.taken[slot];
      return `<button class="btn btn-sm ${taken ? 'btn-success' : 'btn-ghost'}" onclick="markTakenOverview('${r.id}','${slot}',this)" style="font-size:0.72rem;">${taken ? '✓' : t}</button>`;
    }).join('');
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <div>
        <div style="font-weight:600;font-size:0.875rem;">${r.medicine}</div>
        <div style="font-size:0.75rem;color:var(--text-secondary);">${r.dose} · ${r.times.join(', ')}</div>
      </div>
      <div style="display:flex;gap:4px;">${btns}</div>
    </div>`;
  }).join('');

  return `
  <div class="section-header flex justify-between items-center">
    <div>
      <div class="section-title">Good morning, ${p.name.split(' ')[0]} 👋</div>
      <div class="section-sub">Here's your health summary for today</div>
    </div>
    <button class="btn btn-primary" onclick="openUploadModal()">+ Upload Record</button>
  </div>

  <div class="stat-grid mb-6">
    <div class="stat-card blue"><div class="stat-icon">📁</div><div class="stat-value">${records.length}</div><div class="stat-label">Total Records</div></div>
    <div class="stat-card green"><div class="stat-icon">🔔</div><div class="stat-value">${activeRem}</div><div class="stat-label">Active Reminders</div></div>
    <div class="stat-card teal"><div class="stat-icon">🩸</div><div class="stat-value">${p.bloodGroup}</div><div class="stat-label">Blood Group</div></div>
    <div class="stat-card amber"><div class="stat-icon">⚠️</div><div class="stat-value" style="font-size:1.1rem;">${p.allergies.length}</div><div class="stat-label">Allergies</div><div class="stat-change">${p.allergies.join(' · ')}</div></div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 Medical Timeline</div>
        <button class="btn btn-ghost btn-sm" onclick="renderPatientContent('records')">View All</button>
      </div>
      ${timelineHTML}
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">💊 Today's Medications</div>
          <button class="btn btn-ghost btn-sm" onclick="renderPatientContent('reminders')">Manage</button>
        </div>
        ${reminders.length === 0
          ? '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">No reminders set.</div>'
          : medRows}
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚠️ Critical Info</div>
          <button class="btn btn-ghost btn-sm" onclick="renderPatientContent('qr')">View QR</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="background:var(--red-light);border:1px solid rgba(239,68,68,0.15);border-radius:var(--radius-sm);padding:12px;">
            <div style="font-size:0.7rem;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:0.05em;">Allergies</div>
            <div style="font-weight:600;color:var(--text-primary);margin-top:4px;">${p.allergies.join(' · ')}</div>
          </div>
          <div style="background:var(--blue-light);border:1px solid rgba(59,130,246,0.15);border-radius:var(--radius-sm);padding:12px;">
            <div style="font-size:0.7rem;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:0.05em;">Conditions</div>
            <div style="font-weight:600;color:var(--text-primary);margin-top:4px;">${p.chronicConditions.join(' · ')}</div>
          </div>
          <div style="background:var(--green-light);border:1px solid rgba(16,185,129,0.15);border-radius:var(--radius-sm);padding:12px;">
            <div style="font-size:0.7rem;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.05em;">Emergency Contact</div>
            <div style="font-weight:600;color:var(--text-primary);margin-top:4px;">${p.emergencyContact.name}<br><span style="font-weight:400;font-size:0.85rem;">${p.emergencyContact.phone}</span></div>
          </div>
        </div>
      </div>
      <div class="card" style="background:linear-gradient(135deg,rgba(37,99,235,0.12),rgba(124,58,237,0.08));border-color:rgba(59,130,246,0.2);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:2rem;">🤖</div>
          <div>
            <div style="font-weight:700;font-size:0.9rem;">AI Health Assistant</div>
            <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:2px;">Ask about your reports, meds, or conditions</div>
          </div>
          <button class="btn btn-primary btn-sm" style="margin-left:auto;flex-shrink:0;" onclick="renderPatientContent('chatbot')">Open →</button>
        </div>
      </div>
    </div>
  </div>`;
}

function markTakenOverview(remId, slot, btn) {
  MediSyncDB.markMedTaken(remId, slot);
  if (btn) { btn.textContent = '✓'; btn.className = 'btn btn-sm btn-success'; }
  Toast.show('Medication logged', `${slot} dose marked as taken`, 'success', 3000);
}

// ── Records ──
function patientRecords() {
  const records = serverRecords; 
  
  const byYear = {};
  records.forEach(r => {
      const year = new Date(r.date).getFullYear() || new Date().getFullYear();
      if(!byYear[year]) byYear[year] = [];
      byYear[year].push(r);
  });
  const years = Object.keys(byYear).sort((a,b) => b-a);

  const yearBlocks = years.map(year => {
    const cards = byYear[year].map(r => {
      const col = r.category; 
      const ico = r.category === 'green' ? '💊' : (r.category === 'purple' ? '🩻' : (r.category === 'amber' ? '📄' : '🧪'));
      return `<div class="card record-item" style="padding:14px 18px;" data-type="${r.category}">
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="width:40px;height:40px;border-radius:10px;background:var(--${col}-light);border:1px solid rgba(${col === 'blue' ? '59,130,246' : col === 'green' ? '16,185,129' : '139,92,246'},0.2);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">${ico}</div>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
              <span style="font-weight:600;font-size:0.9rem;">${r.title}</span>
              <span class="badge badge-${col}">${r.type}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-secondary);">${r.date.split('T')[0]} · ${r.hospital} · ${r.size}</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:4px;">${r.summary}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="window.open('${r.fileUrl}', '_blank')">View</button>
        </div>
      </div>`;
    }).join('');
    return `<div class="mb-6" data-year="${year}">
      <div style="font-size:0.85rem;font-weight:700;color:var(--text-secondary);margin-bottom:12px;display:flex;align-items:center;gap:10px;">
        <span>${year}</span><span style="flex:1;height:1px;background:var(--glass-border2);display:block;"></span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">${cards}</div>
    </div>`;
  }).join('');

  return `
  <div class="section-header flex justify-between items-center">
    <div>
      <div class="section-title">📁 My Medical Records</div>
      <div class="section-sub">${records.length} documents securely stored on IPFS</div>
    </div>
    <button class="btn btn-primary" onclick="openUploadModal()">+ Upload Record</button>
  </div>
  <div class="card mb-4" style="padding:12px 16px;">
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <span class="badge badge-slate" style="cursor:pointer;padding:6px 14px;" onclick="filterRecords('all',this)">All (${records.length})</span>
      <span class="badge badge-blue" style="cursor:pointer;padding:6px 14px;" onclick="filterRecords('blue',this)">Lab Reports</span>
      <span class="badge badge-green" style="cursor:pointer;padding:6px 14px;" onclick="filterRecords('green',this)">Prescriptions</span>
      <span class="badge badge-purple" style="cursor:pointer;padding:6px 14px;" onclick="filterRecords('purple',this)">Imaging</span>
    </div>
  </div>
  <div id="records-list">${yearBlocks || '<div style="color:var(--text-muted);text-align:center;padding:20px;">No records found. Upload one!</div>'}</div>`;
}

function filterRecords(colorType) {
  document.querySelectorAll('.record-item').forEach(item => {
    item.style.display = (colorType === 'all' || item.dataset.type === colorType) ? '' : 'none';
  });
}

// ── Reminders ──
function patientReminders() {
  const reminders = MediSyncDB.getReminders();
  const now = new Date();

  const cards = reminders.length === 0
    ? `<div class="card text-center" style="padding:48px;">
        <div style="font-size:2.5rem;margin-bottom:12px;">🔕</div>
        <div style="font-weight:700;font-size:1rem;">No reminders set</div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:6px;">Click "+ Add Reminder" to set your first medication alarm</div>
       </div>`
    : reminders.map(r => renderReminderCard(r)).join('');

  return `
  <div class="section-header flex justify-between items-center">
    <div>
      <div class="section-title">🔔 Medication Reminders</div>
      <div class="section-sub">Daily alarms with audio alerts — never miss a dose</div>
    </div>
    <button class="btn btn-primary" onclick="openAddReminderModal()">+ Add Reminder</button>
  </div>

  <div class="card mb-4" style="display:flex;align-items:center;gap:14px;padding:16px 20px;background:linear-gradient(135deg,rgba(5,150,105,0.12),rgba(13,148,136,0.06));border-color:rgba(16,185,129,0.2);">
    <div style="font-size:1.6rem;">🕐</div>
    <div>
      <div style="font-weight:700;font-family:var(--font-display);font-size:1.05rem;">${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);">Reminders active — alarm sounds when it's time to take medication</div>
    </div>
    <div style="margin-left:auto;"><span class="badge badge-green">🔔 Reminders ON</span></div>
  </div>

  <div id="reminders-list" style="display:flex;flex-direction:column;gap:12px;">${cards}</div>

  <div class="card mt-4" style="background:var(--amber-light);border-color:rgba(245,158,11,0.25);display:flex;align-items:center;gap:12px;padding:16px 20px;">
    <span class="bell-icon" style="font-size:1.5rem;">🔔</span>
    <div>
      <div style="font-weight:600;font-size:0.9rem;">Test Alarm</div>
      <div style="font-size:0.78rem;color:var(--text-secondary);">Fire a test alarm to verify your device audio is working</div>
    </div>
    <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="testAlarm()">Ring Now</button>
  </div>`;
}

function renderReminderCard(r) {
  const slots = Object.keys(r.taken);
  const slotBtns = slots.map(slot =>
    `<button class="btn btn-sm ${r.taken[slot] ? 'btn-success' : 'btn-ghost'}" id="rem-btn-${r.id}-${slot}" onclick="markTaken('${r.id}','${slot}',this)">${r.taken[slot] ? '✓ Taken' : 'Mark ' + slot.charAt(0).toUpperCase() + slot.slice(1)}</button>`
  ).join('');

  return `<div class="card" id="reminder-${r.id}" style="border-left:3px solid ${r.active ? 'var(--amber)' : 'rgba(100,116,139,0.3)'};">
    <div style="display:flex;align-items:center;gap:12px;">
      <span class="bell-icon" style="font-size:1.5rem;">${r.active ? '🔔' : '🔕'}</span>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;flex-wrap:wrap;">
          <span style="font-weight:700;font-size:0.95rem;">${r.medicine}</span>
          <span class="badge badge-${r.active ? 'amber' : 'slate'}">${r.active ? 'Active' : 'Paused'}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--text-secondary);">${r.dose} · ${r.times.join(', ')}</div>
      </div>
      <button class="btn btn-ghost btn-sm" style="flex-shrink:0;" onclick="toggleReminder('${r.id}')">${r.active ? 'Pause' : 'Resume'}</button>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">${slotBtns}</div>
  </div>`;
}

function initReminders() {
  if (window.ReminderEngine) ReminderEngine.scheduleAll(MediSyncDB.getReminders());
}

function testAlarm() {
  const reminders = MediSyncDB.getReminders();
  if (window.ReminderEngine) {
    if (reminders.length > 0) ReminderEngine.scheduleDemo(reminders[0], 1);
    else ReminderEngine.playAlarm(2);
    Toast.show('Test alarm', 'Alarm will ring in 1 second...', 'info', 2000);
  }
}

function markTaken(remId, slot, btn) {
  MediSyncDB.markMedTaken(remId, slot);
  if (btn) { btn.textContent = '✓ Taken'; btn.className = 'btn btn-sm btn-success'; }
  Toast.show('Medication logged', `${slot} dose marked as taken`, 'success', 3000);
}

function toggleReminder(remId) {
  const rem = MediSyncDB.toggleReminder(remId);
  if (!rem) return;
  const el = document.getElementById(`reminder-${remId}`);
  if (el) { const w = document.createElement('div'); w.innerHTML = renderReminderCard(rem); el.replaceWith(w.firstElementChild); }
  if (window.ReminderEngine) ReminderEngine.scheduleAll(MediSyncDB.getReminders());
  Toast.show(rem.active ? 'Reminder resumed' : 'Reminder paused', rem.medicine, 'info', 2500);
}

function addReminderModalHTML() {
  return `<div class="modal-overlay" id="add-reminder-modal"><div class="modal">
    <div class="modal-header"><div class="modal-title">Add Medication Reminder</div><button class="modal-close" onclick="Modal.close('add-reminder-modal')">✕</button></div>
    <div class="form-group"><label class="form-label">Medicine Name</label><input class="form-control" id="rem-name" placeholder="e.g. Metformin 500mg"></div>
    <div class="form-group"><label class="form-label">Dose</label><input class="form-control" id="rem-dose" placeholder="e.g. 1 tablet"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Time 1</label><input class="form-control" id="rem-time1" type="time" value="08:00"></div>
      <div class="form-group"><label class="form-label">Time 2 (optional)</label><input class="form-control" id="rem-time2" type="time"></div>
    </div>
    <div class="form-group"><label class="form-label">Link to Report (optional)</label><select class="form-control" id="rem-report"><option value="">-- No linked report --</option></select></div>
    <div style="display:flex;gap:10px;margin-top:20px;">
      <button class="btn btn-primary w-full" onclick="addReminder()">Save Reminder</button>
      <button class="btn btn-ghost" onclick="Modal.close('add-reminder-modal')">Cancel</button>
    </div>
  </div></div>`;
}

function openAddReminderModal() {
  const records = serverRecords.filter(r => r.type === 'Prescription' || r.type === 'Lab Report');
  const sel = document.getElementById('rem-report');
  if (sel) sel.innerHTML = '<option value="">-- No linked report --</option>' + records.map(r => `<option value="${r.id}">${r.title}</option>`).join('');
  ['rem-name','rem-dose','rem-time2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const t1 = document.getElementById('rem-time1'); if (t1) t1.value = '08:00';
  Modal.open('add-reminder-modal');
}

function addReminder() {
  const name   = (document.getElementById('rem-name')?.value || '').trim();
  const dose   = (document.getElementById('rem-dose')?.value || '').trim() || '1 unit';
  const t1     = document.getElementById('rem-time1')?.value || '';
  const t2     = document.getElementById('rem-time2')?.value || '';
  const report = document.getElementById('rem-report')?.value || '';
  if (!name) { Toast.show('Error', 'Please enter medicine name', 'warning'); return; }
  if (!t1)   { Toast.show('Error', 'Please set at least one reminder time', 'warning'); return; }
  const times = [t1, ...(t2 ? [t2] : [])];
  const taken = {};
  times.forEach((_,i) => { taken[['morning','evening','night'][i] || ('dose'+i)] = false; });
  const rem = MediSyncDB.addReminder({ medicine: name, dose, times, taken, linkedReport: report, frequency: times.length > 1 ? 'twice-daily' : 'once-daily' });
  Modal.close('add-reminder-modal');
  const list = document.getElementById('reminders-list');
  if (list) {
    const empty = list.querySelector('.card');
    if (empty && empty.textContent.includes('No reminders')) list.innerHTML = '';
    list.insertAdjacentHTML('afterbegin', renderReminderCard(rem));
  }
  if (window.ReminderEngine) ReminderEngine.scheduleAll(MediSyncDB.getReminders());
  Toast.show('Reminder added', `${name} alarm set for ${times.join(' & ')}`, 'success');
}

// ── Profile ──
function patientProfile() {
  const p = MediSyncDB.getPatient();
  const rows = [['Age', p.age + ' years'], ['Gender', p.gender], ['Date of Birth', Utils.formatDate(p.dob)], ['Phone', p.phone], ['Email', p.email], ['Address', p.address]];
  return `
  <div class="section-header"><div class="section-title">👤 My Profile</div></div>
  <div class="grid-2">
    <div class="card">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        <div class="avatar" style="width:60px;height:60px;font-size:1.2rem;">${p.avatar}</div>
        <div>
          <div style="font-family:var(--font-display);font-weight:700;font-size:1.1rem;">${p.name}</div>
          <div style="font-size:0.85rem;color:var(--text-secondary);">${p.id}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${rows.map(([k,v]) => `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="font-size:0.8rem;color:var(--text-secondary);font-weight:500;">${k}</span>
          <span style="font-size:0.875rem;font-weight:500;">${v}</span>
        </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title mb-3">Emergency Information</div>
      <div style="background:var(--red-light);border:1px solid rgba(239,68,68,0.15);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px;">
        <div style="font-size:0.7rem;font-weight:700;color:var(--red);margin-bottom:6px;">EMERGENCY CONTACT</div>
        <div style="font-weight:600;">${p.emergencyContact.name}</div>
        <div style="font-size:0.875rem;">${p.emergencyContact.phone}</div>
      </div>
      <div style="background:var(--amber-light);border:1px solid rgba(245,158,11,0.15);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px;">
        <div style="font-size:0.7rem;font-weight:700;color:var(--amber);margin-bottom:6px;">ALLERGIES</div>
        <div style="font-weight:600;">${p.allergies.join(', ')}</div>
      </div>
      <div style="background:var(--blue-light);border:1px solid rgba(59,130,246,0.15);border-radius:var(--radius-sm);padding:14px;">
        <div style="font-size:0.7rem;font-weight:700;color:var(--blue);margin-bottom:6px;">CHRONIC CONDITIONS</div>
        <div style="font-weight:600;">${p.chronicConditions.join(', ')}</div>
      </div>
    </div>
  </div>`;
}

// ── Upload Modal (Real AI + IPFS Integration) ──
function uploadModalHTML() {
  return `<div class="modal-overlay" id="upload-modal"><div class="modal">
    <div class="modal-header"><div class="modal-title">Upload Medical Record</div><button class="modal-close" onclick="closeUploadModal()">✕</button></div>
    <div class="form-group"><label class="form-label">Document Category</label>
      <select class="form-control" id="upload-category" style="background:rgba(255,255,255,0.05);">
        <option>Lab Report</option><option>Prescription</option><option>Imaging</option><option>Discharge Summary</option>
      </select>
    </div>
    <div class="upload-zone" id="upload-zone" onclick="document.getElementById('file-input').click()">
      <div class="upload-icon">📄</div>
      <div class="upload-text">Click to upload or drag & drop</div>
      <div class="upload-hint">PDF, JPG, PNG — up to 10 MB</div>
    </div>
    <input type="file" id="file-input" style="display:none" accept=".pdf,.jpg,.png,.jpeg" onchange="handleFileUpload(this)">
    <div id="upload-status" style="margin-top:12px;display:none;"></div>
    <div style="margin-top:14px;padding:10px;background:var(--blue-light);border:1px solid rgba(59,130,246,0.15);border-radius:var(--radius-sm);font-size:0.8rem;color:#93C5FD;">🤖 AI will auto-detect document type, date, and hospital from file content.</div>
  </div></div>`;
}

function openUploadModal() {
  const s = document.getElementById('upload-status'); if (s) { s.style.display='none'; s.innerHTML=''; }
  const f = document.getElementById('file-input'); if (f) f.value='';
  const z = document.getElementById('upload-zone'); if (z) { z.style.pointerEvents=''; z.style.opacity=''; }
  Modal.open('upload-modal');
}
function closeUploadModal() { Modal.close('upload-modal'); }

// 🔥 OPTIMIZATION: Compress Image before sending to Backend ---
async function compressImage(file, maxWidth = 1024) {
  if (!file.type.startsWith('image/')) return file; // Skip PDFs

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scaleSize = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to highly compressed JPEG
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', 0.7); 
      };
    };
  });
}

// 🔥 UPLOAD LOGIC WITH LOCK & COMPRESSION 🔥
async function handleFileUpload(input) {
  if (isUploading) return; 
  
  let file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { Toast.show('File too large', 'Max 10 MB', 'warning'); return; }

  isUploading = true; 
  
  const z = document.getElementById('upload-zone');
  if (z) { z.style.pointerEvents = 'none'; z.style.opacity = '0.55'; }
  const category = document.getElementById('upload-category').value;
  const status = document.getElementById('upload-status');
  status.style.display = 'block';

  status.innerHTML = `<div style="background:var(--amber-light);border:1px solid rgba(245,158,11,0.15);border-radius:var(--radius-sm);padding:10px 12px;font-size:0.85rem;">⏳ Optimizing & Analyzing...<div style="height:4px;background:rgba(255,255,255,0.05);border-radius:99px;margin-top:8px;overflow:hidden;"><div id="upload-bar" style="height:100%;background:linear-gradient(90deg,#2563EB,#7C3AED);width:20%;transition:width 0.35s ease;border-radius:99px;"></div></div><div id="upload-step" style="font-size:0.72rem;color:var(--text-secondary);margin-top:5px;">Compressing file...</div></div>`;

  try {
    if (file.type.startsWith('image/')) {
        file = await compressImage(file);
    }
    
    document.getElementById('upload-bar').style.width = '60%';
    document.getElementById('upload-step').textContent = 'Sending to AI...';

    const formData = new FormData();
    formData.append('documentImage', file); 
    formData.append('category', category); 

    const response = await fetch('http://localhost:5001/api/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || "API Failed to process image.");
    }

    const bar = document.getElementById('upload-bar');
    const step = document.getElementById('upload-step');
    if (bar) bar.style.width = '100%';
    if (step) step.textContent = '✅ Analysis complete!';

    const aiData = result.data;

    setTimeout(async () => {
        status.innerHTML = `<div style="background:var(--green-light);border:1px solid rgba(16,185,129,0.15);border-radius:var(--radius-sm);padding:10px 12px;font-size:0.85rem;color:var(--text-primary);">✅ AI detected: <strong>${aiData.documentName || file.name}</strong> (${aiData.year || 'Unknown Year'}). Saved securely to DB!</div>`;
        
        await fetchRecordsFromServer();

        setTimeout(() => {
            Modal.close('upload-modal');
            Toast.show('Upload complete', `${aiData.documentName || file.name} added to your timeline`, 'success');
            if (patientTabState === 'overview' || patientTabState === 'records') renderPatientContent(patientTabState);
            input.value = '';
            isUploading = false; 
        }, 1800);
    }, 500);

  } catch (error) {
    console.error("Upload Error:", error);
    status.innerHTML = `<div style="background:var(--red-light);border:1px solid rgba(239,68,68,0.15);border-radius:var(--radius-sm);padding:10px 12px;font-size:0.85rem;color:var(--text-primary);">❌ Upload failed: ${error.message}. <br><br>*(Note: Ensure Backend is running or API limit might be reached)*</div>`;
    if (z) { z.style.pointerEvents = ''; z.style.opacity = ''; }
    input.value = '';
    isUploading = false; 
  }
}

// ── AI Chatbot ──
function patientChatbot() {
  const p = MediSyncDB.getPatient();
  const suggested = [
    'What does my HbA1c mean?',
    'Tell me about my medications',
    'Explain my kidney function results',
    'Am I allergic to common antibiotics?',
    'What does my blood pressure reading mean?',
    'What foods should I eat for diabetes?',
  ];

  return `
  <div class="section-header flex justify-between items-center">
    <div>
      <div class="section-title">🤖 AI Health <span style="color:var(--blue);">Assistant</span></div>
      <div class="section-sub">Ask questions about your medical reports and health history</div>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="clearChat()">🔄 New Chat</button>
  </div>

  <div class="grid-2" style="gap:20px;align-items:flex-start;">
    <div class="card" style="display:flex;flex-direction:column;padding:0;overflow:hidden;">
      <div style="background:linear-gradient(135deg,rgba(13,23,45,0.95),rgba(20,30,60,0.9));padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--glass-border2);">
        <div style="width:34px;height:34px;background:linear-gradient(135deg,#2563EB,#7C3AED);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">🤖</div>
        <div>
          <div style="color:var(--text-primary);font-weight:700;font-size:0.88rem;">MediSync AI Assistant</div>
          <div style="color:var(--text-muted);font-size:0.68rem;">Context-aware · Your records integrated</div>
        </div>
        <div style="margin-left:auto;width:8px;height:8px;background:#22c55e;border-radius:50%;box-shadow:0 0 8px #22c55e;"></div>
      </div>
      <div class="chat-window" id="chat-window"></div>
      <div class="chat-input-wrap">
        <textarea class="form-control" id="chat-input" placeholder="Ask about your health records..." rows="1"
          style="resize:none;min-height:44px;max-height:100px;flex:1;"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChatMessage();}"></textarea>
        <button class="btn btn-primary btn-icon" id="chat-send-btn" onclick="sendChatMessage()">➤</button>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="card">
        <div class="card-header"><div class="card-title">💡 Suggested Questions</div></div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${suggested.map(q => `<button class="btn btn-ghost" style="justify-content:flex-start;text-align:left;font-size:0.8rem;padding:8px 12px;border:1px solid var(--glass-border2);" onclick="sendChatMessage('${q.replace(/'/g,"\\'")}')">💬 ${q}</button>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">📊 My Health Context</div></div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${[
            ['🩸','Blood Group', p.bloodGroup],
            ['🏥','Conditions', p.chronicConditions.join(', ')],
            ['⚠️','Allergies', p.allergies.join(', ')],
          ].map(([icon, label, val]) => `<div style="display:flex;gap:10px;align-items:center;">
            <span>${icon}</span>
            <div>
              <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;">${label}</div>
              <div style="font-size:0.82rem;font-weight:600;">${val}</div>
            </div>
          </div>`).join('')}
        </div>
        <div style="margin-top:12px;font-size:0.72rem;color:var(--text-muted);background:rgba(255,255,255,0.03);border-radius:8px;padding:8px 10px;">
          🤖 The AI uses your medical records as context for personalised responses.
        </div>
      </div>
    </div>
  </div>`;
}

function initChatbot() {
  if (!chatSession) {
    chatSession = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  }
  renderChatMessages();
  if (chatMessages.length === 0) {
    const p = MediSyncDB.getPatient();
    addBotMessage(`Hello ${p.name.split(' ')[0]}! 👋 I'm your **MediSync AI Health Assistant**.\n\nI have access to your medical history and can help you understand your reports, medications, and health conditions.\n\n**Try asking:**\n• "What does my HbA1c mean?"\n• "Tell me about my medications"`);
  }
}

function clearChat() {
  chatMessages = [];
  chatSession = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  renderChatMessages();
  initChatbot();
}

function addBotMessage(content) {
  chatMessages.push({ role: 'bot', content, ts: new Date().toISOString() });
  renderChatMessages();
}

function renderChatMessages() {
  const window_el = document.getElementById('chat-window');
  if (!window_el) return;
  const p = MediSyncDB.getPatient();
  window_el.innerHTML = chatMessages.map(msg => {
    const isBot = msg.role === 'bot';
    const avatar = isBot ? '🤖' : p.avatar;
    const bubble = isBot ? Utils.formatMarkdown(msg.content) : msg.content;
    return `<div class="chat-msg ${isBot ? 'bot' : 'user'}">
      <div class="chat-avatar ${isBot ? 'bot' : 'user'}">${avatar}</div>
      <div class="chat-bubble">${bubble}</div>
    </div>`;
  }).join('');
  window_el.scrollTop = window_el.scrollHeight;
}

async function sendChatMessage(predefined) {
  if (isChatbotTyping) return; 

  const input = document.getElementById('chat-input');
  const msg = (predefined || input?.value || '').trim();
  if (!msg) return;
  
  if (input) input.value = ''; 
  isChatbotTyping = true; 

  chatMessages.push({ role: 'user', content: msg });
  renderChatMessages();

  const chatWin = document.getElementById('chat-window');
  const typing = document.createElement('div');
  typing.className = 'chat-msg bot'; typing.id = 'typing-indicator';
  typing.innerHTML = '<div class="chat-avatar bot">🤖</div><div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>';
  if (chatWin) {
    chatWin.appendChild(typing);
    chatWin.scrollTop = chatWin.scrollHeight;
  }

  try {
    const p = MediSyncDB.getPatient();
    let optimizedContext = "No specific records found.";
    if (p) {
        optimizedContext = JSON.stringify({
            name: p.name, age: p.age, blood: p.bloodGroup,
            allergies: p.allergies, conditions: p.chronicConditions
        });
    }

    const response = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: msg, userHealthContext: optimizedContext })
    });

    const data = await response.json();
    typing.remove(); 

    if (data.success) {
        chatMessages.push({ role: 'bot', content: data.reply });
    } else {
        throw new Error(data.message || "Failed to get response from AI server.");
    }
    
    renderChatMessages();
    
  } catch (error) {
    console.error("Chat API Error:", error);
    typing.remove();
    chatMessages.push({ role: 'bot', content: `⚠️ **Connection Error:** ${error.message}. \n\n*(Note: Wait a moment for API limits to reset or ensure backend is running on port 5001).*` });
    renderChatMessages();
  } finally {
    isChatbotTyping = false; 
  }
}

// ═══════════════════════════════════════════════════
// SMART TEXT QR (Clean Popup + Clickable Call)
// ═══════════════════════════════════════════════════

function patientQR() {
  const p = MediSyncDB.getPatient();
  const rows = [
    ['🩸 Blood Group', p.bloodGroup, 'red'],
    ['⚠️ Allergies', p.allergies.join(', '), 'red'],
    ['🏥 Conditions', p.chronicConditions.join(', '), 'blue'],
    ['📞 Emergency', p.emergencyContact.name + ' — ' + p.emergencyContact.phone, 'green'],
    ['💊 Doctor Note', 'Metformin 500mg. Do NOT give Penicillin.', 'amber'],
  ].map(([label, value, color]) => `
    <div style="background:var(--${color}-light);border:1px solid rgba(${color === 'red' ? '239,68,68' : color === 'blue' ? '59,130,246' : color === 'green' ? '16,185,129' : '245,158,11'},0.15);border-radius:var(--radius-sm);padding:10px 14px;">
      <div style="font-size:0.7rem;font-weight:700;color:var(--${color});text-transform:uppercase;letter-spacing:0.05em;">${label}</div>
      <div style="font-weight:600;color:var(--text-primary);font-size:0.875rem;margin-top:2px;">${value}</div>
    </div>`).join('');

  return `
  <div class="section-header">
    <div class="section-title">📱 My Emergency QR Code</div>
    <div class="section-sub">Scan to reveal critical medical info — works 100% offline</div>
  </div>

  <div class="grid-2">
    <div class="card text-center">
      <div style="margin:0 auto 16px;width:220px;height:220px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:10px;">
        <div id="qr-code-container"></div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;">Patient ID: <strong id="patient-id-display" style="color:var(--text-primary);">${p.id}</strong></div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn btn-primary btn-sm" onclick="printQRCard()">🖨 Print Card</button>
        <button class="btn btn-ghost btn-sm" onclick="downloadQRCard()">⬇ Download</button>
      </div>
      <div style="padding:12px;background:var(--green-light);border:1px solid rgba(16,185,129,0.2);border-radius:var(--radius-sm);text-align:left;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:4px;">📡 SMART TEXT QR READY</div>
        <div style="font-size:0.78rem;color:var(--text-secondary);">Offline lo scan cheyagane popup osthundi, number tap chesthe direct call velthundi!</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="card">
        <div class="card-title mb-4">Data linked to this QR</div>
        <div style="display:flex;flex-direction:column;gap:10px;">${rows}</div>
      </div>
      
      <div id="simulate-btn-container"></div>
      
    </div>
  </div>

  <div class="card mt-4" style="background:var(--amber-light);border-color:rgba(245,158,11,0.2);">
    <div style="font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px;"><span>💡</span> How to use your Emergency QR</div>
    <div style="font-size:0.8rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:5px;">
      <div>• Save as your phone lock-screen wallpaper so anyone can see it without unlocking</div>
      <div>• Print as a wallet card — carries all your critical info even without a phone</div>
      <div>• Paramedics scan it before treatment for instant access to allergies and conditions</div>
      <div>• Update your QR whenever your health information changes</div>
    </div>
  </div>`;
}

function generatePatientQR() {
  const p = MediSyncDB.getPatient();
  
  const currentHost = window.location.host; 
  // Make sure the URL points to scanner.html properly
  const isFrontendDir = window.location.pathname.includes('/frontend');
  const basePath = isFrontendDir ? 'scanner.html' : 'frontend/scanner.html';
  const scanPortalUrl = `http://${currentHost}/${basePath}?patientId=${p.id}`;
  
  const smartTextData = `🚨 EMERGENCY INFO 🚨\n\nName: ${p.name}\nBlood: ${p.bloodGroup}\nAllergies: ${p.allergies.join(', ')}\n\n[ TAP NUMBER BELOW TO CALL ]\n📞 ${p.emergencyContact.phone}\n\nOnline Portal:\n${scanPortalUrl}`;

  const qrContainer = document.getElementById('qr-code-container');
  if (qrContainer) {
    qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(smartTextData)}" alt="Patient QR Code" style="width:200px; height:200px; border-radius:8px;">`;
  }

  const simulateBtnContainer = document.getElementById('simulate-btn-container'); 
  if (simulateBtnContainer) {
    simulateBtnContainer.innerHTML = `
      <div class="card" style="border-color:rgba(239,68,68,0.25);background:rgba(20,5,5,0.5);">
        <div class="card-title mb-3" style="color: var(--red);">🚨 Emergency / Scan Simulation</div>
        <div style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:14px;">Laptop lo test cheyadaniki kinda button nokkandi. Tunnel akkaraledu.</div>
        <button class="btn btn-danger w-full" onclick="window.open('${scanPortalUrl}', '_blank')">Simulate Online Scan →</button>
      </div>
    `;
  }
}

// ═══════════════════════════════════════════════════
// PRINT & DOWNLOAD QR CARD LOGIC (Clean Implementation)
// ═══════════════════════════════════════════════════

window.printQRCard = function() {
    const qrImg = document.querySelector('#qr-code-container img') || 
                  document.querySelector('img[src^="data:image/png;base64"]') || 
                  document.querySelector('canvas');
                  
    if (!qrImg) {
        alert("QR Code is not generated yet. Please wait.");
        return;
    }
    
    const qrSrc = qrImg.src || qrImg.toDataURL();
    const patientIdEl = document.getElementById('patient-id-display');
    const patientId = patientIdEl ? patientIdEl.textContent.trim() : 'P-24114045';

    const printWindow = window.open('', '', 'width=600,height=600');
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Print MediSync QR Card</title>
            <style>
                body { font-family: 'Arial', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #ffffff; }
                .card { border: 2px solid #1a1a2e; border-radius: 16px; padding: 30px; text-align: center; width: 320px; }
                .card h2 { margin: 0 0 5px 0; color: #1a1a2e; font-size: 24px; }
                .card p.sub { margin: 0 0 20px 0; color: #666; font-size: 12px; }
                .card img { width: 250px; height: 250px; margin-bottom: 20px; }
                .card p.id { margin: 0; font-size: 18px; font-weight: bold; color: #1a1a2e; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>MediSync</h2>
                <p class="sub">Emergency Medical Card</p>
                <img src="${qrSrc}" />
                <p class="id">Patient ID: ${patientId}</p>
            </div>
            <script>
                window.onload = function() { 
                    setTimeout(() => { window.print(); window.close(); }, 500); 
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

window.downloadQRCard = function() {
    const qrImg = document.querySelector('#qr-code-container img') || 
                  document.querySelector('img[src^="data:image/png;base64"]') || 
                  document.querySelector('canvas');
                  
    if (!qrImg) {
        alert("QR Code is not generated yet.");
        return;
    }

    const patientIdEl = document.getElementById('patient-id-display');
    const patientId = patientIdEl ? patientIdEl.textContent.trim() : 'P-24114045';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 500;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Text
    ctx.fillStyle = '#1a1a2e';
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('MediSync', 200, 70);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText('Emergency Medical Card', 200, 100);

    // Image
    const img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.src = qrImg.src || qrImg.toDataURL();
    
    img.onload = () => {
        ctx.drawImage(img, 75, 130, 250, 250);
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 22px Arial';
        ctx.fillText(`Patient ID: ${patientId}`, 200, 430);

        const link = document.createElement('a');
        link.download = `MediSync_Card_${patientId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        if (typeof Toast !== 'undefined' && Toast.show) {
            Toast.show('Downloaded', 'QR Card saved to your device.', 'success');
        } else {
            alert('QR Card downloaded successfully!');
        }
    };
};

// Expose
window.loadPatientDashboard = loadPatientDashboard;
window.renderPatientContent = renderPatientContent;
window.markTaken = markTaken;
window.markTakenOverview = markTakenOverview;
window.toggleReminder = toggleReminder;
window.addReminder = addReminder;
window.openAddReminderModal = openAddReminderModal;
window.testAlarm = testAlarm;
window.filterRecords = filterRecords;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.handleFileUpload = handleFileUpload;
window.generatePatientQR = generatePatientQR;
window.initReminders = initReminders;
window.sendChatMessage = sendChatMessage;
window.clearChat = clearChat;