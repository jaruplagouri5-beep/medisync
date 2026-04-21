'use strict';

let hospitalTabState = 'dashboard';

// ─── Default Staff & Beds ────────────────────────────
const DEFAULT_STAFF = [
  { name: 'Dr. Arjun Nair',    role: 'ER Physician',      status: 'On Duty' },
  { name: 'Dr. Kavitha Reddy', role: 'Trauma Surgeon',    status: 'On Duty' },
  { name: 'Nurse Priya Singh', role: 'ER Nurse',          status: 'On Duty' },
  { name: 'Nurse Amit Kumar',  role: 'Paramedic Coord.',  status: 'On Duty' },
];
const DEFAULT_BED_COUNT = 12;

function buildDefaultBeds(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    status: i < 4 ? 'occupied' : i < 6 ? 'prep' : 'free'
  }));
}

// ─── Profile helpers ─────────────────────────────────
function getHospitalProfileSafe() {
  const p = MediSyncDB.getHospitalProfile() || {};
  if (!p.beds  || !p.beds.length)  p.beds  = buildDefaultBeds(p.totalBeds || DEFAULT_BED_COUNT);
  if (!p.staff || !p.staff.length) p.staff = DEFAULT_STAFF.map(s => ({ ...s }));
  return {
    name:        'Hospital',
    address:     'Address pending',
    phone:       '',
    departments: [],
    avatar:      'HP',
    totalBeds:   DEFAULT_BED_COUNT,
    ...p,
  };
}

// ─── Alert filtering ─────────────────────────────────
function getAlertsForThisHospital() {
  const profile = getHospitalProfileSafe();
  const all     = MediSyncDB.getHospitalAlerts();
  const pname   = (profile.name || '').trim().toLowerCase();
  return all.filter(a => {
    const aname = (a.hospitalName || '').trim().toLowerCase();
    if (!aname || aname === 'receiving hospital pending') return true;
    return aname.includes(pname) || pname.includes(aname);
  });
}

// ─── Chrome sync ─────────────────────────────────────
function syncHospitalChrome(profile) {
  document.getElementById('nav-name').textContent   = 'Reception \u2013 ' + profile.name;
  document.getElementById('nav-avatar').textContent = profile.avatar;
  document.getElementById('nav-avatar').className   = 'avatar purple';
  document.getElementById('app-sidebar').innerHTML  = hospitalSidebar(profile);
  document.getElementById('topnav-links').innerHTML = '';
  document.getElementById('nav-logout').onclick     = doLogout;
}

function hospitalSidebar(profile) {
  const subline = profile.address || (profile.departments || []).join(', ') || 'Hospital reception';
  const tabs = [
    ['dashboard', 'Live', 'Live Dashboard'],
    ['alerts',    'ER',   'Incoming Alerts'],
    ['triage',    'TR',   'Triage Board'],
    ['history',   'HX',   'Alert History'],
    ['profile',   'PR',   'Hospital Profile'],
  ];
  return '<div class="sidebar-user">' +
    '<div class="avatar purple" style="width:36px;height:36px;font-size:0.78rem;flex-shrink:0;">' + profile.avatar + '</div>' +
    '<div class="sidebar-user-info">' +
    '<div class="sidebar-user-name">' + profile.name + '</div>' +
    '<div class="sidebar-user-role">' + subline + '</div>' +
    '</div></div>' +
    '<div class="sidebar-section">Navigation</div>' +
    '<ul class="sidebar-menu">' +
    tabs.map(function(t) {
      return '<li><a href="#" data-tab="' + t[0] + '" onclick="renderHospitalContent(\'' + t[0] + '\');return false;" class="' + (hospitalTabState === t[0] ? 'active' : '') + '"><span class="icon">' + t[1] + '</span> ' + t[2] + '</a></li>';
    }).join('') +
    '</ul>' +
    '<div class="sidebar-spacer"></div>' +
    '<div class="sidebar-logout"><ul class="sidebar-menu">' +
    '<li><a href="#" onclick="doLogout();return false;"><span class="icon">Out</span> Logout</a></li>' +
    '</ul></div>';
}

// ─── Main router ──────────────────────────────────────
function loadHospitalDashboard() {
  const profile = getHospitalProfileSafe();
  syncHospitalChrome(profile);
  renderHospitalContent(hospitalTabState || 'dashboard');
}

function renderHospitalContent(tab) {
  hospitalTabState = tab;
  const profile = getHospitalProfileSafe();
  syncHospitalChrome(profile);
  const main = document.getElementById('main-content');
  if      (tab === 'dashboard') main.innerHTML = hospitalDashboard(profile);
  else if (tab === 'alerts')    main.innerHTML = hospitalAlerts();
  else if (tab === 'triage')    main.innerHTML = hospitalTriage();
  else if (tab === 'history')   main.innerHTML = hospitalHistory();
  else if (tab === 'profile')   { _bedsState = null; _staffState = null; main.innerHTML = hospitalProfile(profile); }
}

// ─── Dashboard ────────────────────────────────────────
function hospitalDashboard(profile) {
  var alerts    = getAlertsForThisHospital();
  var incoming  = alerts.filter(function(a){ return a.status === 'incoming'; });
  var preparing = alerts.filter(function(a){ return a.status === 'preparing'; });
  var admitted  = alerts.filter(function(a){ return a.status === 'admitted'; });
  var beds      = profile.beds  || buildDefaultBeds(profile.totalBeds || DEFAULT_BED_COUNT);
  var staff     = profile.staff || DEFAULT_STAFF.map(function(s){ return Object.assign({}, s); });
  var depts     = profile.departments && profile.departments.length ? profile.departments.join(', ') : 'Emergency team on standby';

  return '<div class="section-header flex justify-between items-center">' +
    '<div>' +
    '<div class="section-title" style="display:flex;align-items:center;gap:10px;">Live Reception Dashboard' +
    '<span style="display:inline-flex;align-items:center;gap:6px;font-size:0.8rem;font-weight:500;color:var(--red);background:var(--red-light);padding:4px 10px;border-radius:20px;">' +
    '<span class="live-dot"></span> LIVE</span></div>' +
    '<div class="section-sub">' + profile.name + ' \u00b7 ' + (profile.address || depts) + '</div>' +
    '</div></div>' +

    '<div class="stat-grid mb-6">' +
    '<div class="stat-card amber"><div class="stat-icon">ER</div><div class="stat-value">' + incoming.length + '</div><div class="stat-label">Incoming Alerts</div></div>' +
    '<div class="stat-card blue"><div class="stat-icon">PR</div><div class="stat-value">' + preparing.length + '</div><div class="stat-label">Preparing</div></div>' +
    '<div class="stat-card green"><div class="stat-icon">AD</div><div class="stat-value">' + admitted.length + '</div><div class="stat-label">Admitted Today</div></div>' +
    '<div class="stat-card slate"><div class="stat-icon">BD</div><div class="stat-value">' + beds.length + '</div><div class="stat-label">ER Capacity</div></div>' +
    '</div>' +

    '<div class="grid-2">' +
    '<div>' +
    '<div style="font-family:var(--font-display);font-weight:700;font-size:0.95rem;margin-bottom:12px;display:flex;align-items:center;gap:8px;"><span class="live-dot"></span> Incoming Alerts</div>' +
    '<div id="live-alert-feed" style="display:flex;flex-direction:column;gap:10px;">' +
    (alerts.length ? alerts.map(renderAlertCard).join('') : '<div style="color:var(--text-muted);font-size:0.85rem;padding:16px 0;">No alerts for this hospital yet.</div>') +
    '</div></div>' +

    '<div>' +
    '<div class="card mb-4">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
    '<div class="card-title">ER Bed Status</div>' +
    '<button class="btn btn-ghost btn-sm" onclick="renderHospitalContent(\'profile\')">Edit Beds</button>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">' +
    beds.map(function(bed) {
      var clr = bed.status === 'occupied' ? 'red' : bed.status === 'prep' ? 'amber' : 'green';
      var lbl = bed.status === 'occupied' ? 'Occupied' : bed.status === 'prep' ? 'Prep' : 'Free';
      return '<div style="aspect-ratio:1;border-radius:8px;background:var(--' + clr + '-light);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:var(--' + clr + ')"><div>' + bed.id + '</div><div style="font-size:0.6rem;">' + lbl + '</div></div>';
    }).join('') +
    '</div>' + renderBedLegend(beds) + '</div>' +

    '<div class="card">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
    '<div class="card-title">On-Duty Staff</div>' +
    '<button class="btn btn-ghost btn-sm" onclick="renderHospitalContent(\'profile\')">Manage Staff</button>' +
    '</div>' +
    staff.map(function(s) {
      var initials = s.name.split(' ').map(function(w){ return w[0]; }).join('').slice(0,2);
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--slate-100);">' +
        '<div class="avatar" style="width:32px;height:32px;font-size:0.72rem;background:' + (s.status === 'On Duty' ? 'var(--green)' : 'var(--slate-400)') + ';">' + initials + '</div>' +
        '<div style="flex:1;"><div style="font-weight:600;font-size:0.85rem;">' + s.name + '</div><div style="font-size:0.75rem;color:var(--slate-500);">' + s.role + '</div></div>' +
        '<span class="badge badge-' + (s.status === 'On Duty' ? 'green' : 'slate') + '">' + s.status + '</span>' +
        '</div>';
    }).join('') +
    '</div></div></div>';
}

function renderBedLegend(beds) {
  var occ  = beds.filter(function(b){ return b.status === 'occupied'; }).length;
  var prep = beds.filter(function(b){ return b.status === 'prep'; }).length;
  var free = beds.filter(function(b){ return b.status === 'free'; }).length;
  return '<div style="display:flex;gap:12px;margin-top:12px;font-size:0.75rem;">' +
    '<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--red-light);border:1px solid var(--red);"></span> Occupied (' + occ + ')</span>' +
    '<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--amber-light);border:1px solid var(--amber);"></span> Prep (' + prep + ')</span>' +
    '<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--green-light);border:1px solid var(--green);"></span> Free (' + free + ')</span>' +
    '</div>';
}

// ─── Alert Card ───────────────────────────────────────
function renderAlertCard(alert) {
  var priorityColor = alert.priority === 'critical' ? 'red' : alert.priority === 'high' ? 'amber' : 'blue';
  var statusColor   = alert.status   === 'incoming' ? 'red' : alert.status === 'preparing' ? 'amber' : 'green';
  var injuries      = Array.isArray(alert.injuries) ? alert.injuries.join(', ') : (alert.injuries || '');

  var actionHtml = '';
  if (alert.status === 'incoming') {
    actionHtml = '<div style="display:flex;gap:8px;">' +
      '<button class="btn btn-success btn-sm" onclick="acceptAlert(\'' + alert.id + '\')">&#10003; Accept &amp; Prepare</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="escalateAlert(\'' + alert.id + '\')">Escalate</button>' +
      '</div>';
  } else if (alert.status === 'preparing') {
    actionHtml = '<div style="background:var(--amber-light);border-radius:6px;padding:8px;font-size:0.78rem;color:var(--amber);font-weight:600;display:flex;align-items:center;justify-content:space-between;">' +
      '<span>&#8987; Preparation in progress&hellip;</span>' +
      '<button class="btn btn-success btn-sm" onclick="admitAlert(\'' + alert.id + '\')">Mark Admitted</button>' +
      '</div>';
  } else {
    actionHtml = '<div style="background:var(--green-light);border-radius:6px;padding:8px;font-size:0.78rem;color:var(--green);font-weight:600;">&#10003; Patient admitted</div>';
  }

  return '<div class="alert-card ' + (alert.status === 'incoming' ? 'incoming' : '') + '" id="alert-' + alert.id + '">' +
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">' +
    '<div style="display:flex;align-items:center;gap:8px;">' +
    '<span class="badge badge-' + priorityColor + '" style="font-size:0.72rem;">' + (alert.priority || 'alert').toUpperCase() + '</span>' +
    '<span style="font-size:0.78rem;color:var(--slate-500);">' + Utils.timeAgo(alert.timestamp) + '</span>' +
    '</div><span class="badge badge-' + statusColor + '">' + alert.status + '</span>' +
    '</div>' +
    '<div style="font-weight:700;font-size:0.95rem;margin-bottom:4px;">' + alert.patient + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
    '<span style="font-size:0.78rem;background:var(--red-light);color:var(--red);padding:2px 8px;border-radius:4px;font-weight:600;">Blood ' + alert.bloodGroup + '</span>' +
    '<span style="font-size:0.78rem;background:var(--amber-light);color:var(--amber);padding:2px 8px;border-radius:4px;font-weight:600;">Allergies: ' + alert.allergies + '</span>' +
    '</div>' +
    '<div style="font-size:0.8rem;color:var(--slate-700);margin-bottom:4px;">Paramedic: ' + alert.paramedic + '</div>' +
    '<div style="font-size:0.8rem;color:var(--slate-600);margin-bottom:4px;">Location: ' + alert.location + '</div>' +
    '<div style="font-size:0.8rem;color:var(--slate-700);font-weight:600;margin-bottom:10px;">Injuries: ' + injuries + ' &middot; ETA: ' + alert.eta + '</div>' +
    actionHtml +
    '</div>';
}

// ─── Alerts Tab ───────────────────────────────────────
function hospitalAlerts() {
  var alerts = getAlertsForThisHospital();
  return '<div class="section-header"><div class="section-title">Incoming Emergency Alerts</div>' +
    '<div class="section-sub">Pre-arrival triage data for your reception team</div></div>' +
    '<div id="all-alerts-list" style="display:flex;flex-direction:column;gap:12px;">' +
    (alerts.length ? alerts.map(renderAlertCard).join('') :
      '<div style="color:var(--text-muted);font-size:0.85rem;padding:24px 0;text-align:center;">No alerts yet. Alerts sent by paramedics to your hospital will appear here.</div>') +
    '</div>';
}

// ─── Triage Board ─────────────────────────────────────
function hospitalTriage() {
  var alerts  = getAlertsForThisHospital();
  var columns = [
    { level: 'Critical', color: 'red',   cases: alerts.filter(function(a){ return a.priority === 'critical'; }) },
    { level: 'Urgent',   color: 'amber', cases: alerts.filter(function(a){ return a.priority === 'high'; }) },
    { level: 'Standard', color: 'green', cases: alerts.filter(function(a){ return ['critical','high'].indexOf(a.priority) === -1; }) },
  ];

  return '<div class="section-header"><div class="section-title">Triage Board</div>' +
    '<div class="section-sub">Active cases sorted by priority</div></div>' +
    '<div class="grid-3">' +
    columns.map(function(col) {
      return '<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">' +
        '<span class="badge badge-' + col.color + '">' + col.level + '</span>' +
        '<span style="font-size:0.78rem;color:var(--slate-500);">' + col.cases.length + ' cases</span>' +
        '</div><div style="display:flex;flex-direction:column;gap:8px;">' +
        (col.cases.length ? col.cases.map(function(item) {
          var inj = Array.isArray(item.injuries) ? item.injuries.join(', ') : (item.injuries || '');
          return '<div style="background:var(--' + col.color + '-light);border-radius:var(--radius-sm);padding:10px 12px;font-size:0.82rem;font-weight:500;color:var(--slate-800);">' +
            '<div style="font-weight:700;margin-bottom:2px;">' + item.patient + '</div>' +
            '<div>' + inj + '</div>' +
            '<div style="font-size:0.75rem;opacity:0.75;">ETA: ' + item.eta + ' &middot; ' + item.status + '</div>' +
            '</div>';
        }).join('') :
        '<div style="background:var(--slate-100);border-radius:var(--radius-sm);padding:10px 12px;font-size:0.82rem;color:var(--slate-500);">No active ' + col.level.toLowerCase() + ' cases.</div>') +
        '</div></div>';
    }).join('') + '</div>';
}

// ─── History ──────────────────────────────────────────
function hospitalHistory() {
  var alerts = getAlertsForThisHospital();
  return '<div class="section-header"><div class="section-title">Alert History</div>' +
    '<div class="section-sub">All alerts received by this hospital</div></div>' +
    '<div class="card"><table class="table">' +
    '<thead><tr><th>Time</th><th>Patient</th><th>Injuries</th><th>Paramedic</th><th>ETA</th><th>Status</th></tr></thead>' +
    '<tbody>' +
    (alerts.length ? alerts.map(function(a) {
      var inj = Array.isArray(a.injuries) ? a.injuries.join(', ') : (a.injuries || '');
      return '<tr>' +
        '<td style="font-size:0.82rem;">' + new Date(a.timestamp).toLocaleString('en-IN') + '</td>' +
        '<td style="font-weight:500;">' + a.patient + '</td>' +
        '<td style="font-size:0.82rem;">' + inj + '</td>' +
        '<td style="font-size:0.82rem;color:var(--slate-500);">' + a.paramedic + '</td>' +
        '<td style="font-size:0.82rem;">' + a.eta + '</td>' +
        '<td><span class="badge badge-' + (a.status === 'incoming' ? 'red' : a.status === 'preparing' ? 'amber' : 'green') + '">' + a.status + '</span></td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--slate-500);padding:24px;">No alert history yet.</td></tr>') +
    '</tbody></table></div>';
}

// ─── Profile Tab ──────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function hospitalProfile(profile) {
  var beds   = profile.beds  || buildDefaultBeds(profile.totalBeds || DEFAULT_BED_COUNT);
  var staff  = profile.staff || DEFAULT_STAFF.map(function(s){ return Object.assign({}, s); });
  var depts  = Array.isArray(profile.departments) ? profile.departments.join(', ') : (profile.departments || '');

  return '<div class="section-header flex justify-between items-center">' +
    '<div><div class="section-title">Hospital Profile</div>' +
    '<div class="section-sub">Edit your hospital details, manage beds and staff availability</div></div>' +
    '<button class="btn btn-primary" onclick="saveHospitalProfile()">Save Changes</button>' +
    '</div>' +

    // ── Hospital Info
    '<div class="card mb-4"><div class="card-title mb-4">Hospital Information</div>' +
    '<div class="grid-2" style="gap:16px;">' +
    '<div class="form-group"><label class="form-label">Hospital Name</label>' +
    '<input class="form-control" id="hp-name" value="' + escHtml(profile.name) + '"></div>' +
    '<div class="form-group"><label class="form-label">Phone</label>' +
    '<input class="form-control" id="hp-phone" value="' + escHtml(profile.phone) + '" placeholder="+91 XXXXX XXXXX"></div>' +
    '<div class="form-group"><label class="form-label">Address</label>' +
    '<input class="form-control" id="hp-address" value="' + escHtml(profile.address) + '" placeholder="Street, City"></div>' +
    '<div class="form-group"><label class="form-label">Departments (comma-separated)</label>' +
    '<input class="form-control" id="hp-departments" value="' + escHtml(depts) + '" placeholder="Emergency, Trauma, Cardiology"></div>' +
    '</div></div>' +

    // ── Bed Management
    '<div class="card mb-4">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
    '<div class="card-title">ER Beds</div>' +
    '<div style="display:flex;gap:8px;align-items:center;">' +
    '<label class="form-label" style="margin:0;white-space:nowrap;">Total Beds:</label>' +
    '<input type="number" class="form-control" id="hp-total-beds" value="' + beds.length + '" min="1" max="50" style="width:70px;padding:6px 10px;" onchange="resizeBeds(this.value)">' +
    '</div></div>' +
    '<div id="bed-grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;">' +
    beds.map(renderBedToggle).join('') +
    '</div>' +
    '<div style="margin-top:12px;font-size:0.78rem;color:var(--text-muted);">Click a bed to cycle: Free \u2192 Occupied \u2192 Prep \u2192 Free</div>' +
    renderBedLegend(beds) + '</div>' +

    // ── Staff
    '<div class="card">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
    '<div class="card-title">Staff Management</div>' +
    '<button class="btn btn-ghost btn-sm" onclick="addStaffRow()">+ Add Staff</button>' +
    '</div>' +
    '<div id="staff-list" style="display:flex;flex-direction:column;gap:10px;">' +
    staff.map(renderStaffRow).join('') +
    '</div></div>';
}

function renderBedToggle(bed) {
  var clr = bed.status === 'occupied' ? 'red' : bed.status === 'prep' ? 'amber' : 'green';
  var lbl = bed.status === 'occupied' ? 'Occupied' : bed.status === 'prep' ? 'Prep' : 'Free';
  return '<div id="bed-tile-' + bed.id + '" onclick="cycleBedStatus(' + bed.id + ')" ' +
    'style="aspect-ratio:1;border-radius:8px;background:var(--' + clr + '-light);border:2px solid var(--' + clr + ');' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:var(--' + clr + ');cursor:pointer;transition:all 0.15s;">' +
    '<div style="font-size:0.85rem;">' + bed.id + '</div>' +
    '<div style="font-size:0.6rem;margin-top:2px;">' + lbl + '</div></div>';
}

function renderStaffRow(s, i) {
  var on = s.status === 'On Duty';
  return '<div id="staff-row-' + i + '" style="display:flex;gap:10px;align-items:center;padding:8px;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border2);border-radius:var(--radius-sm);">' +
    '<input class="form-control" style="flex:2;" value="' + escHtml(s.name) + '" placeholder="Doctor/Nurse Name" id="staff-name-' + i + '">' +
    '<input class="form-control" style="flex:2;" value="' + escHtml(s.role) + '" placeholder="Role / Specialization" id="staff-role-' + i + '">' +
    '<button onclick="toggleStaffStatus(' + i + ')" id="staff-status-btn-' + i + '" class="btn btn-sm" ' +
    'style="flex-shrink:0;padding:6px 14px;border-radius:20px;font-size:0.78rem;font-weight:600;' +
    'background:' + (on ? 'var(--green-light)' : 'var(--slate-100)') + ';' +
    'color:' + (on ? 'var(--green)' : 'var(--slate-500)') + ';' +
    'border:1px solid ' + (on ? 'var(--green)' : 'var(--slate-300)') + ';">' +
    s.status + '</button>' +
    '<button onclick="removeStaffRow(' + i + ')" class="btn btn-ghost btn-sm" style="color:var(--red);flex-shrink:0;">\u2715</button>' +
    '</div>';
}

// ─── Bed state ────────────────────────────────────────
var _bedsState  = null;
var _staffState = null;

function getCurrentBeds() {
  if (!_bedsState) _bedsState = (getHospitalProfileSafe().beds || buildDefaultBeds(DEFAULT_BED_COUNT)).map(function(b){ return Object.assign({}, b); });
  return _bedsState;
}

function cycleBedStatus(id) {
  var beds  = getCurrentBeds();
  var bed   = null;
  for (var i = 0; i < beds.length; i++) { if (beds[i].id === id) { bed = beds[i]; break; } }
  if (!bed) return;
  var cycle = { free: 'occupied', occupied: 'prep', prep: 'free' };
  bed.status = cycle[bed.status] || 'free';
  var tile = document.getElementById('bed-tile-' + id);
  if (tile) {
    var clr = bed.status === 'occupied' ? 'red' : bed.status === 'prep' ? 'amber' : 'green';
    var lbl = bed.status === 'occupied' ? 'Occupied' : bed.status === 'prep' ? 'Prep' : 'Free';
    tile.style.background  = 'var(--' + clr + '-light)';
    tile.style.borderColor = 'var(--' + clr + ')';
    tile.style.color       = 'var(--' + clr + ')';
    tile.innerHTML = '<div style="font-size:0.85rem;">' + id + '</div><div style="font-size:0.6rem;margin-top:2px;">' + lbl + '</div>';
  }
}

function resizeBeds(newCount) {
  var count = Math.max(1, Math.min(50, parseInt(newCount, 10) || DEFAULT_BED_COUNT));
  var beds  = getCurrentBeds();
  if (count > beds.length) {
    for (var i = beds.length + 1; i <= count; i++) beds.push({ id: i, status: 'free' });
  } else {
    _bedsState = beds.slice(0, count);
  }
  var grid = document.getElementById('bed-grid');
  if (grid) grid.innerHTML = getCurrentBeds().map(renderBedToggle).join('');
}

// ─── Staff state ──────────────────────────────────────
function getCurrentStaff() {
  if (!_staffState) _staffState = (getHospitalProfileSafe().staff || DEFAULT_STAFF).map(function(s){ return Object.assign({}, s); });
  return _staffState;
}

function toggleStaffStatus(index) {
  var staff = getCurrentStaff();
  if (!staff[index]) return;
  staff[index].status = staff[index].status === 'On Duty' ? 'Off Duty' : 'On Duty';
  var btn = document.getElementById('staff-status-btn-' + index);
  if (btn) {
    var on = staff[index].status === 'On Duty';
    btn.textContent    = staff[index].status;
    btn.style.background  = on ? 'var(--green-light)' : 'var(--slate-100)';
    btn.style.color       = on ? 'var(--green)' : 'var(--slate-500)';
    btn.style.borderColor = on ? 'var(--green)' : 'var(--slate-300)';
  }
}

function addStaffRow() {
  var staff = getCurrentStaff();
  var idx   = staff.length;
  staff.push({ name: '', role: '', status: 'On Duty' });
  var list = document.getElementById('staff-list');
  if (list) {
    var div = document.createElement('div');
    div.innerHTML = renderStaffRow(staff[idx], idx);
    list.appendChild(div.firstElementChild);
  }
}

function removeStaffRow(index) {
  var row = document.getElementById('staff-row-' + index);
  if (row) row.remove();
  var staff = getCurrentStaff();
  staff[index] = null;
}

// ─── Save Profile ─────────────────────────────────────
function saveHospitalProfile() {
  var name       = (document.getElementById('hp-name')?.value || '').trim();
  var phone      = (document.getElementById('hp-phone')?.value || '').trim();
  var address    = (document.getElementById('hp-address')?.value || '').trim();
  var deptsRaw   = document.getElementById('hp-departments')?.value || '';
  var departments = deptsRaw.split(',').map(function(d){ return d.trim(); }).filter(Boolean);
  var beds       = getCurrentBeds();
  var staff      = getCurrentStaff().map(function(s, i) {
    if (!s) return null;
    var ni = document.getElementById('staff-name-' + i);
    var ri = document.getElementById('staff-role-' + i);
    return Object.assign({}, s, {
      name: ni ? ni.value.trim() : s.name,
      role: ri ? ri.value.trim() : s.role,
    });
  }).filter(function(s){ return s && s.name; });

  var updated = MediSyncDB.updateHospitalProfile({ name: name, phone: phone, address: address, departments: departments, beds: beds, staff: staff, totalBeds: beds.length });
  if (updated) {
    _bedsState  = null;
    _staffState = null;
    Toast.show('Profile saved', 'Hospital details updated successfully.', 'success');
    renderHospitalContent('profile');
  } else {
    Toast.show('Save failed', 'Unable to save profile. Please try again.', 'danger');
  }
}

// ─── Accept / Admit / Escalate ────────────────────────
function acceptAlert(alertId) {
  var updated = MediSyncDB.updateAlertStatus(alertId, 'preparing');
  if (updated) {
    if (window.ReminderEngine) ReminderEngine.playAlarm(1);
    Toast.show('Alert accepted', 'Preparation team notified. Bay assigned.', 'success');
    renderHospitalContent(hospitalTabState);
  }
}

function admitAlert(alertId) {
  var updated = MediSyncDB.updateAlertStatus(alertId, 'admitted');
  if (updated) {
    Toast.show('Patient admitted', 'Status updated to admitted.', 'success');
    renderHospitalContent(hospitalTabState);
  }
}

function escalateAlert(alertId) {
  Toast.show('Alert escalated', 'Senior ER physician paged.', 'warning');
}

// ─── Expose globals ───────────────────────────────────
window.loadHospitalDashboard = loadHospitalDashboard;
window.renderHospitalContent = renderHospitalContent;
window.acceptAlert           = acceptAlert;
window.admitAlert            = admitAlert;
window.escalateAlert         = escalateAlert;
window.saveHospitalProfile   = saveHospitalProfile;
window.cycleBedStatus        = cycleBedStatus;
window.resizeBeds            = resizeBeds;
window.toggleStaffStatus     = toggleStaffStatus;
window.addStaffRow           = addStaffRow;
window.removeStaffRow        = removeStaffRow;
