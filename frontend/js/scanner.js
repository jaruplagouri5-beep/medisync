// ═══════════════════════════════════════════════════
// MediSync Scanner Portal - CLEAN UI & SMART EXTRACT
// ═══════════════════════════════════════════════════

'use strict';

const TARGET_PHONE_NUMBER = "+919032538213";

const urlParams = new URLSearchParams(window.location.search);
let patientId = urlParams.get('patientId') || ''; 
let currentDoctorName = "Doctor"; 
let selectedInjuries = new Set();
let html5QrcodeScanner = null;

const Toast = {
  show: (title, msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    if(!container) return alert(`${title}: ${msg}`);
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</div><div><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
  }
};

// ─── UI VIEW CONTROLLER ───
document.addEventListener('DOMContentLoaded', () => {
    if (patientId) {
        proceedWithID(patientId);
    } else {
        showView('scanner-init-view');
    }
});

function showView(viewId) {
    const views = ['scanner-init-view', 'camera-section', 'manual-section', 'flow-selection', 'triage-form-container'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    
    const target = document.getElementById(viewId);
    if(target) target.style.display = 'block';
}

function resetScanner() {
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    patientId = "";
    document.getElementById('manual-patient-id').value = "";
    showView('scanner-init-view');
}

// ─── CAMERA SCANNER LOGIC ───
function startAutoScanner() {
    showView('camera-section');
    if (typeof Html5QrcodeScanner === 'undefined') {
        Toast.show('Error', 'Scanner library missing. Please use Manual Entry.', 'error');
        resetScanner();
        return;
    }
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: {width: 250, height: 250}, rememberLastUsedCamera: true }, false);
    html5QrcodeScanner.render(onScanSuccess, () => {});
}

function onScanSuccess(decodedText) {
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    
    let id = decodedText;
    
    // 🔥 FIX: Extract ONLY the Patient ID from the massive QR code string
    const match = decodedText.match(/patientId=([a-zA-Z0-9-]+)/);
    if (match && match[1]) {
        id = match[1];
    }

    if (id) {
        Toast.show('QR Scanned!', `Proceeding securely...`, 'success');
        proceedWithID(id);
    }
}

// ─── MANUAL ENTRY LOGIC ───
function showManualEntry() {
    showView('manual-section');
    setTimeout(() => document.getElementById('manual-patient-id').focus(), 100);
}

function handleManualSubmit() {
    const id = document.getElementById('manual-patient-id').value.trim();
    if (!id) return Toast.show('Required', 'Please enter a Patient ID.', 'warning');
    proceedWithID(id);
}

// ─── UNIFIED FLOW ───
function proceedWithID(id) {
    patientId = id;
    showView('flow-selection');
    
    document.getElementById('doctor-section').style.display = 'block';
    document.getElementById('doctor-form').style.display = 'none';
}

function showDoctorForm() {
  document.getElementById('doctor-section').style.display = 'none';
  document.getElementById('doctor-form').style.display = 'block';
}

// ─── DOCTOR OTP FLOW ───
let isRequestingOTP = false;

async function requestDoctorAccess() {
  if(isRequestingOTP) return;

  const docName = document.getElementById('doc-name-input').value.trim();
  if (!docName) return Toast.show('Required', 'Please enter your Doctor / Clinic Name.', 'error');

  currentDoctorName = docName;
  isRequestingOTP = true;
  Toast.show('Sending Request...', `Dispatching SMS to ${TARGET_PHONE_NUMBER}`, 'info');

  try {
    const response = await fetch("http://localhost:5001/request-access", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientPhone: TARGET_PHONE_NUMBER, doctorName: docName, patientId: patientId }),
    });

    const data = await response.json();
    if (data.success) {
      Toast.show('OTP Sent', `SMS sent successfully.`, 'success');
      renderOTPUI(false);
    } else {
      Toast.show('Twilio Limit Hit', 'Using Local Demo OTP: 1234', 'warning');
      renderOTPUI(true);
    }
  } catch (error) {
    Toast.show('Backend Offline', 'Using Local Demo OTP: 1234', 'error');
    renderOTPUI(true);
  } finally {
    isRequestingOTP = false;
  }
}

function renderOTPUI(isDemoMode) {
    let msg = isDemoMode ? `<span style="color:var(--amber);">SMS Limit Hit. Local Demo OTP is: <b>1234</b></span>` : `An SMS with a 4-digit code was sent securely.`;

    document.getElementById('doctor-form').innerHTML = `
      <div style="text-align:center;">
        <div style="font-size: 2.5rem; margin-bottom:10px;">🔐</div>
        <h3 style="color:var(--text-primary); font-family:var(--font-display);">Enter Patient OTP</h3>
        <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:15px;">${msg}</p>
        <input type="text" id="otp-input" class="form-control mb-4" placeholder="••••" maxlength="4" style="text-align:center; font-size:1.5rem; letter-spacing:8px; font-weight:bold; color:white; background:transparent;">
        <button class="btn btn-primary w-full btn-lg" style="justify-content:center;" id="verify-btn" onclick="verifyOTP(${isDemoMode})">Verify & Open Records</button>
      </div>
    `;
}

let isVerifyingOTP = false;

async function verifyOTP(isDemoMode) {
  if(isVerifyingOTP) return;

  const enteredOtp = document.getElementById('otp-input').value.trim();
  if (enteredOtp.length !== 4) return Toast.show('Invalid', 'Enter the 4-digit OTP.', 'error');

  isVerifyingOTP = true;
  const btn = document.getElementById('verify-btn');
  btn.textContent = 'Verifying...';

  if (isDemoMode && enteredOtp === '1234') {
      Toast.show('Access Granted', 'Demo bypass successful.', 'success');
      localStorage.setItem('medisync_current_doctor', currentDoctorName);
      setTimeout(() => { window.location.href = `doctor-view.html?patientId=${patientId}`; }, 1000);
      return;
  }

  try {
    const response = await fetch("http://localhost:5001/verify-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: patientId, enteredOtp }),
    });

    const data = await response.json();
    if (data.success) {
      Toast.show('Access Granted', 'Opening medical records...', 'success');
      localStorage.setItem('medisync_current_doctor', currentDoctorName);
      setTimeout(() => { window.location.href = `doctor-view.html?patientId=${patientId}`; }, 1000);
    } else {
      Toast.show('Access Denied', 'Incorrect OTP entered.', 'error');
      btn.textContent = 'Verify & Open Records';
    }
  } catch (error) {
    Toast.show('Error', 'Verification failed.', 'error');
    btn.textContent = 'Verify & Open Records';
  } finally {
    isVerifyingOTP = false;
  }
}

// ─── EMERGENCY FLOW (SOS) ───
let isEmergencyTriggered = false;

function triggerEmergency() {
  if(isEmergencyTriggered) return;
  isEmergencyTriggered = true;
  Toast.show('Emergency Triggered', 'Getting exact location...', 'info');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const locationLink = `http://googleusercontent.com/maps.google.com/maps?q=${lat},${lng}`;
        sendAlert(locationLink);
      },
      (error) => {
        sendAlert("Location access denied by user."); 
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    sendAlert("Location not supported by browser.");
  }
}

async function sendAlert(locationStr) {
  const alertMessage = `🚨 EMERGENCY ALERT 🚨\nPatient ${patientId} scanned in emergency!\n\nView Location:\n${locationStr}`;

  try {
    const response = await fetch("http://localhost:5001/send-alert", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: TARGET_PHONE_NUMBER, message: alertMessage }),
    });

    const data = await response.json();
    if (data.success) {
      renderEmergencyUI(false);
    } else {
      renderEmergencyUI(true); 
    }
  } catch (error) {
    renderEmergencyUI(true); 
  }
}

function renderEmergencyUI(hasError = false) {
    let pBlood = 'Unknown'; let pAllergies = 'Unknown'; let pConditions = 'Unknown';
    try {
        const stored = localStorage.getItem('medisync_patient@demo.com_patient');
        if(stored) {
            const p = JSON.parse(stored);
            if(p.bloodGroup) pBlood = p.bloodGroup;
            if(p.allergies) pAllergies = p.allergies.join(', ');
            if(p.chronicConditions) pConditions = p.chronicConditions.join(', ');
        }
    } catch(e) {}

    const mainCard = document.getElementById('main-scanner-card');
    if (mainCard) {
        mainCard.style.maxWidth = "500px";
        mainCard.innerHTML = `
        <div style="text-align:left;">
          <div style="text-align:center; color: var(--red); margin-bottom: 20px;">
            <div style="font-size: 3.5rem; margin-bottom:10px; animation: livePulse 1.5s infinite;">🚨</div>
            <h2 style="font-family: var(--font-display);">SOS Active</h2>
            <p style="font-size:0.85rem; color:var(--text-secondary);">${hasError ? 'Twilio Limit Hit. Proceeding in offline mode.' : 'Guardian and nearest hospital notified.'}</p>
          </div>
          
          <div style="background:var(--red-light); border:1px solid rgba(239,68,68,0.2); border-radius:var(--radius-sm); padding:16px; margin-bottom:20px;">
            <div style="font-size:0.75rem; font-weight:800; color:var(--red); margin-bottom:8px; text-transform:uppercase;">CRITICAL MEDICAL INFO</div>
            <div style="font-weight:600; color:var(--text-primary); font-size:1rem;">Patient ID: <span style="color:#FFF;">${patientId}</span></div>
            <div style="font-weight:600; color:var(--text-primary); margin-top:6px; font-size:0.9rem;">Blood Group: <span style="color:#FCA5A5;">${pBlood}</span></div>
            <div style="font-weight:600; color:var(--text-primary); margin-top:6px; font-size:0.9rem;">Allergies: ${pAllergies}</div>
            <div style="font-weight:600; color:var(--text-primary); margin-top:6px; font-size:0.9rem;">Conditions: ${pConditions}</div>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
             <a href="tel:${TARGET_PHONE_NUMBER}" class="btn btn-primary w-full btn-lg" style="justify-content:center; background:var(--blue);">📞 Call Guardian</a>
             <a href="tel:108" class="btn btn-danger w-full btn-lg" style="justify-content:center;">🚑 Call Ambulance (108)</a>
             <button class="btn btn-ghost w-full btn-lg" style="justify-content:center; border: 1px solid var(--glass-border2);" onclick="openTriageForm()">🏥 Alert Nearby Hospital</button>
          </div>
        </div>
      `;
    }
}

// ─── TRIAGE LOGIC (UC5) ───
function openTriageForm() {
  document.getElementById('main-scanner-card').style.display = 'none';
  const triageContainer = document.getElementById('triage-form-container');
  triageContainer.style.display = 'block';

  let pName = patientId; let pBlood = ''; let pAllergies = '';
  try {
      const stored = localStorage.getItem('medisync_patient@demo.com_patient');
      if(stored) {
          const p = JSON.parse(stored);
          if(p.name) pName = p.name;
          if(p.bloodGroup) pBlood = p.bloodGroup;
          if(p.allergies) pAllergies = p.allergies.join(', ');
      }
  } catch(e) {}

  const injuryOptions = ['Head Injury', 'Chest Wound', 'Heavy Bleeding', 'Spinal Injury', 'Cardiac Arrest', 'Difficulty Breathing', 'Burns', 'Fracture', 'Unconscious', 'Allergic Reaction', 'Seizure', 'Shock'];

  triageContainer.innerHTML = `
  <button class="btn btn-ghost" style="margin-bottom:16px;font-size:0.85rem;" onclick="closeTriageForm()">← Back to SOS</button>

  <div class="section-header" style="margin-bottom: 24px;">
    <h2 style="font-family: var(--font-display); color: var(--text-primary); font-size: 1.5rem;">🏥 Pre-Arrival Triage Alert (UC5)</h2>
  </div>

  <div class="grid-2" style="align-items:start;">
    <div class="card" style="text-align: left;">
      <h3 style="font-family: var(--font-display); font-size: 1.2rem; margin-bottom: 16px;">Patient Condition</h3>
      
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label" style="display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Patient Identity</label>
        <input class="form-control w-full" id="triage-patient" value="${pName}" placeholder="Name or 'Unknown'">
      </div>

      <div style="display: flex; gap: 12px; margin-bottom: 12px;">
        <div style="flex: 1;">
          <label class="form-label" style="display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Blood Group</label>
          <input class="form-control w-full" id="triage-blood" value="${pBlood}" placeholder="e.g. B+">
        </div>
        <div style="flex: 1;">
          <label class="form-label" style="display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">ETA</label>
          <select class="form-control w-full" id="triage-eta">
            <option value="">Select ETA</option><option>5 min</option><option>10 min</option>
          </select>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label" style="display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Destination Hospital</label>
        <div style="display:flex;gap:8px;">
          <input class="form-control w-full" id="triage-hospital" placeholder="Hospital Name">
          <button class="btn btn-ghost" onclick="findNearbyHospitals(event)" style="white-space:nowrap; border:1px solid var(--glass-border);">📍 Find</button>
        </div>
        <div id="nearby-hospitals" style="margin-top:8px;display:none;">
          <div id="hospitals-list" style="max-height:120px;overflow-y:auto;border:1px solid var(--glass-border2);border-radius:var(--radius-sm);padding:8px;background:rgba(255,255,255,0.03);"></div>
        </div>
      </div>
      
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label" style="display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Priority</label>
        <select class="form-control w-full" id="triage-priority">
          <option value="">Select priority</option><option value="critical">🔴 Critical</option><option value="high">🟠 High</option>
        </select>
      </div>
    </div>

    <div class="card" style="text-align: left;">
      <h3 style="font-family: var(--font-display); font-size: 1.2rem; margin-bottom: 16px;">Select Injuries</h3>
      
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;" id="injury-chips">
        ${injuryOptions.map(inj => `
          <button class="btn btn-ghost btn-sm" style="border: 1px solid var(--glass-border); border-radius: 20px; font-size: 0.8rem;" onclick="toggleInjury('${inj}', this)">${inj}</button>
        `).join('')}
      </div>

      <button id="alert-hospital-btn" class="btn btn-danger w-full btn-lg" style="justify-content: center;" onclick="sendTriageAlert()">
        🚨 Alert Hospital Now
      </button>

      <div id="triage-sent" style="display:none;margin-top:12px;background:var(--green-light);border:1px solid rgba(16,185,129,0.4);border-radius:var(--radius-sm);padding:14px;text-align:center;">
        <div id="triage-sent-title" style="font-weight:700;color:var(--green);font-size:1rem;">✓ Hospital Alerted!</div>
        <div id="triage-sent-msg" style="font-size:0.82rem;color:var(--text-secondary);margin-top:4px;">Receiving hospital has your alert and is preparing.</div>
      </div>
    </div>
  </div>`;
}

function closeTriageForm() {
  document.getElementById('triage-form-container').style.display = 'none';
  document.getElementById('main-scanner-card').style.display = 'block';
  selectedInjuries.clear();
}

function toggleInjury(name, btn) {
  if (selectedInjuries.has(name)) {
    selectedInjuries.delete(name);
    btn.style.background = 'transparent'; btn.style.color = 'var(--text-primary)';
  } else {
    selectedInjuries.add(name);
    btn.style.background = 'var(--blue)'; btn.style.color = 'white';
  }
}

function findNearbyHospitals(event) {
  const btn = event.target;
  const originalText = btn.innerHTML;
  btn.innerHTML = '🔍...';
  btn.disabled = true;

  setTimeout(() => {
    const results = [
      { name: 'Max Healthcare', vicinity: 'Civil Lines, Roorkee' },
      { name: 'AIIMS Rishikesh', vicinity: 'Virbhadra Marg, Rishikesh' }
    ];

    const hospitalsList = document.getElementById('hospitals-list');
    const nearbyDiv = document.getElementById('nearby-hospitals');

    if (hospitalsList && nearbyDiv) {
      hospitalsList.innerHTML = results.map(h => `
        <div style="padding:7px;border-bottom:1px solid var(--glass-border2);cursor:pointer;" onclick="selectHospital('${h.name}')">
          <div style="font-weight:600;font-size:0.85rem;color:var(--text-primary);">${h.name}</div>
        </div>`).join('');
      nearbyDiv.style.display = 'block';
    }
    btn.innerHTML = originalText;
    btn.disabled = false;
  }, 500);
}

function selectHospital(name) {
  document.getElementById('triage-hospital').value = name;
  document.getElementById('nearby-hospitals').style.display = 'none';
}

function sendTriageAlert() {
  const eta = document.getElementById('triage-eta')?.value;
  const priority = document.getElementById('triage-priority')?.value;
  const hospitalName = document.getElementById('triage-hospital')?.value?.trim() || 'Nearest ER';

  if (!eta || !priority || selectedInjuries.size === 0) return Toast.show('Incomplete', 'Please fill ETA, Priority, and Injuries.', 'warning');

  const btn = document.getElementById('alert-hospital-btn');
  btn.innerHTML = '⏳ Sending...'; btn.disabled = true;

  setTimeout(() => {
     btn.innerHTML = '🚨 Alert Hospital Now'; btn.disabled = false;
     document.getElementById('triage-sent').style.display = 'block';
     document.getElementById('triage-sent-msg').innerHTML = `<strong style="color:var(--text-primary);">${hospitalName}</strong> is preparing the ER.`;
     Toast.show('🚨 Approved!', `${hospitalName} is ready.`, 'success');
  }, 1000); 
}