// ═══════════════════════════════════════════════════
// MediSync 15-Min Doctor View Logic
// frontend/js/doctor-view.js
// ═══════════════════════════════════════════════════

'use strict';

// 1. URL Check (Patient ID)
const urlParams = new URLSearchParams(window.location.search);
const patientId = urlParams.get('patientId') || 'P-24114045'; 

document.getElementById('doc-patient-id').textContent = patientId;

// 2. 15-Minute Timer & Session Logic
let timeLeft = 15 * 60; // 15 minutes in seconds
let timerInterval;

const timerDisplay = document.getElementById('session-timer');
const expiredOverlay = document.getElementById('expired-overlay');

function updateTimer() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Visual warning when less than 2 mins left
  if (timeLeft < 120) {
    timerDisplay.style.color = "var(--red)";
    timerDisplay.style.animation = "livePulse 1s infinite";
  } else {
    timerDisplay.style.color = "var(--text-primary)";
  }

  if (timeLeft <= 0) {
    clearInterval(timerInterval);
    saveSessionToHistory("Expired"); // Auto-save when time runs out
    showExpiredOverlay();
  } else {
    timeLeft--;
  }
}

// Start Timer
timerInterval = setInterval(updateTimer, 1000);

// --- Session Control Functions ---

function extendTime() {
  timeLeft += 300; // Add 5 minutes (300 seconds)
  updateTimer();
  alert("Session extended by 5 minutes!");
}

function finishSession() {
  if (confirm("Are you sure you want to end this session and revoke access?")) {
    saveSessionToHistory("Completed");
    // Route back to the main dashboard (index.html)
    window.location.href = '../index.html'; 
  }
}

function showExpiredOverlay() {
  expiredOverlay.style.display = 'flex';
  expiredOverlay.classList.add('open');
  document.querySelector('.layout').style.filter = "blur(10px)";
}

// Save session details to LocalStorage for Access History integration
function saveSessionToHistory(status) {
  const history = JSON.parse(localStorage.getItem('medisync_history') || '[]');
  const now = new Date();
  
  // Calculate duration used
  const totalSeconds = 900; // Original 15 mins
  const usedSeconds = totalSeconds - timeLeft;
  const durationMin = usedSeconds > 0 ? Math.floor(usedSeconds / 60) : 0;

  const newLog = {
    date: now.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    patient: "Rajesh Kumar Sharma", // Mock name, can be made dynamic via DB call
    duration: status === "Expired" ? "15 min" : `${durationMin} min`,
    status: status
  };

  history.unshift(newLog);
  localStorage.setItem('medisync_history', JSON.stringify(history));
}

// 3. Render Profile
function renderProfile() {
  const profileDiv = document.getElementById('patient-profile-card');
  
  profileDiv.innerHTML = `
    <div style="display:flex; align-items:center; gap:20px; margin-bottom:20px;">
      <div class="avatar" style="width:60px; height:60px; font-size:1.5rem; background:var(--blue); color:white; display:flex; align-items:center; justify-content:center; border-radius:50%;">RS</div>
      <div>
        <h2 style="font-family:var(--font-display); font-size:1.4rem; color:var(--text-primary);">Rajesh Kumar Sharma</h2>
        <div style="color:var(--text-secondary); font-size:0.85rem;">Male, 45 Yrs · Contact: +91 98765 43210</div>
      </div>
    </div>
    
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
      <div style="background:var(--red-light); border:1px solid rgba(239,68,68,0.15); border-radius:var(--radius-sm); padding:14px;">
        <div style="font-size:0.7rem; font-weight:700; color:var(--red); margin-bottom:4px;">ALLERGIES</div>
        <div style="font-weight:600; color:var(--text-primary);">Penicillin, Sulfonamides</div>
      </div>
      <div style="background:var(--blue-light); border:1px solid rgba(59,130,246,0.15); border-radius:var(--radius-sm); padding:14px;">
        <div style="font-size:0.7rem; font-weight:700; color:var(--blue); margin-bottom:4px;">CHRONIC CONDITIONS</div>
        <div style="font-weight:600; color:var(--text-primary);">Type 2 Diabetes, Hypertension</div>
      </div>
    </div>

    <div style="margin-top:20px; display:flex; gap:10px;">
      <button class="btn btn-ghost btn-sm" onclick="extendTime()" style="border:1px solid var(--glass-border);">➕ Extend +5 Min</button>
      <button class="btn btn-danger btn-sm" onclick="finishSession()">🏁 End Session</button>
    </div>
  `;
}

// 4. Fetch Records from MongoDB
async function fetchAndRenderRecords() {
  const timelineDiv = document.getElementById('patient-records-timeline');
  timelineDiv.innerHTML = "<p style='color:var(--text-secondary);'>Fetching verified records...</p>";

  try {
    const res = await fetch('http://localhost:5001/api/records');
    const data = await res.json();
    
    if (data.success && data.data.length > 0) {
      const recordsHTML = data.data.map(r => {
        let col = 'blue'; let ico = '📄';
        if(r.category === 'Prescription') { col = 'green'; ico = '💊'; }
        if(r.category === 'Imaging') { col = 'purple'; ico = '🩻'; }
        if(r.category === 'Lab Report') { col = 'blue'; ico = '🧪'; }

        return `
        <div class="timeline-item mb-4" style="background:rgba(255,255,255,0.03); border:1px solid var(--glass-border2); padding:16px; border-radius:12px;">
          <div style="display:flex; align-items:flex-start; gap:16px;">
            <div style="width:44px; height:44px; border-radius:10px; background:var(--${col}-light); display:flex; align-items:center; justify-content:center; font-size:1.3rem;">${ico}</div>
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:700; font-size:1rem; color:var(--text-primary); cursor:pointer;" onclick="window.open('${r.ipfsGatewayUrl}', '_blank')">${r.documentName || 'Document'}</div>
                <span class="badge badge-${col}">${r.category || 'Document'}</span>
              </div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">Year: ${r.year || 'Unknown'} · Verified via IPFS</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="window.open('${r.ipfsGatewayUrl}', '_blank')">View</button>
          </div>
        </div>`;
      }).join('');

      timelineDiv.innerHTML = `<div class="timeline">${recordsHTML}</div>`;
    } else {
      timelineDiv.innerHTML = "<p style='color:var(--text-muted);'>No medical records found.</p>";
    }
  } catch (error) {
    console.error("Fetch Error:", error);
    timelineDiv.innerHTML = "<p style='color:var(--red);'>Failed to load records from server.</p>";
  }
}

// Expose functions to global scope for HTML buttons
window.extendTime = extendTime;
window.finishSession = finishSession;

// Initialize
renderProfile();
fetchAndRenderRecords();
updateTimer();