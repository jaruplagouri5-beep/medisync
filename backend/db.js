'use strict';

const MediSyncDB = (() => {
  const REGISTERED_USERS_KEY = 'medisync_registered_users';
  const HOSPITAL_ALERTS_KEY = 'medisync_hospital_alerts';

  const STATIC_DOCTORS = [
    {
      id: 'D001',
      name: 'Dr. Priya Mehta',
      specialization: 'Endocrinologist',
      hospitalName: 'Max Healthcare, Roorkee',
      avatar: 'PM',
      nextSlot: 'Today, 2:30 PM'
    },
    {
      id: 'D002',
      name: 'Dr. Arjun Nair',
      specialization: 'Cardiologist',
      hospitalName: 'Fortis Hospital, Dehradun',
      avatar: 'AN',
      nextSlot: 'Tomorrow, 11:00 AM'
    },
    {
      id: 'D003',
      name: 'Dr. Kavitha Reddy',
      specialization: 'General Physician',
      hospitalName: 'Apollo Clinic, Roorkee',
      avatar: 'KR',
      nextSlot: 'Today, 4:00 PM'
    }
  ];

  let hospitalAlerts = [
    {
      id: 'A001',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      status: 'incoming',
      patient: 'Unknown (Scan)',
      bloodGroup: 'B+',
      allergies: 'Penicillin',
      injuries: ['Head Injury', 'Heavy Bleeding'],
      eta: '8 min',
      paramedic: 'Unit 7 - Ambulance IND-UP-07',
      location: 'NH-58, near IITR Gate',
      priority: 'critical'
    },
    {
      id: 'A002',
      timestamp: new Date(Date.now() - 22 * 60000).toISOString(),
      status: 'preparing',
      patient: 'Sita Devi, 68F',
      bloodGroup: 'O+',
      allergies: 'None known',
      injuries: ['Chest Pain', 'Shortness of Breath'],
      eta: '3 min',
      paramedic: 'Unit 3 - Ambulance IND-UK-03',
      location: 'Civil Lines, Roorkee',
      priority: 'high'
    }
  ];

  let consentTokens = {};

  const getCurrentUser = () => {
    try {
      const stored = sessionStorage.getItem('medisync_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const getCurrentUserEmail = () => getCurrentUser()?.email || null;

  const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const getInitials = (name, fallback = 'MS') => {
    const initials = String(name || '')
      .split(' ')
      .map((part) => part.trim()[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 2);
    return initials || fallback;
  };

  const readJSON = (key, defaultValue) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const writeJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to persist local data:', error);
    }
  };

  const getUserData = (key, defaultValue = null) => {
    const email = getCurrentUserEmail();
    if (!email) return defaultValue;
    return readJSON(`medisync_${email}_${key}`, defaultValue);
  };

  const setUserData = (key, value) => {
    const email = getCurrentUserEmail();
    if (!email) return;
    writeJSON(`medisync_${email}_${key}`, value);
  };

  const getRegisteredUsers = () => readJSON(REGISTERED_USERS_KEY, {});

  const getDemoPatient = () => ({
    id: 'P-DEMO',
    name: 'Rajesh Kumar Sharma',
    age: 45,
    gender: 'Male',
    dob: '1979-06-12',
    bloodGroup: 'B+',
    phone: '+91 98765 43210',
    email: 'patient@demo.com',
    address: 'Roorkee, Uttarakhand',
    emergencyContact: { name: 'Sunita Sharma (Wife)', phone: '+91 98765 11111' },
    allergies: ['Penicillin', 'Sulfonamides'],
    chronicConditions: ['Type 2 Diabetes', 'Hypertension'],
    avatar: 'RS',
    qrData: {
      name: 'Rajesh Kumar Sharma',
      bloodGroup: 'B+',
      allergies: 'Penicillin, Sulfonamides',
      conditions: 'Diabetes, Hypertension',
      emergencyContact: '+91 98765 11111',
      doctorNote: 'Patient on Metformin 500mg. Do NOT administer Penicillin.'
    }
  });

  const getDemoRecords = () => ([
    {
      id: 'R001',
      type: 'Lab Report',
      category: 'blue',
      title: 'HbA1c Blood Sugar Test',
      date: '2026-03-10',
      hospital: 'Apollo Diagnostics',
      summary: 'HbA1c: 7.2% - Controlled. Fasting Glucose: 112 mg/dL',
      file: 'blood_sugar_mar26.pdf',
      size: '1.2 MB'
    },
    {
      id: 'R002',
      type: 'Prescription',
      category: 'green',
      title: 'Metformin 500mg Rx',
      date: '2026-03-10',
      hospital: 'Max Healthcare',
      summary: 'Metformin 500mg - Twice daily after meals',
      file: 'rx_metformin.pdf',
      size: '0.4 MB'
    },
    {
      id: 'R003',
      type: 'Lab Report',
      category: 'blue',
      title: 'Kidney Function Test',
      date: '2026-01-15',
      hospital: 'SRL Diagnostics',
      summary: 'Creatinine: 1.1 mg/dL - Normal range. eGFR: 78',
      file: 'kft_jan26.pdf',
      size: '0.8 MB'
    }
  ]);

  const getDemoReminders = () => ([
    {
      id: 'MED001',
      medicine: 'Metformin 500mg',
      dose: '1 tablet',
      frequency: 'twice-daily',
      times: ['08:00', '20:00'],
      linkedReport: 'R001',
      taken: { morning: false, evening: false },
      active: true,
      lastTaken: null
    },
    {
      id: 'MED002',
      medicine: 'Amlodipine 5mg',
      dose: '1 tablet',
      frequency: 'once-daily',
      times: ['08:00'],
      linkedReport: 'R004',
      taken: { morning: false },
      active: true,
      lastTaken: null
    }
  ]);

  const getDefaultPatient = (user = {}) => ({
    id: createId('P'),
    name: user.name || 'User',
    age: 0,
    gender: 'Not Specified',
    dob: '',
    bloodGroup: user.bloodGroup || 'Not Specified',
    phone: user.phone || '',
    email: user.email || '',
    address: user.address || 'Not Specified',
    emergencyContact: { name: '', phone: user.phone || '' },
    allergies: user.allergies ? user.allergies.split(',').map((item) => item.trim()).filter(Boolean) : [],
    chronicConditions: [],
    avatar: getInitials(user.name, 'U'),
    qrData: {
      name: user.name || 'User',
      bloodGroup: user.bloodGroup || 'Not Specified',
      allergies: user.allergies || 'None',
      conditions: '',
      emergencyContact: user.phone || '',
      doctorNote: 'New patient profile'
    }
  });

  const getDefaultDoctorProfile = (user = {}) => ({
    id: createId('D'),
    name: user.name || 'Doctor',
    email: user.email || '',
    phone: user.phone || '',
    specialization: user.specialization || 'General Physician',
    hospitalName: user.hospitalName || user.hospital || 'Independent Practice',
    license: user.license || '',
    experience: user.experience || '',
    consultationFee: user.consultationFee || '',
    bio: user.bio || 'Profile not added yet.',
    avatar: getInitials(user.name, 'DR'),
    nextSlot: user.nextSlot || 'No slots scheduled',
    appointments: Array.isArray(user.appointments) ? user.appointments : []
  });

  const getDemoDoctorProfile = () => ({
    id: 'D001',
    name: 'Dr. Priya Mehta',
    email: 'doctor@demo.com',
    phone: '+91 98111 22334',
    specialization: 'Endocrinologist',
    hospitalName: 'Max Healthcare, Roorkee',
    license: 'MCI-2024-3412',
    experience: '12 years',
    consultationFee: '800',
    bio: 'Focused on diabetes, thyroid care, and long-term metabolic follow-up.',
    avatar: 'PM',
    nextSlot: 'Today, 2:30 PM',
    appointments: [
      { time: '10:00 AM', name: 'Rajesh Kumar Sharma', reason: 'Diabetes follow-up', done: true },
      { time: '2:30 PM', name: 'Meena Gupta', reason: 'HbA1c review', done: false },
      { time: '4:00 PM', name: 'Suresh Patel', reason: 'Thyroid checkup', done: false }
    ]
  });

  const summarizePatientForDoctor = (patient, lastAccessed, recordsCount = 0) => ({
    patientId: patient.id,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    allergies: Array.isArray(patient.allergies) ? patient.allergies : [],
    chronicConditions: Array.isArray(patient.chronicConditions) ? patient.chronicConditions : [],
    avatar: patient.avatar || getInitials(patient.name, 'PT'),
    lastAccessed: lastAccessed || new Date().toISOString(),
    recordsCount
  });

  const getDemoDoctorPatients = () => [
    summarizePatientForDoctor(getDemoPatient(), '2026-03-10T10:15:00.000Z', getDemoRecords().length)
  ];

  const getDemoDoctorHistory = () => [
    {
      id: 'DH001',
      patientId: 'P-DEMO',
      patient: 'Rajesh Kumar Sharma',
      accessedAt: '2026-03-10T10:15:00.000Z',
      duration: '8 min',
      status: 'completed'
    },
    {
      id: 'DH002',
      patientId: 'P-DEMO',
      patient: 'Rajesh Kumar Sharma',
      accessedAt: '2026-01-22T15:00:00.000Z',
      duration: '15 min',
      status: 'completed'
    },
    {
      id: 'DH003',
      patientId: 'P-DEMO',
      patient: 'Rajesh Kumar Sharma',
      accessedAt: '2025-11-10T11:30:00.000Z',
      duration: '12 min',
      status: 'completed'
    }
  ];

  const getDefaultHospitalProfile = (user = {}) => ({
    id: createId('H'),
    name: user.name || 'Hospital',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || 'Address pending',
    departments: typeof user.departments === 'string'
      ? user.departments.split(',').map((item) => item.trim()).filter(Boolean)
      : Array.isArray(user.departments) ? user.departments : [],
    avatar: getInitials(user.name, 'HP')
  });

  const getDemoHospitalProfile = () => ({
    id: 'H001',
    name: 'Max Healthcare',
    email: 'hospital@demo.com',
    phone: '+91 98989 22110',
    address: 'Civil Lines, Roorkee',
    departments: ['Emergency', 'Trauma', 'Cardiology'],
    avatar: 'MH'
  });

  const getDefaultParamedicProfile = (user = {}) => ({
    id: createId('PR'),
    name: user.name || 'Paramedic Unit',
    email: user.email || '',
    phone: user.phone || '',
    unitId: user.unitId || user.name || 'Unit',
    avatar: getInitials(user.name, 'PM')
  });

  const getDemoParamedicProfile = () => ({
    id: 'PR007',
    name: 'Paramedic Unit 7',
    email: 'paramedic@demo.com',
    phone: '+91 90000 12007',
    unitId: 'Unit 7',
    avatar: 'U7'
  });

  const getStoredHospitalAlerts = () => {
    hospitalAlerts = readJSON(HOSPITAL_ALERTS_KEY, hospitalAlerts);
    if (!localStorage.getItem(HOSPITAL_ALERTS_KEY)) {
      writeJSON(HOSPITAL_ALERTS_KEY, hospitalAlerts);
    }
    return hospitalAlerts;
  };

  const setStoredHospitalAlerts = (alerts) => {
    hospitalAlerts = alerts;
    writeJSON(HOSPITAL_ALERTS_KEY, alerts);
  };

  const readPatientBundleByEmail = (email) => {
    if (!email) return null;
    if (email === 'patient@demo.com') {
      return { patient: getDemoPatient(), records: getDemoRecords() };
    }

    const patient = readJSON(`medisync_${email}_patient`, null);
    if (!patient) return null;

    return {
      patient,
      records: readJSON(`medisync_${email}_records`, [])
    };
  };

  const getScannablePatientBundle = () => {
    const registeredUsers = getRegisteredUsers();
    const patientEmails = Object.keys(registeredUsers).filter((email) => registeredUsers[email]?.role === 'patient');
    const orderedEmails = patientEmails.includes('patient@demo.com')
      ? patientEmails
      : ['patient@demo.com', ...patientEmails];

    for (const email of orderedEmails) {
      const bundle = readPatientBundleByEmail(email);
      if (bundle?.patient) return bundle;
    }

    return { patient: getDemoPatient(), records: getDemoRecords() };
  };

  const initializeUserData = (user) => {
    if (!user?.email) return;

    if (user.role === 'patient') {
      if (!localStorage.getItem(`medisync_${user.email}_patient`)) {
        const patientProfile = user.email === 'patient@demo.com' ? getDemoPatient() : getDefaultPatient(user);
        writeJSON(`medisync_${user.email}_patient`, patientProfile);
      }
      if (!localStorage.getItem(`medisync_${user.email}_records`)) {
        writeJSON(`medisync_${user.email}_records`, user.email === 'patient@demo.com' ? getDemoRecords() : []);
      }
      if (!localStorage.getItem(`medisync_${user.email}_reminders`)) {
        writeJSON(`medisync_${user.email}_reminders`, user.email === 'patient@demo.com' ? getDemoReminders() : []);
      }
      return;
    }

    if (user.role === 'doctor') {
      if (!localStorage.getItem(`medisync_${user.email}_doctor_profile`)) {
        writeJSON(
          `medisync_${user.email}_doctor_profile`,
          user.email === 'doctor@demo.com' ? getDemoDoctorProfile() : getDefaultDoctorProfile(user)
        );
      }
      if (!localStorage.getItem(`medisync_${user.email}_doctor_patients`)) {
        writeJSON(`medisync_${user.email}_doctor_patients`, user.email === 'doctor@demo.com' ? getDemoDoctorPatients() : []);
      }
      if (!localStorage.getItem(`medisync_${user.email}_doctor_history`)) {
        writeJSON(`medisync_${user.email}_doctor_history`, user.email === 'doctor@demo.com' ? getDemoDoctorHistory() : []);
      }
      return;
    }

    if (user.role === 'hospital') {
      if (!localStorage.getItem(`medisync_${user.email}_hospital_profile`)) {
        writeJSON(
          `medisync_${user.email}_hospital_profile`,
          user.email === 'hospital@demo.com' ? getDemoHospitalProfile() : getDefaultHospitalProfile(user)
        );
      }
      return;
    }

    if (user.role === 'paramedic') {
      if (!localStorage.getItem(`medisync_${user.email}_paramedic_profile`)) {
        writeJSON(
          `medisync_${user.email}_paramedic_profile`,
          user.email === 'paramedic@demo.com' ? getDemoParamedicProfile() : getDefaultParamedicProfile(user)
        );
      }
      if (!localStorage.getItem(`medisync_${user.email}_paramedic_alerts`)) {
        writeJSON(`medisync_${user.email}_paramedic_alerts`, []);
      }
    }
  };

  // Find first registered patient — used by doctor/paramedic views
  const getAnyPatient = () => {
    try {
      const allUsers = readJSON(REGISTERED_USERS_KEY, {});
      for (const email of Object.keys(allUsers)) {
        if (allUsers[email].role !== 'patient') continue;
        const stored = readJSON(`medisync_${email}_patient`, null);
        if (stored && stored.name) return stored;
      }
    } catch (e) {}
    return getDemoPatient();
  };

  const getAnyRecords = () => {
    try {
      const allUsers = readJSON(REGISTERED_USERS_KEY, {});
      for (const email of Object.keys(allUsers)) {
        if (allUsers[email].role !== 'patient') continue;
        const recs = readJSON(`medisync_${email}_records`, null);
        if (recs && recs.length) return recs;
      }
    } catch (e) {}
    return getDemoRecords();
  };

  const getPatient = () => {
    const currentUser = getCurrentUser();
    // Non-patient roles (doctor, paramedic) get the first registered patient for read-only views
    if (!currentUser || currentUser.role !== 'patient') return getAnyPatient();

    const patient = getUserData('patient', null);
    if (patient) return patient;
    return currentUser.email === 'patient@demo.com' ? getDemoPatient() : getDefaultPatient(currentUser);
  };

  const getAllRecords = () => {
    const currentUser = getCurrentUser();
    // Non-patient roles get any available patient's records for read-only views
    if (!currentUser || currentUser.role !== 'patient') return getAnyRecords();

    const records = getUserData('records', []);
    if (records.length) return records;
    return currentUser.email === 'patient@demo.com' ? getDemoRecords() : [];
  };

  const getRecordsByYear = () => {
    const byYear = {};
    getAllRecords().forEach((record) => {
      const year = record.date.split('-')[0];
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(record);
    });
    return byYear;
  };

  const getReminders = () => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'patient') return [];

    const reminders = getUserData('reminders', []);
    if (reminders.length) return reminders;
    return currentUser.email === 'patient@demo.com' ? getDemoReminders() : [];
  };

  const getDoctorProfile = () => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'doctor') return null;

    const stored = getUserData('doctor_profile', null);
    if (stored) return stored;
    return currentUser.email === 'doctor@demo.com' ? getDemoDoctorProfile() : getDefaultDoctorProfile(currentUser);
  };

  const updateDoctorProfile = (updates) => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'doctor') return null;

    const profile = {
      ...getDoctorProfile(),
      ...updates
    };
    profile.avatar = getInitials(profile.name, 'DR');
    setUserData('doctor_profile', profile);
    return profile;
  };

  const getDoctorPatients = () => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'doctor') return [];

    const patients = getUserData('doctor_patients', []);
    if (patients.length) return patients;
    return currentUser.email === 'doctor@demo.com' ? getDemoDoctorPatients() : [];
  };

  const getDoctorHistory = () => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'doctor') return [];

    const history = getUserData('doctor_history', []);
    if (history.length) return history;
    return currentUser.email === 'doctor@demo.com' ? getDemoDoctorHistory() : [];
  };

  const grantDoctorAccess = () => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'doctor') return null;

    const bundle = getScannablePatientBundle();
    if (!bundle?.patient) return null;

    const now = new Date().toISOString();
    const patientSummary = summarizePatientForDoctor(bundle.patient, now, bundle.records.length);

    const patients = getDoctorPatients();
    const existingIndex = patients.findIndex((item) => item.patientId === patientSummary.patientId);
    if (existingIndex >= 0) {
      patients[existingIndex] = { ...patients[existingIndex], ...patientSummary };
    } else {
      patients.unshift(patientSummary);
    }
    setUserData('doctor_patients', patients);

    const historyEntry = {
      id: createId('DH'),
      patientId: bundle.patient.id,
      patient: bundle.patient.name,
      accessedAt: now,
      duration: '15 min',
      status: 'completed'
    };
    const history = getDoctorHistory();
    history.unshift(historyEntry);
    setUserData('doctor_history', history);

    return {
      patient: bundle.patient,
      records: bundle.records,
      historyEntry
    };
  };

  const getDoctors = () => {
    const currentUser = getCurrentUser();
    const currentDoctor = currentUser?.role === 'doctor' ? getDoctorProfile() : null;
    const mappedDoctors = STATIC_DOCTORS.map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      specialization: doctor.specialization,
      hospital: doctor.hospitalName,
      hospitalName: doctor.hospitalName,
      avatar: doctor.avatar,
      patients: doctor.id === 'D001' ? 48 : doctor.id === 'D002' ? 61 : 35,
      nextSlot: doctor.nextSlot
    }));

    if (!currentDoctor) return mappedDoctors;

    const currentDoctorCard = {
      id: currentDoctor.id,
      name: currentDoctor.name,
      specialization: currentDoctor.specialization,
      hospital: currentDoctor.hospitalName,
      hospitalName: currentDoctor.hospitalName,
      avatar: currentDoctor.avatar,
      patients: getDoctorPatients().length,
      nextSlot: currentDoctor.nextSlot
    };

    return [
      currentDoctorCard,
      ...mappedDoctors.filter((doctor) => doctor.id !== currentDoctorCard.id && doctor.name !== currentDoctorCard.name)
    ];
  };

  const getHospitalProfile = () => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'hospital') return null;

    const stored = getUserData('hospital_profile', null);
    if (stored) return stored;
    return currentUser.email === 'hospital@demo.com' ? getDemoHospitalProfile() : getDefaultHospitalProfile(currentUser);
  };

  const getParamedicProfile = () => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'paramedic') return null;

    const stored = getUserData('paramedic_profile', null);
    if (stored) return stored;
    return currentUser.email === 'paramedic@demo.com' ? getDemoParamedicProfile() : getDefaultParamedicProfile(currentUser);
  };

  const getParamedicAlerts = () => getUserData('paramedic_alerts', []);

  return {
    initializeUserData,

    getPatient,
    getAllRecords,
    getRecordsByYear,
    getReminders,

    addReminder: (data) => {
      const reminders = getUserData('reminders', []);
      const reminder = { id: 'MED' + Date.now(), ...data, active: true };
      reminders.push(reminder);
      setUserData('reminders', reminders);
      return reminder;
    },

    markMedTaken: (remId, slot) => {
      const reminders = getUserData('reminders', []);
      const reminder = reminders.find((item) => item.id === remId);
      if (reminder) {
        reminder.taken[slot] = true;
        reminder.lastTaken = new Date().toISOString();
        setUserData('reminders', reminders);
      }
      return reminder;
    },

    toggleReminder: (remId) => {
      const reminders = getUserData('reminders', []);
      const reminder = reminders.find((item) => item.id === remId);
      if (reminder) {
        reminder.active = !reminder.active;
        setUserData('reminders', reminders);
      }
      return reminder;
    },

    deleteReminder: (remId) => {
      const reminders = getUserData('reminders', []);
      const filtered = reminders.filter((item) => item.id !== remId);
      setUserData('reminders', filtered);
      return true;
    },

    getDoctors,
    getDoctorProfile,
    updateDoctorProfile,
    getDoctorPatients,
    getDoctorHistory,
    grantDoctorAccess,
    getHospitalProfile,

    updateHospitalProfile: (updates) => {
      const currentUser = getCurrentUser();
      if (!currentUser || currentUser.role !== 'hospital') return null;
      const profile = { ...getHospitalProfile(), ...updates };
      if (updates.name) profile.avatar = getInitials(updates.name, 'HP');
      setUserData('hospital_profile', profile);
      return profile;
    },

    getParamedicProfile,

    updatePatient: (updatedPatient) => {
      const currentUser = getCurrentUser();
      if (!currentUser || currentUser.role !== 'patient') return null;
      setUserData('patient', updatedPatient);
      return updatedPatient;
    },

    getQRData: () => {
      const patient = getPatient();
      return { ...patient.qrData, patientId: patient.id, generatedAt: new Date().toISOString() };
    },

    generateConsent: (doctorId, patientId = 'P-24114045') => {
      const token = 'TKN-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      const expiresAt = Date.now() + 15 * 60 * 1000;
      consentTokens[token] = { doctorId, patientId, expiresAt, used: false };
      return { token, expiresAt, minutesValid: 15 };
    },

    validateConsent: (token) => {
      const tokenData = consentTokens[token];
      if (!tokenData) return { valid: false, reason: 'Token not found' };
      if (Date.now() > tokenData.expiresAt) return { valid: false, reason: 'Token expired' };
      return { valid: true, patientId: tokenData.patientId, doctorId: tokenData.doctorId };
    },

    getHospitalAlerts: () => getStoredHospitalAlerts(),
    getParamedicAlerts,

    addHospitalAlert: (alertData) => {
      const currentUser = getCurrentUser();
      const alert = {
        id: 'A' + Date.now(),
        timestamp: new Date().toISOString(),
        status: 'incoming',
        ...alertData
      };

      const alerts = getStoredHospitalAlerts();
      alerts.unshift(alert);
      setStoredHospitalAlerts(alerts);

      if (currentUser?.role === 'paramedic') {
        const paramedicAlerts = getParamedicAlerts();
        paramedicAlerts.unshift(alert);
        setUserData('paramedic_alerts', paramedicAlerts);
      }

      return alert;
    },

    updateAlertStatus: (alertId, status) => {
      const alerts = getStoredHospitalAlerts();
      const alert = alerts.find((item) => item.id === alertId);
      if (alert) alert.status = status;
      setStoredHospitalAlerts(alerts);

      const paramedicAlerts = getParamedicAlerts();
      const paramedicAlert = paramedicAlerts.find((item) => item.id === alertId);
      if (paramedicAlert) {
        paramedicAlert.status = status;
        setUserData('paramedic_alerts', paramedicAlerts);
      }

      return alert;
    },

    uploadRecord: (file, category) => {
      const records = getUserData('records', []);
      const newRecord = {
        id: 'R' + Date.now(),
        type: category,
        category: category === 'Lab Report' ? 'blue' : category === 'Prescription' ? 'green' : 'purple',
        title: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
        date: new Date().toISOString().split('T')[0],
        hospital: 'Uploaded by Patient',
        summary: 'AI processing... Document ingested. Category auto-detected.',
        file: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      };
      records.unshift(newRecord);
      setUserData('records', records);
      return newRecord;
    },

    getNearbyHospitals: async (lat, lng) => {
      try {
        const response = await fetch(`/api/places/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
        if (response.ok) return await response.json();
      } catch (_) {}

      return {
        results: [
          { name: 'Max Healthcare Roorkee', vicinity: 'Civil Lines, Roorkee' },
          { name: 'AIIMS Rishikesh', vicinity: 'Virbhadra Marg, Rishikesh' },
          { name: 'Civil Hospital Roorkee', vicinity: 'Station Road, Roorkee' },
          { name: 'Shri Guru Ram Rai Hospital', vicinity: 'Dehradun Road, Dehradun' },
          { name: 'Himalayan Hospital', vicinity: 'Jolly Grant, Dehradun' }
        ]
      };
    }
  };
})();

window.MediSyncDB = MediSyncDB;
