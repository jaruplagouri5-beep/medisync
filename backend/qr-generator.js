

'use strict';

const QRGenerator = (() => {

  // Build the offline-readable text payload
  const buildPayload = (qrData) => {
    return [
      'MEDISYNC EMERGENCY PROFILE',
      '══════════════════════════',
      `NAME: ${qrData.name}`,
      `BLOOD: ${qrData.bloodGroup}`,
      `ALLERGIES: ${qrData.allergies}`,
      `CONDITIONS: ${qrData.conditions}`,
      `EMERGENCY CONTACT: ${qrData.emergencyContact}`,
      '──────────────────────────',
      `DOCTOR NOTE: ${qrData.doctorNote}`,
      '──────────────────────────',
      'Scan with MediSync app or read directly.',
      `Generated: ${new Date().toLocaleString('en-IN')}`,
    ].join('\n');
  };

  // Use qrcode.js library (loaded via CDN)
  const generateQR = (containerId, qrData, size = 200) => {
    const payload = buildPayload(qrData);
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (window.QRCode) {
      new QRCode(container, {
        text: payload,
        width: size,
        height: size,
        colorDark: '#0F172A',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } else {
      // Fallback: show encoded text
      container.innerHTML = `<div style="
        font-family: monospace; font-size: 9px; line-height: 1.4;
        padding: 8px; background: white; color: #0F172A;
        border: 1px solid #ccc; border-radius: 4px;
        white-space: pre-wrap; word-break: break-word; max-width:${size}px;
      ">${payload}</div>`;
    }
    return payload;
  };

  // Parse the QR payload back to object (used by scanner page)
  const parsePayload = (text) => {
    const result = {};
    const lines = text.split('\n');
    lines.forEach(line => {
      if (line.startsWith('NAME:')) result.name = line.replace('NAME:', '').trim();
      if (line.startsWith('BLOOD:')) result.bloodGroup = line.replace('BLOOD:', '').trim();
      if (line.startsWith('ALLERGIES:')) result.allergies = line.replace('ALLERGIES:', '').trim();
      if (line.startsWith('CONDITIONS:')) result.conditions = line.replace('CONDITIONS:', '').trim();
      if (line.startsWith('EMERGENCY CONTACT:')) result.emergencyContact = line.replace('EMERGENCY CONTACT:', '').trim();
      if (line.startsWith('DOCTOR NOTE:')) result.doctorNote = line.replace('DOCTOR NOTE:', '').trim();
    });
    return result;
  };

  return { generateQR, buildPayload, parsePayload };

})();

window.QRGenerator = QRGenerator;
