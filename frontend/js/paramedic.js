// ═══════════════════════════════════════════════════
//  MediSync v3 — Paramedic Dashboard
// ═══════════════════════════════════════════════════
'use strict';

let selectedInjuries   = new Set();
let scannedPatientData = null;

// ─── ROUTING HELPER ───
// Redirects paramedic to the central scanner portal
window.goToScanner = function(params = '') {
    const isFrontendDir = window.location.pathname.includes('/frontend');
    const basePath = isFrontendDir ? 'scanner.html' : 'frontend/scanner.html';
    window.location.href = basePath + params;
};

// ─── Patient data helpers (Preserved) ────────────────
function hasScannedPatientData() { return !!scannedPatientData; }

function getScannedTriageField(field, fallback) {
  fallback = fallback || '';
  if (!scannedPatientData) return fallback;
  var value = scannedPatientData[field];
  if (Array.isArray(value)) return value.join(', ');
  return value || fallback;
}

function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value).split(/[,|;]/).map(function(v){ return v.trim(); }).filter(Boolean);
}

function buildPatientFromQRFields(fields) {
  var name = fields.name || 'Unknown Patient';
  var allergies = toList(fields.allergies);
  var chronicConditions = toList(fields.chronicConditions || fields.conditions);
  var emergencyPhone = fields.emergencyPhone || fields.phone || fields.emergencyContactPhone || '';
  var emergencyName  = fields.emergencyName  || fields.emergencyContactName || 'Emergency Contact';
  return {
    id: fields.id || fields.patientId || 'QR-SCAN',
    name: name,
    age: fields.age || '',
    gender: fields.gender || '',
    bloodGroup: fields.bloodGroup || 'Unknown',
    phone: fields.phone || '',
    email: fields.email || '',
    address: fields.address || '',
    emergencyContact: { name: emergencyName, phone: emergencyPhone },
    allergies: allergies,
    chronicConditions: chronicConditions,
    avatar: fields.avatar || name.split(' ').map(function(n){ return n[0]; }).join('').toUpperCase().slice(0,2) || 'QR',
    qrData: {
      name: name,
      bloodGroup: fields.bloodGroup || 'Unknown',
      allergies: allergies.join(', ') || 'None known',
      conditions: chronicConditions.join(', '),
      emergencyContact: emergencyPhone,
      doctorNote: fields.doctorNote || '',
    }
  };
}

function decodeQRProfile(encoded) {
  var clean = String(encoded || '').replace(/^MSYNC:/i, '').trim();
  try {
    var decoded = decodeURIComponent(Array.prototype.map.call(atob(clean), function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(decoded);
  } catch(e) {}
  try { return JSON.parse(decodeURIComponent(clean)); } catch(e) {}
  try { return JSON.parse(clean); } catch(e) {}
  return null;
}

function parsePatientFromURL(rawText) {
  try {
    var url = new URL(rawText, window.location.href);
    var encodedProfile = url.searchParams.get('qr') || url.searchParams.get('patientData') || url.searchParams.get('msync');
    if (encodedProfile) {
      var decoded = decodeQRProfile(encodedProfile);
      if (decoded) return buildPatientFromQRFields(decoded);
    }
    var fields = {
      patientId: url.searchParams.get('patientId') || url.searchParams.get('id'),
      name: url.searchParams.get('name'),
      bloodGroup: url.searchParams.get('bloodGroup'),
      allergies: url.searchParams.get('allergies'),
      chronicConditions: url.searchParams.get('conditions'),
      emergencyPhone: url.searchParams.get('emergencyPhone'),
    };
    if (fields.name || fields.bloodGroup || fields.allergies || fields.chronicConditions) {
      return buildPatientFromQRFields(fields);
    }
  } catch(e) {}
  return null;
}

function parsePatientFromVCard(rawText) {
  if (!/^BEGIN:VCARD/i.test(rawText.trim())) return null;
  var lines = rawText.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
  var findLineValue = function(prefix) {
    var line = lines.find(function(l){ return l.toUpperCase().startsWith(prefix); });
    return line ? line.slice(line.indexOf(':') + 1).trim() : '';
  };
  var encodedProfile = findLineValue('X-MEDISYNC:');
  if (encodedProfile) {
    var decoded = decodeQRProfile(encodedProfile);
    if (decoded) return buildPatientFromQRFields(decoded);
  }
  var urlValue = findLineValue('URL:');
  if (urlValue) {
    var fromUrl = parsePatientFromURL(urlValue);
    if (fromUrl) return fromUrl;
  }
  var note = findLineValue('NOTE:');
  var org  = findLineValue('ORG:');
  var allergiesMatch   = note.match(/Allergies:\s*([^|]+)/i);
  var conditionsMatch  = note.match(/Conditions:\s*([^|]+)/i);
  var bloodMatch       = org.match(/Blood Group:\s*(.+)$/i);
  var rawName          = findLineValue('FN:') || findLineValue('N:');
  return buildPatientFromQRFields({
    name: rawName.replace(/;+$/g,'').replace(/;/g,' ').trim(),
    bloodGroup: bloodMatch       ? bloodMatch[1].trim()       : '',
    allergies:  allergiesMatch   ? allergiesMatch[1].trim()   : '',
    chronicConditions: conditionsMatch ? conditionsMatch[1].trim() : '',
    emergencyPhone: findLineValue('TEL;') || findLineValue('TEL:'),
  });
}

function parsePatientFromQRPayload(rawPayload) {
  if (!rawPayload) return null;
  if (typeof rawPayload === 'object') return buildPatientFromQRFields(rawPayload);
  var rawText = String(rawPayload).trim();
  var decoded = decodeQRProfile(rawText);
  if (decoded) return buildPatientFromQRFields(decoded);
  return parsePatientFromVCard(rawText) || parsePatientFromURL(rawText);
}

// ─── Paramedic profile ───────────────────────────────
function getParamedicProfileSafe() {
  var user    = (window.Auth && Auth.getUser) ? Auth.getUser() : null;
  var profile = (window.MediSyncDB && MediSyncDB.getParamedicProfile) ? MediSyncDB.getParamedicProfile() : null;
  var resolvedName   = (profile && profile.name)   || (user && user.name)   || 'Paramedic Unit';
  var resolvedUnit   = (profile && profile.unitId) || (user && user.unitId) || resolvedName;
  var resolvedAvatar = (profile && profile.avatar) || resolvedName.trim().split(/\s+/).map(function(w){ return w[0].toUpperCase(); }).join('').substring(0,2) || 'PM';
  return {
    email:        (profile && profile.email)        || (user && user.email)        || 'paramedic@demo.com',
    name:         resolvedName,
    unitId:       resolvedUnit,
    avatar:       resolvedAvatar,
    vehicleLabel: (profile && profile.vehicleLabel) || 'Response Unit',
  };
}

function getCurrentParamedicInfo() {
  var profile = getParamedicProfileSafe();
  return {
    email:  profile.email,
    name:   profile.name,
    unitId: profile.unitId,
    label:  profile.unitId + ' - ' + profile.vehicleLabel,
  };
}

// ─── Dashboard bootstrap ─────────────────────────────
function loadParamedicDashboard() {
  var profile = getParamedicProfileSafe();
  document.getElementById('nav-name').textContent = profile.name;
  var avatar = document.getElementById('nav-avatar');
  if(avatar){
      avatar.textContent = profile.avatar;
      avatar.className   = 'avatar';
      avatar.style.background = 'linear-gradient(135deg, #DC2626, #9F1239)';
  }
  document.getElementById('app-sidebar').innerHTML  = paramedicSidebar(profile);
  document.getElementById('topnav-links').innerHTML = '';
  renderParamedicContent('scan');
}

function paramedicSidebar(profile) {
  return '<div class="sidebar-user">' +
    '<div class="avatar" style="width:36px;height:36px;font-size:0.78rem;flex-shrink:0;background:linear-gradient(135deg,#DC2626,#9F1239);">' + profile.avatar + '</div>' +
    '<div class="sidebar-user-info">' +
    '<div class="sidebar-user-name">' + profile.name + '</div>' +
    '<div class="sidebar-user-role">' + profile.unitId + '</div>' +
    '</div></div>' +
    '<div class="sidebar-section">Navigation</div>' +
    '<ul class="sidebar-menu">' +
    '<li><a href="#" data-tab="scan"    onclick="renderParamedicContent(\'scan\');return false;"    class="active"><span class="icon">\uD83D\uDCF7</span> Scan Patient QR</a></li>' +
    '<li><a href="#" data-tab="triage"  onclick="renderParamedicContent(\'triage\');return false;"><span class="icon">\uD83C\uDFE5</span> Send Triage Alert</a></li>' +
    '<li><a href="#" data-tab="history" onclick="renderParamedicContent(\'history\');return false;"><span class="icon">\uD83D\uDCCB</span> Alert History</a></li>' +
    '</ul>' +
    '<div class="sidebar-section" style="margin-top:16px;">Account</div>' +
    '<ul class="sidebar-menu">' +
    '<li><a href="#" onclick="doLogout();return false;"><span class="icon">\uD83D\uDEAA</span> Logout</a></li>' +
    '</ul>';
}

function renderParamedicContent(tab) {
  document.querySelectorAll('.sidebar-menu a').forEach(function(a){ a.classList.remove('active'); });
  var link = document.querySelector('[data-tab="' + tab + '"]');
  if (link) link.classList.add('active');
  var main = document.getElementById('main-content');
  if      (tab === 'scan')    main.innerHTML = paramedicScan();
  else if (tab === 'triage')  main.innerHTML = paramedicTriage();
  else if (tab === 'history') main.innerHTML = paramedicHistory();
}

// ─── Scan Tab (Linked to Central scanner.html) ─────────
function paramedicScan() {
  return '<div class="section-header">' +
    '<div class="section-title">\uD83D\uDCF7 Scan Patient QR Code</div>' +
    '<div class="section-sub">Redirect to secure scanning portal for emergency retrieval</div>' +
    '</div>' +

    '<div class="grid-2">' +
    '<div class="card text-center">' +
    '<div style="padding:32px 20px;">' +
    '<div style="font-size:3.5rem;margin-bottom:12px;">📱</div>' +
    '<div style="font-family:var(--font-display);font-weight:600;font-size:1rem;margin-bottom:6px;color:var(--text-primary);">Ready to Scan</div>' +
    '<div style="font-size:0.83rem;color:var(--text-secondary);margin-bottom:20px;">Click below to open the camera scanner or enter ID manually.</div>' +
    '</div>' +

    '<div style="display:flex;flex-direction:column;gap:10px;">' +
    // LINKED TO SCANNER.HTML
    '<button class="btn btn-primary w-full" onclick="goToScanner()" style="padding:14px;font-size:1rem;justify-content:center;">' +
    '📷 Open Scanner Portal' +
    '</button>' +
    '<button class="btn btn-ghost w-full" onclick="goToScanner()" style="padding:12px;font-size:0.92rem;justify-content:center; border:1px solid var(--glass-border);">' +
    '✍️ Manual Entry Mode' +
    '</button>' +
    '</div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-title mb-3">How it works</div>' +
    '<div style="display:flex;flex-direction:column;gap:15px;color:var(--text-secondary);font-size:0.875rem;padding:10px 0;">' +
    '<div>1. Open the Scanner Portal.</div>' +
    '<div>2. Scan patient\'s QR or enter ID manually.</div>' +
    '<div>3. System sends SOS & identifies critical info.</div>' +
    '<div>4. Use the information to send a Triage Alert.</div>' +
    '</div>' +
    '</div>' +
    '</div>';
}

function handleParamedicQRScan(rawPayload) {
  var patient = parsePatientFromQRPayload(rawPayload);
  if (!patient) return null;
  scannedPatientData = patient;
  return patient;
}

function openTriageFromScannedQR() {
  selectedInjuries.clear();
  if (typeof closeEmergency === 'function') closeEmergency();
  renderParamedicContent('triage');
  if(window.Toast) Toast.show('Triage ready', 'QR patient details pre-filled in the alert form.', 'success');
}

// ─── Triage Tab ───────────────────────────────────────
function paramedicTriage() {
  var injuryOptions = [
    'Head Injury','Chest Wound','Heavy Bleeding','Spinal Injury',
    'Cardiac Arrest','Difficulty Breathing','Burns','Fracture',
    'Unconscious','Allergic Reaction','Seizure','Stroke Symptoms',
    'Road Accident','Multiple Trauma','Poisoning','Shock',
  ];

  var qrNote = scannedPatientData ?
    '<div style="background:var(--blue-light);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-sm);padding:10px;margin-bottom:14px;font-size:0.82rem;color:var(--text-secondary);">' +
    '<strong style="color:var(--blue);">QR data filled:</strong> Patient identity, blood group, and allergies pre-loaded. Add injuries, ETA, priority, and select the receiving hospital.' +
    '</div>' : '';

  return '<button class="btn btn-ghost" style="margin-bottom:16px;font-size:0.85rem;" onclick="renderParamedicContent(\'scan\')">\u2190 Back to Scan</button>' +

    '<div class="section-header">' +
    '<div class="section-title">\uD83C\uDFE5 Pre-Arrival Triage Alert</div>' +
    '<div class="section-sub">Send patient condition to the receiving hospital in real time</div>' +
    '</div>' +

    '<div class="grid-2" style="align-items:start;">' +
    '<div class="card">' +
    '<div class="card-title mb-3">Patient Condition</div>' + qrNote +

    '<div class="form-group"><label class="form-label">Patient Identity</label>' +
    '<input class="form-control" id="triage-patient" value="' + getScannedTriageField('name') + '" placeholder="Name or \'Unknown (QR Scan)\'"></div>' +

    '<div class="form-row">' +
    '<div class="form-group"><label class="form-label">Blood Group</label>' +
    '<input class="form-control" id="triage-blood" value="' + getScannedTriageField('bloodGroup') + '" placeholder="e.g. B+"></div>' +
    '<div class="form-group"><label class="form-label">ETA to Hospital</label>' +
    '<select class="form-control" id="triage-eta">' +
    '<option value="">Select ETA</option>' +
    '<option>3 min</option><option>5 min</option><option>8 min</option>' +
    '<option>10 min</option><option>15 min</option><option>20+ min</option>' +
    '</select></div></div>' +

    '<div class="form-group"><label class="form-label">Known Allergies</label>' +
    '<input class="form-control" id="triage-allergies" value="' + getScannedTriageField('allergies') + '" placeholder="e.g. Penicillin, Latex"></div>' +

    '<div class="form-group"><label class="form-label">Destination Hospital</label>' +
    '<input class="form-control" id="triage-hospital" placeholder="Select from nearby list or type hospital name"></div>' +

    '<div class="form-group"><label class="form-label">Current Location</label>' +
    '<div style="display:flex;gap:8px;">' +
    '<input class="form-control" id="triage-location" placeholder="e.g. NH-58, near IITR Gate">' +
    '<button class="btn btn-ghost" onclick="findNearbyHospitals(event)" style="flex-shrink:0;white-space:nowrap;">\uD83D\uDCCD Find Hospitals</button>' +
    '</div>' +
    '<div id="nearby-hospitals" style="margin-top:8px;display:none;">' +
    '<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">Tap a hospital to select as destination:</div>' +
    '<div id="hospitals-list" style="max-height:140px;overflow-y:auto;border:1px solid var(--glass-border2);border-radius:var(--radius-sm);padding:8px;background:rgba(255,255,255,0.03);"></div>' +
    '</div></div>' +

    '<div class="form-group"><label class="form-label">Priority Level</label>' +
    '<select class="form-control" id="triage-priority">' +
    '<option value="">Select priority</option>' +
    '<option value="critical">\uD83D\uDD34 Critical</option>' +
    '<option value="high">\uD83D\uDFE0 High</option>' +
    '<option value="moderate">\uD83D\uDFE1 Moderate</option>' +
    '</select></div>' +
    '</div>' +

    '<div class="card">' +
    '<div class="card-title mb-3">Select Injuries / Conditions</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;" id="injury-chips">' +
    injuryOptions.map(function(inj) {
      return '<button class="injury-chip" onclick="toggleInjury(\'' + inj + '\', this)">' + inj + '</button>';
    }).join('') +
    '</div>' +

    '<div id="selected-injuries-display" style="padding:10px;background:rgba(255,255,255,0.04);border:1px solid var(--glass-border2);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--text-muted);margin-bottom:16px;min-height:40px;">' +
    'No injuries selected. Tap above to select.' +
    '</div>' +

    '<div style="background:var(--red-light);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-sm);padding:12px;margin-bottom:16px;font-size:0.82rem;color:var(--text-secondary);">' +
    '<strong style="color:var(--red);">\uD83D\uDCE1 Real-time Delivery:</strong> Alert is pushed to the selected hospital\'s dashboard immediately.' +
    '</div>' +

    '<button class="btn btn-danger w-full" style="padding:14px;" onclick="sendTriageAlert()">' +
    '\uD83D\uDEA8 Alert Hospital Now' +
    '</button>' +

    '<div id="triage-sent" style="display:none;margin-top:12px;background:var(--green-light);border:1.5px solid rgba(16,185,129,0.4);border-radius:var(--radius-sm);padding:14px;text-align:center;">' +
    '<div style="font-weight:700;color:var(--green);font-size:1rem;">\u2713 Hospital Alerted!</div>' +
    '<div id="triage-sent-msg" style="font-size:0.82rem;color:var(--text-secondary);margin-top:4px;">Receiving hospital has your alert and is preparing.</div>' +
    '</div></div>' +
    '</div>';
}

function toggleInjury(name, btn) {
  if (selectedInjuries.has(name)) {
    selectedInjuries.delete(name);
    btn.classList.remove('selected');
  } else {
    selectedInjuries.add(name);
    btn.classList.add('selected');
  }
  var display = document.getElementById('selected-injuries-display');
  if (display) {
    var arr = Array.from(selectedInjuries);
    display.textContent = arr.length > 0 ? 'Selected: ' + arr.join(', ') : 'No injuries selected. Tap above to select.';
  }
}

function sendTriageAlert() {
  var patient      = (document.getElementById('triage-patient')?.value  || 'Unknown (QR Scan)');
  var blood        = (document.getElementById('triage-blood')?.value    || 'Unknown');
  var eta          = document.getElementById('triage-eta')?.value;
  var allergies    = (document.getElementById('triage-allergies')?.value || 'None known');
  var hospitalName = (document.getElementById('triage-hospital')?.value?.trim() || '');
  var location     = (document.getElementById('triage-location')?.value  || 'In transit');
  var priority     = document.getElementById('triage-priority')?.value;
  var injuries     = Array.from(selectedInjuries);

  if (!eta)      { if(window.Toast) Toast.show('Select ETA', 'Please select the estimated arrival time.', 'warning'); return; }
  if (!priority) { if(window.Toast) Toast.show('Select Priority', 'Please select the patient priority level.', 'warning'); return; }
  if (injuries.length === 0) { if(window.Toast) Toast.show('Select Injuries', 'Please select at least one injury or condition.', 'warning'); return; }
  if (!hospitalName) { if(window.Toast) Toast.show('Select Hospital', 'Please type or select the destination hospital.', 'warning'); return; }

  var paramedicInfo = getCurrentParamedicInfo();
  var alertPayload = {
    patient: patient, bloodGroup: blood, allergies: allergies,
    injuries: injuries, eta: eta,
    paramedic: paramedicInfo.label,
    paramedicEmail: paramedicInfo.email,
    paramedicName:  paramedicInfo.name,
    paramedicUnitId: paramedicInfo.unitId,
    hospitalName:   hospitalName,
    location:       location,
    priority:       priority,
    hospitalId:     'default',
    timestamp:      new Date().toISOString()
  };

  if(window.MediSyncDB) MediSyncDB.addHospitalAlert(alertPayload);

  var sentEl = document.getElementById('triage-sent');
  if (sentEl) sentEl.style.display = 'block';
  var sentMsg = document.getElementById('triage-sent-msg');
  if (sentMsg) sentMsg.textContent = hospitalName + ' received your alert and is preparing.';

  if (window.ReminderEngine) ReminderEngine.playAlarm(2);
  if(window.Toast) Toast.show('\uD83D\uDEA8 Triage Alert Sent!', hospitalName + ': ' + injuries.join(', ') + ' \u2014 ETA ' + eta, 'danger', 6000);

  selectedInjuries.clear();
}

// ─── History Tab ──────────────────────────────────────
function paramedicHistory() {
  var alerts = (window.MediSyncDB && MediSyncDB.getParamedicAlerts) ? MediSyncDB.getParamedicAlerts() : [];
  var rows = alerts.length > 0
    ? alerts.map(function(a) {
        var inj = Array.isArray(a.injuries) ? a.injuries.join(', ') : (a.injuries || '\u2014');
        return '<tr>' +
          '<td style="font-size:0.82rem;color:var(--text-muted);">' + (window.Utils ? Utils.timeAgo(a.timestamp) : new Date(a.timestamp).toLocaleTimeString()) + '</td>' +
          '<td style="font-weight:500;color:var(--text-primary);">' + (a.patient || 'Unknown') + '</td>' +
          '<td style="font-size:0.82rem;color:var(--text-secondary);">' + inj + '</td>' +
          '<td style="font-size:0.82rem;color:var(--text-muted);">' + (a.hospitalName || 'Receiving hospital') + '</td>' +
          '<td><span class="badge badge-green">\u2713 delivered</span></td>' +
          '</tr>';
      }).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No alerts sent yet.</td></tr>';

  return '<button class="btn btn-ghost" style="margin-bottom:16px;font-size:0.85rem;" onclick="renderParamedicContent(\'scan\')">\u2190 Back to Scan</button>' +
    '<div class="section-header"><div class="section-title">\uD83D\uDCCB Alert History</div>' +
    '<div class="section-sub">All triage alerts dispatched from this unit</div></div>' +
    '<div class="card"><table class="table">' +
    '<thead><tr><th>Time</th><th>Patient</th><th>Injuries</th><th>Hospital</th><th>Status</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table></div>';
}

// ─── Nearby Hospitals ─────────────────────────────────
async function findNearbyHospitals(event) {
  var btn = event.target;
  var origText = btn.textContent;
  btn.textContent = '\uD83D\uDD0D Searching…';
  btn.disabled = true;

  if (!navigator.geolocation) {
    if(window.Toast) Toast.show('Geolocation not supported', 'Unable to get your location', 'warning');
    btn.textContent = origText; btn.disabled = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async function(pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      var results = [];
      try {
        var data = await MediSyncDB.getNearbyHospitals(lat, lng);
        results = data.results || [];
      } catch(e) {
        results = [
          { name: 'Max Healthcare', vicinity: 'Civil Lines, Roorkee' },
          { name: 'AIIMS Rishikesh', vicinity: 'Virbhadra Marg, Rishikesh' },
          { name: 'Civil Hospital Roorkee', vicinity: 'Station Road, Roorkee' },
          { name: 'Shri Guru Ram Rai Hospital', vicinity: 'Dehradun Road' },
          { name: 'Himalayan Hospital', vicinity: 'Jolly Grant, Dehradun' },
        ];
      }

      if (results.length > 0) {
        var hospitalsList = document.getElementById('hospitals-list');
        var nearbyDiv     = document.getElementById('nearby-hospitals');
        if (hospitalsList && nearbyDiv) {
          hospitalsList.innerHTML = results.slice(0, 6).map(function(h) {
            return '<div style="padding:8px 0;border-bottom:1px solid var(--glass-border2);cursor:pointer;display:flex;align-items:center;gap:8px;" ' +
              'onclick="selectHospital(\'' + h.name.replace(/'/g, "\\'") + '\', \'' + (h.vicinity || '').replace(/'/g, "\\'") + '\')">' +
              '<div style="flex:1;">' +
              '<div style="font-weight:600;font-size:0.85rem;color:var(--text-primary);">' + h.name + '</div>' +
              '<div style="font-size:0.75rem;color:var(--text-muted);">' + (h.vicinity || '') + '</div>' +
              '</div>' +
              '<span style="font-size:0.72rem;color:var(--blue);font-weight:600;flex-shrink:0;">Select \u2192</span>' +
              '</div>';
          }).join('');
          nearbyDiv.style.display = 'block';
          if(window.Toast) Toast.show('Hospitals found', results.length + ' nearby hospitals listed', 'success');
        }
      } else {
        if(window.Toast) Toast.show('No hospitals found', 'Try entering location manually', 'warning');
      }
      btn.textContent = origText; btn.disabled = false;
    },
    function() {
      // Location denied — show fallback list anyway
      var fallback = [
        { name: 'Max Healthcare', vicinity: 'Civil Lines, Roorkee' },
        { name: 'AIIMS Rishikesh', vicinity: 'Virbhadra Marg, Rishikesh' },
        { name: 'Civil Hospital Roorkee', vicinity: 'Station Road, Roorkee' },
        { name: 'Shri Guru Ram Rai Hospital', vicinity: 'Dehradun Road' },
        { name: 'Himalayan Hospital', vicinity: 'Jolly Grant, Dehradun' },
      ];
      var hospitalsList = document.getElementById('hospitals-list');
      var nearbyDiv     = document.getElementById('nearby-hospitals');
      if (hospitalsList && nearbyDiv) {
        hospitalsList.innerHTML = fallback.map(function(h) {
          return '<div style="padding:8px 0;border-bottom:1px solid var(--glass-border2);cursor:pointer;display:flex;align-items:center;gap:8px;" ' +
            'onclick="selectHospital(\'' + h.name.replace(/'/g, "\\'") + '\', \'' + (h.vicinity || '').replace(/'/g, "\\'") + '\')">' +
            '<div style="flex:1;">' +
            '<div style="font-weight:600;font-size:0.85rem;color:var(--text-primary);">' + h.name + '</div>' +
            '<div style="font-size:0.75rem;color:var(--text-muted);">' + (h.vicinity || '') + '</div>' +
            '</div>' +
            '<span style="font-size:0.72rem;color:var(--blue);font-weight:600;flex-shrink:0;">Select \u2192</span>' +
            '</div>';
        }).join('');
        nearbyDiv.style.display = 'block';
      }
      btn.textContent = origText; btn.disabled = false;
    }
  );
}

function selectHospital(name, address) {
  var hospitalInput  = document.getElementById('triage-hospital');
  var locationInput  = document.getElementById('triage-location');
  var nearbyDiv      = document.getElementById('nearby-hospitals');
  if (hospitalInput) hospitalInput.value = name;
  if (locationInput && !locationInput.value.trim()) locationInput.value = address;
  if (nearbyDiv) nearbyDiv.style.display = 'none';
  if(window.Toast) Toast.show('Hospital selected', name, 'success');
}

// ─── Emergency overlay helpers ───────────────────────
function openTriageFromEmergencyOverlay() {
  if (scannedPatientData) {
    openTriageFromScannedQR();
  } else {
    renderParamedicContent('triage');
    if (typeof closeEmergency === 'function') closeEmergency();
  }
}

// ─── Expose globals ───────────────────────────────────
window.loadParamedicDashboard         = loadParamedicDashboard;
window.renderParamedicContent         = renderParamedicContent;
window.handleParamedicQRScan          = handleParamedicQRScan;
window.openTriageFromScannedQR        = openTriageFromScannedQR;
window.openTriageFromEmergencyOverlay = openTriageFromEmergencyOverlay;
window.hasScannedPatientData          = hasScannedPatientData;
window.toggleInjury                   = toggleInjury;
window.sendTriageAlert                = sendTriageAlert;
window.findNearbyHospitals            = findNearbyHospitals;
window.selectHospital                 = selectHospital;