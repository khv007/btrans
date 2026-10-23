/**
 * LOGISTPAY - HAYDOVCHILAR DAVOMATI VA MAOSHINI TAQSIMLASH TIZIMI
 * Mualliflik: Logistika firmasi uchun to'liq boshqaruv tizimi
 */

(function () {
  'use strict';

  // ================= STORAGE KEYS =================
  const STORAGE_KEY = 'logistpay_database_v1';
  const SESSION_KEY = 'logistpay_active_session_v1';
  const THEME_KEY = 'logistpay_theme_mode_v1';
  const DEV_SECRET_PIN = '51605055960187';
  const DEV_LOCKOUT_KEY = 'logistpay_dev_security_v1';
  const DEV_LOCK_24H_MS = 24 * 60 * 60 * 1000;      // 24 soat
  const DEV_LOCK_7D_MS = 7 * 24 * 60 * 60 * 1000;    // 7 kun
  let currentSession = null;
  let isDevUnlocked = false;
  let devLockoutTimerInterval = null;

  // ================= LUCIDE ICONS RENDERER & AUTO OBSERVER =================
  function renderLucideIcons(root) {
    if (typeof window !== 'undefined' && typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
      try {
        window.lucide.createIcons(root ? { root } : undefined);
      } catch (e) {
        console.warn('Lucide createIcons xatosi:', e);
      }
    }
  }
  window.renderLucideIcons = renderLucideIcons;

  function initLucideAutoObserver() {
    if (typeof MutationObserver === 'undefined') return;
    let timer = null;
    const observer = new MutationObserver((mutations) => {
      let hasNewLucide = false;
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (node.hasAttribute && node.hasAttribute('data-lucide')) {
                hasNewLucide = true;
                break;
              }
              if (node.querySelector && node.querySelector('[data-lucide]')) {
                hasNewLucide = true;
                break;
              }
            }
          }
        }
        if (hasNewLucide) break;
      }
      if (hasNewLucide) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          renderLucideIcons();
        }, 20);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ================= THEME MANAGER (DARK / LIGHT) =================
  const ThemeManager = {
    init() {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme) {
        this.apply(savedTheme);
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.apply(prefersDark ? 'dark' : 'light');
      }

      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
          if (!localStorage.getItem(THEME_KEY)) {
            this.apply(e.matches ? 'dark' : 'light');
          }
        });
      }
    },

    getCurrent() {
      return document.documentElement.getAttribute('data-theme') || 'light';
    },

    apply(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      const icon = document.getElementById('theme-icon');
      const label = document.getElementById('theme-text-label');
      const metaTheme = document.getElementById('theme-color-meta');

      if (theme === 'dark') {
        if (icon) {
          icon.outerHTML = '<i data-lucide="sun" id="theme-icon"></i>';
          renderLucideIcons(icon.parentElement || document);
        }
        if (label) label.textContent = 'Yorug\'';
        if (metaTheme) metaTheme.setAttribute('content', '#0b0f19');
      } else {
        if (icon) {
          icon.outerHTML = '<i data-lucide="moon" id="theme-icon"></i>';
          renderLucideIcons(icon.parentElement || document);
        }
        if (label) label.textContent = 'Qorong\'i';
        if (metaTheme) metaTheme.setAttribute('content', '#4f46e5');
      }
    },

    toggle() {
      const current = this.getCurrent();
      const next = current === 'dark' ? 'light' : 'dark';
      this.apply(next);
      localStorage.setItem(THEME_KEY, next);
      showToast(next === 'dark' ? 'Qorong\'i rejim faollashtirildi' : 'Yorug\' rejim faollashtirildi', 'info');
    }
  };

  // ================= 14 VILOYAT VA MASOFALAR (KM) =================
  const REGIONS = [
    'Andijon',
    'Buxoro',
    'Farg\'ona',
    'Jizzax',
    'Xorazm',
    'Namangan',
    'Navoiy',
    'Qashqadaryo',
    'Samarqand',
    'Sirdaryo',
    'Surxondaryo',
    'Toshkent viloyati',
    'Toshkent shahri',
    'Qoraqalpog\'iston Res.'
  ];

  // O'zbekiston viloyatlari orasidagi real avtomobil yo'llari masofasi (km)
  const ROUTE_DISTANCES_KM = {
    // Andijon
    'Andijon|Namangan': 65,
    'Andijon|Farg\'ona': 75,
    'Andijon|Toshkent shahri': 360,
    'Andijon|Toshkent viloyati': 330,
    'Andijon|Sirdaryo': 280,
    'Andijon|Jizzax': 380,
    'Andijon|Samarqand': 470,
    'Andijon|Buxoro': 730,
    'Andijon|Navoiy': 630,
    'Andijon|Qashqadaryo': 620,
    'Andijon|Surxondaryo': 820,
    'Andijon|Xorazm': 1120,
    'Andijon|Qoraqalpog\'iston Res.': 1230,

    // Farg'ona
    'Farg\'ona|Namangan': 85,
    'Farg\'ona|Toshkent shahri': 315,
    'Farg\'ona|Toshkent viloyati': 290,
    'Farg\'ona|Sirdaryo': 240,
    'Farg\'ona|Jizzax': 340,
    'Farg\'ona|Samarqand': 430,
    'Farg\'ona|Buxoro': 690,
    'Farg\'ona|Navoiy': 590,
    'Farg\'ona|Qashqadaryo': 580,
    'Farg\'ona|Surxondaryo': 780,
    'Farg\'ona|Xorazm': 1080,
    'Farg\'ona|Qoraqalpog\'iston Res.': 1190,

    // Namangan
    'Namangan|Toshkent shahri': 295,
    'Namangan|Toshkent viloyati': 270,
    'Namangan|Sirdaryo': 220,
    'Namangan|Jizzax': 320,
    'Namangan|Samarqand': 410,
    'Namangan|Buxoro': 670,
    'Namangan|Navoiy': 570,
    'Namangan|Qashqadaryo': 560,
    'Namangan|Surxondaryo': 760,
    'Namangan|Xorazm': 1060,
    'Namangan|Qoraqalpog\'iston Res.': 1170,

    // Toshkent shahri
    'Toshkent shahri|Toshkent viloyati': 45,
    'Toshkent shahri|Sirdaryo': 120,
    'Toshkent shahri|Jizzax': 190,
    'Toshkent shahri|Samarqand': 310,
    'Toshkent shahri|Buxoro': 570,
    'Toshkent shahri|Navoiy': 480,
    'Toshkent shahri|Qashqadaryo': 450,
    'Toshkent shahri|Surxondaryo': 660,
    'Toshkent shahri|Xorazm': 970,
    'Toshkent shahri|Qoraqalpog\'iston Res.': 1080,

    // Toshkent viloyati
    'Toshkent viloyati|Sirdaryo': 85,
    'Toshkent viloyati|Jizzax': 160,
    'Toshkent viloyati|Samarqand': 280,
    'Toshkent viloyati|Buxoro': 540,
    'Toshkent viloyati|Navoiy': 450,
    'Toshkent viloyati|Qashqadaryo': 420,
    'Toshkent viloyati|Surxondaryo': 630,
    'Toshkent viloyati|Xorazm': 940,
    'Toshkent viloyati|Qoraqalpog\'iston Res.': 1050,

    // Sirdaryo
    'Sirdaryo|Jizzax': 100,
    'Sirdaryo|Samarqand': 190,
    'Sirdaryo|Buxoro': 450,
    'Sirdaryo|Navoiy': 360,
    'Sirdaryo|Qashqadaryo': 330,
    'Sirdaryo|Surxondaryo': 540,
    'Sirdaryo|Xorazm': 850,
    'Sirdaryo|Qoraqalpog\'iston Res.': 960,

    // Jizzax
    'Jizzax|Samarqand': 105,
    'Jizzax|Buxoro': 370,
    'Jizzax|Navoiy': 275,
    'Jizzax|Qashqadaryo': 240,
    'Jizzax|Surxondaryo': 460,
    'Jizzax|Xorazm': 770,
    'Jizzax|Qoraqalpog\'iston Res.': 880,

    // Samarqand
    'Samarqand|Buxoro': 270,
    'Samarqand|Navoiy': 170,
    'Samarqand|Qashqadaryo': 150,
    'Samarqand|Surxondaryo': 370,
    'Samarqand|Xorazm': 670,
    'Samarqand|Qoraqalpog\'iston Res.': 780,

    // Buxoro
    'Buxoro|Navoiy': 100,
    'Buxoro|Qashqadaryo': 165,
    'Buxoro|Surxondaryo': 385,
    'Buxoro|Xorazm': 440,
    'Buxoro|Qoraqalpog\'iston Res.': 550,

    // Navoiy
    'Navoiy|Qashqadaryo': 240,
    'Navoiy|Surxondaryo': 460,
    'Navoiy|Xorazm': 540,
    'Navoiy|Qoraqalpog\'iston Res.': 650,

    // Qashqadaryo
    'Qashqadaryo|Surxondaryo': 220,
    'Qashqadaryo|Xorazm': 605,
    'Qashqadaryo|Qoraqalpog\'iston Res.': 715,

    // Surxondaryo
    'Surxondaryo|Xorazm': 825,
    'Surxondaryo|Qoraqalpog\'iston Res.': 935,

    // Xorazm
    'Xorazm|Qoraqalpog\'iston Res.': 160
  };

  function getRouteDistanceKm(from, to) {
    if (!from || !to) return 85;
    if (from === to) return 0; // Bir xil viloyat ichidagi mahalliy reys (0 km / Mahalliy)
    const k1 = `${from}|${to}`;
    const k2 = `${to}|${from}`;
    if (ROUTE_DISTANCES_KM[k1]) return ROUTE_DISTANCES_KM[k1];
    if (ROUTE_DISTANCES_KM[k2]) return ROUTE_DISTANCES_KM[k2];
    return 100; // Standart o'rtacha masofa
  }

  // MINIMAL RUXSAT VAQTI FORMULASI:
  // - Bir xil viloyat (Namangan ➔ Namangan): qat'iy 30 daqiqa (30:00)
  // - Viloyatlararo: 70 km/s tezlik + 15 daqiqa texnik/yuklash vaqti
  function calculateMinAllowedMinutes(distanceKm, from = null, to = null) {
    if (from && to && from === to) {
      return 30; // Namangan ➔ Namangan: qat'iy 30:00 daqiqa
    }
    const km = Number(distanceKm);
    if (!km || km <= 0) return 30;
    const travelMinutes = Math.ceil((km / 70) * 60);
    return travelMinutes + 15;
  }

  function formatMinutesToUzbek(totalMinutes) {
    const total = Math.max(0, Math.round(totalMinutes));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h > 0) {
      return m > 0 ? `${h} soat ${m} daqiqa` : `${h} soat`;
    }
    return `${m} daqiqa`;
  }

  // ================= INITIAL DEMO DATA =================
  function getInitialData() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Previous days demo helper
    const prevDay1 = new Date(today);
    prevDay1.setDate(prevDay1.getDate() - 1);
    const prevDay1Str = prevDay1.toISOString().split('T')[0];

    const prevDay2 = new Date(today);
    prevDay2.setDate(prevDay2.getDate() - 2);
    const prevDay2Str = prevDay2.toISOString().split('T')[0];

    const daysInCurrentMonth = new Date(year, today.getMonth() + 1, 0).getDate();

    // 1. Mashinalar parki (Admin qo'shadi, haydovchi reysga chiqishda tanlaydi)
    const trucks = [
      { id: 'trk_1', name: 'Volvo FH 500', plateNumber: '01 A 777 AA' },
      { id: 'trk_2', name: 'MAN TGX 18.440', plateNumber: '10 B 555 BB' },
      { id: 'trk_3', name: 'Mercedes-Benz Actros', plateNumber: '40 C 999 CC' },
      { id: 'trk_4', name: 'Isuzu FTR 850', plateNumber: '60 D 111 DD' }
    ];

    // 2. Haydovchilar (Moshina qat'iy biriktirilmaydi)
    const drivers = [
      {
        id: 'drv_1',
        fullName: 'Alisher Rustamov',
        phone: '+998 90 123 45 67',
        monthlySalary: 12000000,
        login: 'alisher',
        password: '1234',
        createdAt: new Date().toISOString()
      },
      {
        id: 'drv_2',
        fullName: 'Botir Qodirov',
        phone: '+998 93 987 65 43',
        monthlySalary: 10500000,
        login: 'botir',
        password: '1234',
        createdAt: new Date().toISOString()
      },
      {
        id: 'drv_3',
        fullName: 'Jasur Xoliqov',
        phone: '+998 97 333 22 11',
        monthlySalary: 13500000,
        login: 'jasur',
        password: '1234',
        createdAt: new Date().toISOString()
      }
    ];

    const dailyRate1 = Math.round(12000000 / daysInCurrentMonth);
    const dailyRate2 = Math.round(10500000 / daysInCurrentMonth);
    const dailyRate3 = Math.round(13500000 / daysInCurrentMonth);

    // 3. Reyslar va Davomat (Bir kunda bir nechta reys bo'lishi mumkin)
    const attendances = [
      {
        id: 'att_demo_1',
        driverId: 'drv_1',
        driverName: 'Alisher Rustamov',
        phone: '+998 90 123 45 67',
        truckId: 'trk_1',
        truckName: 'Volvo FH 500',
        truckNumber: '01 A 777 AA',
        fromRegion: 'Namangan',
        toRegion: 'Farg\'ona',
        tripNumber: 1,
        date: prevDay2Str,
        checkInTime: '08:15:00',
        checkOutTime: '13:45:00',
        durationText: '5 soat 30 daqiqa',
        dailyRate: dailyRate1,
        earnedAmount: dailyRate1,
        status: 'completed'
      },
      {
        id: 'att_demo_2',
        driverId: 'drv_1',
        driverName: 'Alisher Rustamov',
        phone: '+998 90 123 45 67',
        truckId: 'trk_1',
        truckName: 'Volvo FH 500',
        truckNumber: '01 A 777 AA',
        fromRegion: 'Farg\'ona',
        toRegion: 'Namangan',
        tripNumber: 2,
        date: prevDay2Str,
        checkInTime: '14:30:00',
        checkOutTime: '19:10:00',
        durationText: '4 soat 40 daqiqa',
        dailyRate: dailyRate1,
        earnedAmount: 0, // Kuniga nechta reys bo'lsa ham kunlik stavka 1-reysda olinadi
        status: 'completed'
      },
      {
        id: 'att_demo_3',
        driverId: 'drv_2',
        driverName: 'Botir Qodirov',
        phone: '+998 93 987 65 43',
        truckId: 'trk_2',
        truckName: 'MAN TGX 18.440',
        truckNumber: '10 B 555 BB',
        fromRegion: 'Andijon',
        toRegion: 'Namangan',
        tripNumber: 1,
        date: prevDay1Str,
        checkInTime: '08:00:00',
        checkOutTime: '15:30:00',
        durationText: '7 soat 30 daqiqa',
        dailyRate: dailyRate2,
        earnedAmount: dailyRate2,
        status: 'completed'
      },
      {
        id: 'att_demo_4',
        driverId: 'drv_3',
        driverName: 'Jasur Xoliqov',
        phone: '+998 97 333 22 11',
        truckId: 'trk_3',
        truckName: 'Mercedes-Benz Actros',
        truckNumber: '40 C 999 CC',
        fromRegion: 'Namangan',
        toRegion: 'Andijon',
        tripNumber: 1,
        date: todayStr,
        checkInTime: '08:05:00',
        checkInTimestamp: Date.now() - (2 * 3600 * 1000), // 2 soat avval boshlangan
        checkOutTime: null,
        durationText: 'Davom etmoqda',
        dailyRate: dailyRate3,
        earnedAmount: 0,
        status: 'in_progress'
      }
    ];

    // 4. Smenalar (Ish kuni)
    const shifts = [
      {
        id: 'shf_demo_1',
        driverId: 'drv_1',
        driverName: 'Alisher Rustamov',
        date: prevDay2Str,
        startTime: '08:00:00',
        endTime: '19:30:00',
        status: 'completed',
        completedTrips: 2,
        earnedAmount: dailyRate1
      },
      {
        id: 'shf_demo_2',
        driverId: 'drv_2',
        driverName: 'Botir Qodirov',
        date: prevDay1Str,
        startTime: '07:45:00',
        endTime: '16:00:00',
        status: 'completed',
        completedTrips: 1,
        earnedAmount: dailyRate2
      },
      {
        id: 'shf_demo_3',
        driverId: 'drv_3',
        driverName: 'Jasur Xoliqov',
        date: todayStr,
        startTime: '08:00:00',
        endTime: null,
        status: 'active',
        completedTrips: 0,
        earnedAmount: 0
      }
    ];

    // 5. Avanslar ro'yxati (Admin bergan avanslar)
    const advances = [
      {
        id: 'adv_demo_1',
        driverId: 'drv_1',
        driverName: 'Alisher Rustamov',
        phone: '+998 90 123 45 67',
        amount: 500000,
        date: todayStr,
        time: '09:15:00',
        comment: 'Yo\'l xarajati va yoqilg\'i uchun avans'
      }
    ];

    return {
      superadmin: {
        username: 'AD2717578',
        password: '51605055960187'
      },
      admin: {
        username: 'admin123',
        password: 'admin321'
      },
      viewer: {
        username: 'Husanboy',
        password: '20050516'
      },
      deletedDriverIds: [],
      deletedTruckIds: [],
      trucks: trucks,
      drivers: drivers,
      attendances: attendances,
      shifts: shifts,
      advances: advances,
      salaryPayouts: []
    };
  }

  // ================= CLOUD STATUS HELPER =================
  function updateCloudStatusUI(connected, message) {
    const badge = document.getElementById('cloud-status-badge');
    const msgEl = document.getElementById('cloud-info-msg');
    const disconnectBtn = document.getElementById('btn-disconnect-firebase');

    if (badge) {
      if (connected) {
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        badge.style.color = '#10b981';
        badge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        badge.innerHTML = '<i data-lucide="check-circle-2"></i> Online Baza Faol';
      } else {
        badge.style.background = 'rgba(234, 179, 8, 0.15)';
        badge.style.color = '#eab308';
        badge.style.border = '1px solid rgba(234, 179, 8, 0.3)';
        badge.innerHTML = '<i data-lucide="triangle-alert"></i> Lokal rejim';
      }
    }

    if (msgEl) {
      if (message) {
        msgEl.style.display = 'block';
        msgEl.textContent = message;
        msgEl.style.color = connected ? '#10b981' : '#f59e0b';
      } else {
        msgEl.style.display = 'none';
      }
    }

    if (disconnectBtn) {
      disconnectBtn.style.display = connected ? 'inline-flex' : 'none';
    }
  }

  // ================= DATABASE CONTROLLER (LOCAL + FIREBASE FIRESTORE) =================
  const DB = {
    firestoreDb: null,
    firestoreDocRef: null,
    isCloudReady: false,
    unsubscribeSnapshot: null,

    initCloud() {
      if (typeof firebase === 'undefined') {
        updateCloudStatusUI(false, "Firebase kutubxonasi topilmadi (Offline yoki tarmoq xatosi)");
        return;
      }

      const cfg = window.FIREBASE_CONFIG;
      if (!cfg || !cfg.projectId || !cfg.apiKey) {
        updateCloudStatusUI(false, "Firebase ulanmagan. Barcha qurilmalardan bir xil kirish uchun sozlamalarni kiriting.");
        return;
      }

      try {
        if (!firebase.apps || firebase.apps.length === 0) {
          firebase.initializeApp(cfg);
        }
        this.firestoreDb = firebase.firestore();
        try {
          this.firestoreDb.settings({
            experimentalForceLongPolling: true,
            merge: true
          });
        } catch (settingsErr) {
          // Settings can only be applied once per session
        }
        this.firestoreDocRef = this.firestoreDb.collection('logistpay_system').doc('main_database');
        this.isCloudReady = true;

        // Populate textarea in admin panel if present
        const cfgTextarea = document.getElementById('firebase-config-json');
        if (cfgTextarea && !cfgTextarea.value) {
          cfgTextarea.value = JSON.stringify(cfg, null, 2);
        }

        const self = this;
        function extractCloudData(raw) {
          if (!raw) return null;
          if (raw.payload) {
            try {
              const parsed = typeof raw.payload === 'string' ? JSON.parse(raw.payload) : raw.payload;
              if (parsed && Array.isArray(parsed.drivers)) return parsed;
            } catch (e) {}
          }
          if (Array.isArray(raw.drivers)) return raw;
          return null;
        }

        function handleIncomingCloudData(cloudData) {
          if (!cloudData || !Array.isArray(cloudData.drivers)) return;
          
          const localData = self.loadLocalOnly();
          let needsCloudResave = false;
          
          // 1. Merge tombstones (deleted items) from both local and cloud
          const localDelDrivers = Array.isArray(localData?.deletedDriverIds) ? localData.deletedDriverIds : [];
          const cloudDelDrivers = Array.isArray(cloudData.deletedDriverIds) ? cloudData.deletedDriverIds : [];
          const mergedDeletedDriverIds = Array.from(new Set([...localDelDrivers, ...cloudDelDrivers]));
          cloudData.deletedDriverIds = mergedDeletedDriverIds;

          const localDelTrucks = Array.isArray(localData?.deletedTruckIds) ? localData.deletedTruckIds : [];
          const cloudDelTrucks = Array.isArray(cloudData.deletedTruckIds) ? cloudData.deletedTruckIds : [];
          const mergedDeletedTruckIds = Array.from(new Set([...localDelTrucks, ...cloudDelTrucks]));
          cloudData.deletedTruckIds = mergedDeletedTruckIds;

          // 2. SMART TWO-WAY MERGE: Mahalliy yangi ma'lumotlarni saqlab qolish (Zero Data Loss)
          // 2a. Haydovchilar
          const cloudDriverMap = new Map((cloudData.drivers || []).filter(d => d && !mergedDeletedDriverIds.includes(d.id)).map(d => [d.id, d]));
          const localValidDrivers = (localData?.drivers || []).filter(d => d && !mergedDeletedDriverIds.includes(d.id));
          localValidDrivers.forEach(ld => {
            if (!cloudDriverMap.has(ld.id)) {
              cloudDriverMap.set(ld.id, ld);
              needsCloudResave = true;
            }
          });
          cloudData.drivers = Array.from(cloudDriverMap.values());
          cloudData.drivers.forEach(drv => {
            if (drv && drv.phone) {
              const formatted = formatPhoneNumber(drv.phone);
              if (formatted && formatted !== drv.phone && formatted !== PHONE_PREFIX) {
                drv.phone = formatted;
                needsCloudResave = true;
              }
            }
          });

          // 2b. Mashinalar
          const cloudTruckMap = new Map((cloudData.trucks || []).filter(t => t && !mergedDeletedTruckIds.includes(t.id)).map(t => [t.id, t]));
          const localValidTrucks = (localData?.trucks || []).filter(t => t && !mergedDeletedTruckIds.includes(t.id));
          localValidTrucks.forEach(lt => {
            if (!cloudTruckMap.has(lt.id)) {
              cloudTruckMap.set(lt.id, lt);
              needsCloudResave = true;
            }
          });
          cloudData.trucks = Array.from(cloudTruckMap.values());

          // 2c. Reyslar (Attendances)
          const cloudAttMap = new Map((cloudData.attendances || []).filter(a => a && !mergedDeletedDriverIds.includes(a.driverId)).map(a => [a.id, a]));
          const localValidAtts = (localData?.attendances || []).filter(a => a && !mergedDeletedDriverIds.includes(a.driverId));
          localValidAtts.forEach(la => {
            if (!cloudAttMap.has(la.id)) {
              cloudAttMap.set(la.id, la);
              needsCloudResave = true;
            }
          });
          cloudData.attendances = Array.from(cloudAttMap.values());

          // 2d. Avanslar
          const cloudAdvMap = new Map((cloudData.advances || []).filter(adv => adv && !mergedDeletedDriverIds.includes(adv.driverId)).map(adv => [adv.id, adv]));
          const localValidAdvs = (localData?.advances || []).filter(adv => adv && !mergedDeletedDriverIds.includes(adv.driverId));
          localValidAdvs.forEach(la => {
            if (!cloudAdvMap.has(la.id)) {
              cloudAdvMap.set(la.id, la);
              needsCloudResave = true;
            }
          });
          cloudData.advances = Array.from(cloudAdvMap.values());

          // 2e. Smenalar (Shifts)
          const cloudShiftMap = new Map((cloudData.shifts || []).filter(s => s && !mergedDeletedDriverIds.includes(s.driverId)).map(s => [s.id, s]));
          const localValidShifts = (localData?.shifts || []).filter(s => s && !mergedDeletedDriverIds.includes(s.driverId));
          localValidShifts.forEach(ls => {
            if (!cloudShiftMap.has(ls.id)) {
              cloudShiftMap.set(ls.id, ls);
              needsCloudResave = true;
            }
          });
          cloudData.shifts = Array.from(cloudShiftMap.values());

          // 2f. Oylik to'lovlari (Salary payouts)
          const cloudPayoutMap = new Map((cloudData.salaryPayouts || []).filter(p => p && !mergedDeletedDriverIds.includes(p.driverId)).map(p => [p.id, p]));
          const localValidPayouts = (localData?.salaryPayouts || []).filter(p => p && !mergedDeletedDriverIds.includes(p.driverId));
          localValidPayouts.forEach(lp => {
            if (!cloudPayoutMap.has(lp.id)) {
              cloudPayoutMap.set(lp.id, lp);
              needsCloudResave = true;
            }
          });
          cloudData.salaryPayouts = Array.from(cloudPayoutMap.values());

          // 3. Ensure superadmin, viewer, and admin credentials exist
          if (!cloudData.superadmin) {
            cloudData.superadmin = localData?.superadmin || { username: 'AD2717578', password: '51605055960187' };
          }
          if (!cloudData.viewer || cloudData.viewer.username === 'kuzatuvchi') {
            cloudData.viewer = (localData?.viewer && localData.viewer.username !== 'kuzatuvchi')
              ? localData.viewer
              : { username: 'Husanboy', password: '20050516' };
          }
          if (!cloudData.admin) {
            cloudData.admin = localData?.admin || { username: 'admin123', password: 'admin321' };
          }

          appData = cloudData;
          self.saveLocal(appData);

          // Agar mahalliy yangi ma'lumotlar birlashtirilgan bo'lsa, bulutga ham darhol sinxronlab qo'yamiz
          if (needsCloudResave) {
            self.save(appData);
          }

          updateCloudStatusUI(true, "Firebase Firestore ga muvaffaqiyatli ulangan. Real-vaqt sinxronizatsiyasi faol!");
          
          if (currentSession) {
            renderCurrentView();
          }
        }

        // Fast initial direct GET
        this.firestoreDocRef.get().then(doc => {
          if (doc.exists) {
            const cloudData = extractCloudData(doc.data());
            if (cloudData) {
              handleIncomingCloudData(cloudData);
            }
          }
        }).catch(err => {
          console.warn("Direct get error:", err);
        });

        // Realtime sync listener across all devices / IPs
        if (this.unsubscribeSnapshot) {
          this.unsubscribeSnapshot();
        }

        this.unsubscribeSnapshot = this.firestoreDocRef.onSnapshot((doc) => {
          if (doc.exists) {
            const cloudData = extractCloudData(doc.data());
            if (cloudData) {
              handleIncomingCloudData(cloudData);
            }
          } else {
            // First time setup: upload current local data to Firestore
            self.save(appData);
            updateCloudStatusUI(true, "Boshlang'ich ma'lumotlar bulutli bazaga yuklandi.");
          }
        }, (err) => {
          console.warn("Firestore onSnapshot error:", err);
          updateCloudStatusUI(false, "Ulanish xatosi: " + err.message);
        });

      } catch (err) {
        console.error("Firebase init error:", err);
        updateCloudStatusUI(false, "Firebase xatosi: " + err.message);
      }
    },

    loadLocalOnly() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          const initial = getInitialData();
          this.saveLocal(initial);
          return initial;
        }
        const data = JSON.parse(raw);
        // Ensure admin login is updated to admin123 / admin321
        if (data.admin && (!data._adminCredsUpdatedV2 || data.admin.username === 'Admin' || data.admin.password === 'Admin123')) {
          data.admin.username = 'admin123';
          data.admin.password = 'admin321';
          data._adminCredsUpdatedV2 = true;
          this.saveLocal(data);
        }

        let needsSave = false;

        // Ensure deleted tombstones arrays exist
        data.deletedDriverIds = Array.isArray(data.deletedDriverIds) ? data.deletedDriverIds : [];
        data.deletedTruckIds = Array.isArray(data.deletedTruckIds) ? data.deletedTruckIds : [];

        // Filter out any records that belong to deleted drivers/trucks
        if (data.deletedDriverIds.length > 0) {
          data.drivers = (data.drivers || []).filter(d => d && !data.deletedDriverIds.includes(d.id));
          data.attendances = (data.attendances || []).filter(a => a && !data.deletedDriverIds.includes(a.driverId));
          data.advances = (data.advances || []).filter(adv => adv && !data.deletedDriverIds.includes(adv.driverId));
          data.shifts = (data.shifts || []).filter(s => s && !data.deletedDriverIds.includes(s.driverId));
          data.salaryPayouts = (data.salaryPayouts || []).filter(p => p && !data.deletedDriverIds.includes(p.driverId));
        }
        if (data.deletedTruckIds.length > 0) {
          data.trucks = (data.trucks || []).filter(t => t && !data.deletedTruckIds.includes(t.id));
        }

        // Ensure SuperAdmin credentials exist
        if (!data.superadmin) {
          data.superadmin = {
            username: 'AD2717578',
            password: '51605055960187'
          };
          needsSave = true;
        }

        // Ensure Kuzatuvchi (Viewer) credentials exist and migrate if old default
        if (!data.viewer || data.viewer.username === 'kuzatuvchi') {
          data.viewer = {
            username: 'Husanboy',
            password: '20050516'
          };
          needsSave = true;
        }

        // Ensure drivers exist as array
        if (!data.drivers || !Array.isArray(data.drivers)) {
          data.drivers = [];
          needsSave = true;
        } else {
          // Normalize existing driver phone numbers to +998 XX XXX XX XX
          data.drivers.forEach(drv => {
            if (drv && drv.phone) {
              const formatted = formatPhoneNumber(drv.phone);
              if (formatted && formatted !== drv.phone && formatted !== PHONE_PREFIX) {
                drv.phone = formatted;
                needsSave = true;
              }
            }
          });
        }

        // Ensure trucks exist as array and normalize plate numbers
        if (!data.trucks || !Array.isArray(data.trucks)) {
          data.trucks = [];
          needsSave = true;
        } else {
          data.trucks.forEach(t => {
            if (t && t.plateNumber) {
              const formatted = formatPlateNumber(t.plateNumber);
              if (formatted !== t.plateNumber) {
                t.plateNumber = formatted;
                needsSave = true;
              }
            }
          });
        }

        // Ensure shifts exist
        if (!data.shifts || !Array.isArray(data.shifts)) {
          data.shifts = [];
          needsSave = true;
        }

        // Ensure advances exist
        if (!data.advances || !Array.isArray(data.advances)) {
          data.advances = [];
          needsSave = true;
        }

        // Ensure salaryPayouts exist
        if (!data.salaryPayouts || !Array.isArray(data.salaryPayouts)) {
          data.salaryPayouts = [];
          needsSave = true;
        }

        // Ensure attendances have route, trip fields and uniform daily rate
        if (Array.isArray(data.attendances)) {
          const seenCompletedDays = new Set();
          // Sort chronologically
          data.attendances.sort((a, b) => (a.date + (a.checkInTime || '')).localeCompare(b.date + (b.checkInTime || '')));

          data.attendances.forEach(att => {
            if (!att.fromRegion) { att.fromRegion = 'Namangan'; needsSave = true; }
            if (!att.toRegion) { att.toRegion = 'Farg\'ona'; needsSave = true; }
            if (!att.distanceKm) {
              att.distanceKm = getRouteDistanceKm(att.fromRegion, att.toRegion);
              needsSave = true;
            }
            if (!att.minAllowedMinutes) {
              att.minAllowedMinutes = calculateMinAllowedMinutes(att.distanceKm);
              needsSave = true;
            }
            if (!att.tripNumber) { att.tripNumber = 1; needsSave = true; }
            if (!att.truckName) {
              const trk = data.trucks.find(t => (t.plateNumber || '').replace(/\s+/g, '') === (att.truckNumber || '').replace(/\s+/g, ''));
              att.truckName = trk ? trk.name : 'Volvo FH';
              needsSave = true;
            }

            // UNIFORM DAILY SALARY RULE: 1 kun uchun 1 kunlik stavka olinadi
            if (att.status === 'completed') {
              const dayKey = `${att.driverId}_${att.date}`;
              if (seenCompletedDays.has(dayKey)) {
                if (att.earnedAmount !== 0) {
                  att.earnedAmount = 0;
                  needsSave = true;
                }
              } else {
                seenCompletedDays.add(dayKey);
                if (att.earnedAmount === 0 && att.dailyRate > 0) {
                  att.earnedAmount = att.dailyRate;
                  needsSave = true;
                }
              }
            }
          });
        }

        if (needsSave) {
          this.saveLocal(data);
        }

        return data;
      } catch (err) {
        console.error('LocalStorage load error, reset to demo:', err);
        const initial = getInitialData();
        this.saveLocal(initial);
        return initial;
      }
    },

    saveLocal(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        // Avtomatik zaxiralash (Auto-backup): har doim oxirgi nusxani saqlaydi
        try {
          const backupPayload = JSON.stringify({
            savedAt: new Date().toISOString(),
            data: data
          });
          localStorage.setItem('logistpay_auto_backup_latest', backupPayload);
        } catch (backupErr) {
          // Xotira to'lib qolsa asosiy ishga xalaqit qilmaslik
        }
      } catch (e) {
        console.error('LocalStorage save error:', e);
      }
    },

    save(data) {
      this.saveLocal(data);
      if (this.isCloudReady && this.firestoreDocRef) {
        const payloadToSave = {
          payload: JSON.stringify(data),
          lastUpdated: new Date().toISOString(),
          systemName: "LogistPay",
          admin: data.admin,
          viewer: data.viewer,
          superadmin: data.superadmin,
          deletedDriverIds: data.deletedDriverIds || [],
          deletedTruckIds: data.deletedTruckIds || [],
          drivers: data.drivers,
          trucks: data.trucks
        };
        this.firestoreDocRef.set(payloadToSave).catch((err) => {
          console.error("Bulutli bazaga saqlashda xatolik:", err);
          showToast("Bulutli bazaga saqlashda xatolik: " + err.message, "danger");
        });
      }
    },

    syncToCloudNow() {
      if (!this.isCloudReady || !this.firestoreDocRef) {
        showToast("Avval Firebase sozlamalarini to'g'ri saqlang!", "warning");
        return;
      }
      const payloadToSave = {
        payload: JSON.stringify(appData),
        lastUpdated: new Date().toISOString(),
        systemName: "LogistPay",
        admin: appData.admin,
        viewer: appData.viewer,
        superadmin: appData.superadmin,
        deletedDriverIds: appData.deletedDriverIds || [],
        deletedTruckIds: appData.deletedTruckIds || [],
        drivers: appData.drivers,
        trucks: appData.trucks
      };
      return this.firestoreDocRef.set(payloadToSave).then(() => {
        showToast("Barcha ma'lumotlar Bulutli bazaga muvaffaqiyatli yuklandi!", "success");
        updateCloudStatusUI(true, "Ma'lumotlar bulut bilan to'liq sinxronlandi.");
      }).catch(err => {
        showToast("Yuklashda xatolik: " + err.message, "danger");
        updateCloudStatusUI(false, "Xatolik: " + err.message);
      });
    },

    disconnectCloud() {
      if (this.unsubscribeSnapshot) {
        this.unsubscribeSnapshot();
        this.unsubscribeSnapshot = null;
      }
      this.isCloudReady = false;
      this.firestoreDocRef = null;
      localStorage.removeItem('logistpay_firebase_config');
      window.FIREBASE_CONFIG = { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };
      const cfgTextarea = document.getElementById('firebase-config-json');
      if (cfgTextarea) cfgTextarea.value = '';
      updateCloudStatusUI(false, "Firebase ulanishi uzildi. Dastur faqat lokal rejimda ishlamoqda.");
      showToast("Firebase ulanishi uzildi", "info");
    },

    reset() {
      const initial = getInitialData();
      this.save(initial);
      return initial;
    }
  };

  // State
  let appData = DB.load();
  // ================= PAGINATION STATE & UNIVERSAL CONTROLS =================
  const paginationState = {
    attendance: { page: 1, pageSize: 10 },
    drivers: { page: 1, pageSize: 10 },
    advances: { page: 1, pageSize: 10 },
    users: { page: 1, pageSize: 10 }
  };

  function renderPaginationControls(containerId, totalItems, stateKey, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!totalItems || totalItems === 0) {
      container.innerHTML = '';
      return;
    }

    const state = paginationState[stateKey] || { page: 1, pageSize: 10 };
    const pageSize = state.pageSize;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    const currentPage = state.page;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);

    // Build page buttons list with smart ellipsis
    const pageButtons = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pageButtons.push(i);
    } else {
      if (currentPage <= 4) {
        pageButtons.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pageButtons.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pageButtons.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    const pagesHtml = pageButtons.map(p => {
      if (p === '...') {
        return `<span class="pagination-ellipsis">&hellip;</span>`;
      }
      const isActive = p === currentPage;
      return `<button type="button" class="pagination-page-btn ${isActive ? 'active' : ''}" data-page="${p}" ${isActive ? 'aria-current="page"' : ''}>${p}</button>`;
    }).join('');

    container.innerHTML = `
      <div class="pagination-bar">
        <div class="pagination-info">
          <span class="pagination-count-label">
            <strong>${startIndex + 1}–${endIndex}</strong> / Jami: <strong>${totalItems}</strong> ta
          </span>
          <div class="pagination-size-select-group">
            <label for="${stateKey}-size-select">Ko'rsatish:</label>
            <select id="${stateKey}-size-select" class="pagination-size-select" title="Sahifada qatorlar soni">
              <option value="10" ${pageSize === 10 ? 'selected' : ''}>10 ta</option>
              <option value="25" ${pageSize === 25 ? 'selected' : ''}>25 ta</option>
              <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 ta</option>
              <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 ta</option>
            </select>
          </div>
        </div>
        <div class="pagination-nav">
          <button type="button" class="pagination-btn prev-btn" ${currentPage <= 1 ? 'disabled' : ''} title="Oldingi sahifa">
            <i data-lucide="chevron-left"></i> <span>Oldingi</span>
          </button>
          <div class="pagination-pages">
            ${pagesHtml}
          </div>
          <button type="button" class="pagination-btn next-btn" ${currentPage >= totalPages ? 'disabled' : ''} title="Keyingi sahifa">
            <span>Keyingi</span> <i data-lucide="chevron-right"></i>
          </button>
        </div>
      </div>
    `;

    renderLucideIcons(container);

    const prevBtn = container.querySelector('.prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.page > 1) {
          state.page--;
          onPageChange();
        }
      });
    }

    const nextBtn = container.querySelector('.next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (state.page < totalPages) {
          state.page++;
          onPageChange();
        }
      });
    }

    container.querySelectorAll('.pagination-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page, 10);
        if (p && p !== state.page) {
          state.page = p;
          onPageChange();
        }
      });
    });

    const sizeSelect = container.querySelector(`#${stateKey}-size-select`);
    if (sizeSelect) {
      sizeSelect.addEventListener('change', (e) => {
        state.pageSize = parseInt(e.target.value, 10) || 10;
        state.page = 1;
        onPageChange();
      });
    }
  }

  // ================= UTILITIES =================
  function formatMoney(amount) {
    if (isNaN(amount) || amount === null) return "0 so'm";
    return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + " so'm";
  }

  // ================= TELEFON RAQAMLARI FORMATI VA MASKALASH TIZIMI =================
  const PHONE_PREFIX = '+998 ';

  function formatPhoneNumber(phone) {
    if (!phone) return PHONE_PREFIX;
    const digits = String(phone).replace(/\D/g, '');
    let national = '';
    if (digits.startsWith('998')) {
      national = digits.slice(3, 12);
    } else if (digits.length <= 9) {
      national = digits;
    } else {
      national = digits.slice(-9);
    }

    if (!national) return PHONE_PREFIX;

    let formatted = '+998';
    if (national.length > 0) formatted += ' ' + national.substring(0, 2);
    if (national.length > 2) formatted += ' ' + national.substring(2, 5);
    if (national.length > 5) formatted += ' ' + national.substring(5, 7);
    if (national.length > 7) formatted += ' ' + national.substring(7, 9);
    return formatted;
  }

  function maskPhoneNumber(phone) {
    if (!phone) return '-';
    const formatted = formatPhoneNumber(phone);
    if (!formatted || formatted === PHONE_PREFIX) return '-';
    let digitsCount = 0;
    const chars = formatted.split('');
    for (let i = chars.length - 1; i >= 0; i--) {
      if (/\d/.test(chars[i])) {
        chars[i] = '*';
        digitsCount++;
        if (digitsCount === 4) break;
      }
    }
    return chars.join('');
  }

  function setupPhoneInputMask(input) {
    if (!input || input._hasPhoneMask) return;
    input._hasPhoneMask = true;

    // Boshlang'ich qiymat: doimo +998 bilan boshlanishi kafolatlanadi
    if (!input.value || !input.value.startsWith(PHONE_PREFIX)) {
      input.value = input.value ? formatPhoneNumber(input.value) : PHONE_PREFIX;
    } else {
      input.value = formatPhoneNumber(input.value);
    }

    function applyFormat(preferredCursor) {
      const oldVal = input.value;
      const oldCursor = preferredCursor !== undefined ? preferredCursor : (input.selectionStart ?? oldVal.length);

      let digitsBeforeCursor = 0;
      for (let i = 0; i < oldCursor && i < oldVal.length; i++) {
        if (/\d/.test(oldVal[i])) digitsBeforeCursor++;
      }

      const digits = oldVal.replace(/\D/g, '');
      let national = digits.startsWith('998') ? digits.slice(3, 12) : digits.slice(0, 9);

      let formatted = PHONE_PREFIX;
      if (national.length > 0) formatted += national.substring(0, 2);
      if (national.length > 2) formatted += ' ' + national.substring(2, 5);
      if (national.length > 5) formatted += ' ' + national.substring(5, 7);
      if (national.length > 7) formatted += ' ' + national.substring(7, 9);

      input.value = formatted;

      // Kursorni raqamlar soniga mos yangi joyga to'g'ri o'tkazish
      let newCursor = 5;
      let countedDigits = 3; // +998 da 3 ta raqam
      if (digitsBeforeCursor <= 3) {
        newCursor = 5;
      } else {
        for (let i = 5; i < formatted.length; i++) {
          if (/\d/.test(formatted[i])) {
            countedDigits++;
            if (countedDigits === digitsBeforeCursor) {
              newCursor = i + 1;
              break;
            }
          }
        }
        if (countedDigits < digitsBeforeCursor) {
          newCursor = formatted.length;
        }
      }

      if (document.activeElement === input) {
        input.setSelectionRange(newCursor, newCursor);
      }
    }

    input.addEventListener('input', () => {
      applyFormat();
    });

    input.addEventListener('keydown', (e) => {
      const cursor = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;

      // Backspace bosilganda +998 o'chib ketmasligini qulflash
      if (e.key === 'Backspace') {
        if (cursor <= 5 && end <= 5) {
          e.preventDefault();
          input.setSelectionRange(5, 5);
          return;
        }
        // Agar tanlangan matn +998 prefiksini ham qamrab olgan bo'lsa
        if (cursor < 5 && end > 5) {
          e.preventDefault();
          const keptAfter = input.value.substring(end);
          input.value = PHONE_PREFIX + keptAfter;
          applyFormat(5);
          return;
        }
        // Agar kursor probeldan keyin turgan bo'lsa, probeldan oldingi raqamni o'chirish
        if (cursor === end && cursor > 5 && input.value[cursor - 1] === ' ') {
          e.preventDefault();
          const val = input.value;
          input.value = val.slice(0, cursor - 2) + val.slice(cursor);
          applyFormat(cursor - 2);
          return;
        }
      }

      // Delete tugmasi bosilganda
      if (e.key === 'Delete') {
        if (cursor < 5) {
          e.preventDefault();
          input.setSelectionRange(5, 5);
          return;
        }
        if (cursor === end && input.value[cursor] === ' ') {
          e.preventDefault();
          const val = input.value;
          input.value = val.slice(0, cursor) + val.slice(cursor + 2);
          applyFormat(cursor);
          return;
        }
      }

      // Home tugmasi bosilganda kursorni +998 dan oldinga o'tkazmaslik
      if (e.key === 'Home') {
        e.preventDefault();
        input.setSelectionRange(5, 5);
        return;
      }
    });

    input.addEventListener('focus', () => {
      if (!input.value || !input.value.startsWith(PHONE_PREFIX)) {
        input.value = PHONE_PREFIX;
      }
      setTimeout(() => {
        if (input.selectionStart < 5) {
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 10);
    });

    input.addEventListener('click', () => {
      if (input.selectionStart < 5) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });

    input.addEventListener('mouseup', () => {
      if (input.selectionStart < 5) {
        input.setSelectionRange(Math.max(5, input.selectionStart), Math.max(5, input.selectionEnd));
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const digits = pasted.replace(/\D/g, '');
      let national = digits.startsWith('998') ? digits.slice(3, 12) : digits.slice(0, 9);

      let currentDigits = input.value.replace(/\D/g, '');
      let currentNational = currentDigits.startsWith('998') ? currentDigits.slice(3) : '';
      let combined = (national.length >= 9) ? national : (currentNational + national).slice(0, 9);

      let formatted = PHONE_PREFIX;
      if (combined.length > 0) formatted += combined.substring(0, 2);
      if (combined.length > 2) formatted += ' ' + combined.substring(2, 5);
      if (combined.length > 5) formatted += ' ' + combined.substring(5, 7);
      if (combined.length > 7) formatted += ' ' + combined.substring(7, 9);

      input.value = formatted;
      input.setSelectionRange(formatted.length, formatted.length);
    });

    input.addEventListener('blur', () => {
      if (!input.value || input.value.trim() === '' || !input.value.startsWith(PHONE_PREFIX)) {
        input.value = PHONE_PREFIX;
      }
    });

    // Form reset qilinganda +998 o'chib ketmasligi
    const form = input.closest('form');
    if (form && !form._hasPhoneResetListener) {
      form._hasPhoneResetListener = true;
      form.addEventListener('reset', () => {
        setTimeout(() => {
          form.querySelectorAll('.phone-input-mask, #new-driver-phone, #edit-user-phone, #add-user-phone').forEach(inp => {
            inp.value = PHONE_PREFIX;
          });
        }, 0);
      });
    }
  }

  function initAllPhoneInputMasks() {
    const selector = '.phone-input-mask, #new-driver-phone, #edit-user-phone, #add-user-phone';
    document.querySelectorAll(selector).forEach(el => {
      if (el) setupPhoneInputMask(el);
    });
  }

  // ================= DAVLAT RAQAMLARI FORMATI VA AVTO-MASKA TIZIMI =================
  function formatPlateNumber(val) {
    if (!val) return '';
    const clean = String(val).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) return '';

    // O'zbekiston viloyat kodi (01-95) bilan boshlansa
    if (/^\d{2}/.test(clean)) {
      const region = clean.slice(0, 2);
      const rest = clean.slice(2);

      if (!rest) return region;

      // Type 1: Jismoniy shaxs formati (masalan: 50 A 003 AA yoki 01 A 777 AA)
      if (/^[A-Z]/.test(rest)) {
        const p1 = rest.slice(0, 1);
        const afterP1 = rest.slice(1);
        if (!afterP1) return `${region} ${p1}`;

        const digitsMatch = afterP1.match(/^\d{1,3}/);
        if (digitsMatch) {
          const digits = digitsMatch[0];
          const afterDigits = afterP1.slice(digits.length);
          if (!afterDigits) return `${region} ${p1} ${digits}`;
          const suffix = afterDigits.replace(/[^A-Z]/g, '').slice(0, 2);
          return `${region} ${p1} ${digits}` + (suffix ? ` ${suffix}` : '');
        } else {
          return `${region} ${p1}`;
        }
      }

      // Type 2 & 3: Yuridik shaxs (50 003 AAA) yoki Pritsep (50 1234 AA)
      const digitsMatch = rest.match(/^\d+/);
      if (digitsMatch) {
        const allDigits = digitsMatch[0];
        const afterDigits = rest.slice(allDigits.length);
        const suffixLetters = afterDigits.replace(/[^A-Z]/g, '');

        if (allDigits.length >= 4) {
          const d4 = allDigits.slice(0, 4);
          const s2 = suffixLetters.slice(0, 2);
          return `${region} ${d4}` + (s2 ? ` ${s2}` : '');
        } else {
          const d3 = allDigits.slice(0, 3);
          const s3 = suffixLetters.slice(0, 3);
          return `${region} ${d3}` + (s3 ? ` ${s3}` : '');
        }
      }
    }

    return String(val).trim().toUpperCase().replace(/\s+/g, ' ');
  }
  window.formatPlateNumber = formatPlateNumber;

  function setupPlateInputMask(input) {
    if (!input || input._hasPlateMask) return;
    input._hasPlateMask = true;

    function applyFormat() {
      const oldVal = input.value;
      const oldCursor = input.selectionStart ?? oldVal.length;

      let nonSpacesBefore = 0;
      for (let i = 0; i < oldCursor && i < oldVal.length; i++) {
        if (oldVal[i] !== ' ') nonSpacesBefore++;
      }

      const formatted = formatPlateNumber(oldVal);
      input.value = formatted;

      let newCursor = 0;
      let count = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ' ') count++;
        if (count === nonSpacesBefore) {
          newCursor = i + 1;
          break;
        }
      }
      if (nonSpacesBefore === 0) newCursor = 0;
      if (count < nonSpacesBefore) newCursor = formatted.length;

      if (document.activeElement === input) {
        input.setSelectionRange(newCursor, newCursor);
      }
    }

    input.addEventListener('input', applyFormat);

    input.addEventListener('keydown', (e) => {
      const cursor = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;

      // Backspace probelda tursa, probeldan oldingi belgini ham o'chirish
      if (e.key === 'Backspace' && cursor === end && cursor > 0 && input.value[cursor - 1] === ' ') {
        e.preventDefault();
        const val = input.value;
        input.value = val.slice(0, cursor - 2) + val.slice(cursor);
        applyFormat();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      input.value = formatPlateNumber(pasted);
      applyFormat();
    });
  }
  window.setupPlateInputMask = setupPlateInputMask;

  function initAllPlateInputMasks() {
    const selector = '#new-truck-plate, .truck-plate-input';
    document.querySelectorAll(selector).forEach(el => {
      if (el) setupPlateInputMask(el);
    });
  }
  window.initAllPlateInputMasks = initAllPlateInputMasks;

  // ================= XSS SANITIZATION HELPER =================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getCurrentTimeString() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function calculateDailyRate(monthlySalary) {
    // 25 ish kuni standarti (Oylik / 25 kun)
    return Math.round((Number(monthlySalary) || 0) / 25);
  }

  function getUzbekDateComment(dateObj = new Date()) {
    const monthsUz = [
      'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
      'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
    ];
    const daysUz = [
      'yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'
    ];
    const day = dateObj.getDate();
    const month = monthsUz[dateObj.getMonth()];
    const weekDay = daysUz[dateObj.getDay()];
    return `${day}-${month} ${weekDay} reys bo'lmadi`;
  }

  function getPreviousMonthString(monthStr) {
    if (!monthStr || !monthStr.includes('-')) return '';
    const [y, m] = monthStr.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const prevY = date.getFullYear();
    const prevM = String(date.getMonth() + 1).padStart(2, '0');
    return `${prevY}-${prevM}`;
  }

  function getPreviousMonthCarryover(driverId, currentMonthStr) {
    if (!appData || !Array.isArray(appData.salaryPayouts)) return 0;
    const prevMonthStr = getPreviousMonthString(currentMonthStr);
    if (!prevMonthStr) return 0;
    const prevPayout = appData.salaryPayouts.find(p => p.driverId === driverId && p.month === prevMonthStr);
    if (!prevPayout) return 0;
    return Number(prevPayout.difference) || 0;
  }

  // ================= UNIFORM MONTHLY SALARY SUMMARY =================
  // Kuniga nechta reys bo'lsa ham oylik bir xil davom etadi: 1 kun = 1 kunlik stavka
  function getDriverMonthSummary(driverId, monthPrefix) {
    const driver = appData.drivers.find(d => d.id === driverId);
    if (!driver) {
      return {
        driver: null,
        daysWorked: 0,
        completedTripsCount: 0,
        dailyRate: 0,
        totalEarned: 0,
        directAdvances: 0,
        carryover: 0,
        carryoverDebt: 0,
        carryoverCredit: 0,
        totalAdvances: 0,
        netSalary: 0
      };
    }

    const dailyRate = calculateDailyRate(driver.monthlySalary);

    // Filter attendances (trips)
    const logs = appData.attendances.filter(a => a.driverId === driverId && a.date.startsWith(monthPrefix));
    const completedTrips = logs.filter(a => a.status === 'completed');

    // Unique calendar days worked where at least 1 trip completed or shift completed
    const workedDates = new Set();
    completedTrips.forEach(a => workedDates.add(a.date));
    (appData.shifts || [])
      .filter(s => s.driverId === driverId && s.date.startsWith(monthPrefix) && s.status === 'completed')
      .forEach(s => workedDates.add(s.date));

    // Daily salary rule: har bir ishlangan kun uchun faqat 1 marta kunlik stavka
    const totalEarned = workedDates.size * dailyRate;

    // Advances for this driver in selected month (direct advances)
    const driverAdvances = (appData.advances || []).filter(adv => 
      adv.driverId === driverId && (!adv.date || adv.date.startsWith(monthPrefix))
    );
    const directAdvances = driverAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    // Carryover from previous month (agar oldingi oyda ortiqcha to'langan bo'lsa qarz, kam to'langan bo'lsa haq)
    const carryover = getPreviousMonthCarryover(driverId, monthPrefix);
    const carryoverDebt = carryover > 0 ? carryover : 0; // Haydovchi qarzi -> bu oydagi avansga qo'shiladi
    const carryoverCredit = carryover < 0 ? Math.abs(carryover) : 0; // Kompaniya qarzi -> haydovchi haqi

    const totalAdvances = directAdvances + carryoverDebt;
    const netSalary = Math.max(0, totalEarned - totalAdvances + carryoverCredit);

    return {
      driver,
      daysWorked: workedDates.size,
      completedTripsCount: completedTrips.length,
      dailyRate,
      totalEarned,
      directAdvances,
      carryover,
      carryoverDebt,
      carryoverCredit,
      totalAdvances,
      netSalary
    };
  }

  function calculateDuration(startTimeStr, endTimeStr) {
    if (!startTimeStr || !endTimeStr) return '0 daqiqa';
    const [h1, m1, s1] = startTimeStr.split(':').map(Number);
    const [h2, m2, s2] = endTimeStr.split(':').map(Number);
    
    let totalSeconds = (h2 * 3600 + m2 * 60 + (s2 || 0)) - (h1 * 3600 + m1 * 60 + (s1 || 0));
    if (totalSeconds < 0) totalSeconds += 24 * 3600; // if over midnight

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} soat ${minutes} daq`;
    }
    return `${minutes} daqiqa`;
  }

  // ================= SECURE TIMEKEEPER & ANTI-TAMPER SHIELD =================
  const TimeKeeper = {
    serverOffsetMs: 0,
    lastWallClock: Date.now(),
    lastPerfTime: (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0,
    isTampered: false,

    init() {
      // Periodically monitor clock drift against monotonic timer
      setInterval(() => {
        this.checkClockDrift();
      }, 2000);

      this.syncNetworkTime();
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => this.syncNetworkTime());
      }
    },

    syncNetworkTime() {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
          .then(res => {
            const dateHeader = res.headers.get('date');
            if (dateHeader) {
              const serverTime = new Date(dateHeader).getTime();
              if (!isNaN(serverTime)) {
                this.serverOffsetMs = serverTime - Date.now();
                this.isTampered = false;
              }
            }
          })
          .catch(() => {});
      } catch (e) {}
    },

    checkClockDrift() {
      if (typeof performance === 'undefined' || !performance.now) return;
      const currentWall = Date.now();
      const currentPerf = performance.now();

      const wallDelta = currentWall - this.lastWallClock;
      const perfDelta = currentPerf - this.lastPerfTime;

      // Detect if user artificially jumped wall clock forward by more than 30 seconds within a 2-second interval
      if (wallDelta > perfDelta + 30000) {
        this.isTampered = true;
      }
      // Detect if user wound the clock backwards by more than 5 seconds
      if (wallDelta < -5000) {
        this.isTampered = true;
      }

      this.lastWallClock = currentWall;
      this.lastPerfTime = currentPerf;
    },

    getNow() {
      return Date.now() + this.serverOffsetMs;
    }
  };
  TimeKeeper.init();

  // ================= MINIMAL RUXSAT VAQTI (70 KM/S + 15 DAQ) NAZORATI =================
  function getTripStartTime(trip) {
    if (trip && trip.started_at) {
      return Number(trip.started_at);
    }
    if (trip && trip.checkInTimestamp) {
      return Number(trip.checkInTimestamp);
    }
    if (trip && trip.date && trip.checkInTime) {
      const [y, m, d] = trip.date.split('-').map(Number);
      const [h, min, s] = trip.checkInTime.split(':').map(Number);
      return new Date(y, m - 1, d, h, min, s || 0).getTime();
    }
    return Date.now();
  }

  // Web Audio chime for trip unlocked event (Native Web Audio API, shared context, works offline)
  let sharedAudioCtx = null;
  function getSharedAudioContext() {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    return sharedAudioCtx;
  }

  // Pre-unlock audio context on first user interaction gesture (touch or click)
  function setupAudioUnlock() {
    const unlock = () => {
      try {
        const ctx = getSharedAudioContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume();
        }
      } catch (e) {}
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('click', unlock, { passive: true });
    document.addEventListener('touchstart', unlock, { passive: true });
  }
  setupAudioUnlock();

  function playTripUnlockedSound() {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      
      // Tone 1 (Warm D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2 (Cheerful A5 resolution)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.18);
      gain2.gain.setValueAtTime(0.25, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.65);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  function triggerTripUnlockNotification() {
    playTripUnlockedSound();
    if ('vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 250]); } catch (e) {}
    }
    showToast("🎉 Minimal ruxsat vaqti o'tdi! Reysni muvaffaqiyatli yakunlashingiz mumkin.", "success");
  }

  function getTripMinAllowed(trip) {
    const from = trip?.fromRegion || 'Namangan';
    const to = trip?.toRegion || 'Farg\'ona';
    const isSameRegion = from && to && from === to;

    let distanceKm = Number(trip?.distanceKm !== undefined ? trip.distanceKm : (trip?.distance_km !== undefined ? trip.distance_km : NaN));
    if (isNaN(distanceKm) || distanceKm < 0) {
      distanceKm = isSameRegion ? 0 : getRouteDistanceKm(from, to);
    }
    // Strict dynamic formula calculation: guarantees stale cache never breaks countdown
    const minMinutes = isSameRegion ? 30 : calculateMinAllowedMinutes(distanceKm, from, to);
    const minMs = minMinutes * 60 * 1000;
    return { distanceKm, minMinutes, minMs, isSameRegion };
  }

  function getTripLockStatus(trip) {
    if (!trip) {
      return {
        isLocked: false,
        distanceKm: 0,
        minMinutes: 0,
        minMs: 0,
        elapsedMs: 0,
        remainingMs: 0,
        elapsedStr: '0 daqiqa',
        countdownStr: '00:00:00',
        remainingUzbek: '0 daqiqa',
        remainingShortUzbek: '0 daq',
        unlockClockStr: '--:--',
        startClockStr: '--:--',
        percent: 100
      };
    }

    const { distanceKm, minMinutes, minMs, isSameRegion } = getTripMinAllowed(trip);
    const startMs = getTripStartTime(trip);
    const now = TimeKeeper.getNow();
    const isClockBackwards = now < startMs;
    let elapsedMs = Math.max(0, now - startMs);

    const isLocked = elapsedMs < minMs || isClockBackwards || TimeKeeper.isTampered;
    let remainingMs = isClockBackwards ? minMs : Math.max(0, minMs - elapsedMs);

    // Clock unlock time (HH:MM)
    const unlockDate = new Date(startMs + minMs);
    const unlockH = String(unlockDate.getHours()).padStart(2, '0');
    const unlockM = String(unlockDate.getMinutes()).padStart(2, '0');
    const unlockClockStr = `${unlockH}:${unlockM}`;

    const startDate = new Date(startMs);
    const startH = String(startDate.getHours()).padStart(2, '0');
    const startM = String(startDate.getMinutes()).padStart(2, '0');
    const startClockStr = `${startH}:${startM}`;

    // Elapsed formatting
    const elH = Math.floor(elapsedMs / 3600000);
    const elM = Math.floor((elapsedMs % 3600000) / 60000);
    const elS = Math.floor((elapsedMs % 60000) / 1000);
    const elapsedStr = elH > 0
      ? `${elH} soat ${elM} daq ${elS} soniya`
      : `${elM} daqiqa ${elS} soniya`;

    // Countdown formatting (HH:MM:SS)
    const remH = Math.floor(remainingMs / 3600000);
    const remM = Math.floor((remainingMs % 3600000) / 60000);
    const remS = Math.floor((remainingMs % 60000) / 1000);
    const countdownStr = `${String(remH).padStart(2, '0')}:${String(remM).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
    const remainingUzbek = remH > 0 
      ? `${remH} soat ${remM} daqiqa`
      : `${remM} daqiqa ${remS} soniya`;
    const remainingShortUzbek = remH > 0 
      ? `${remH} soat ${remM} daq`
      : `${remM} daq ${remS} son`;

    const percent = minMs > 0 ? Math.min(100, Math.round((elapsedMs / minMs) * 100)) : 100;

    return {
      isLocked,
      distanceKm,
      minMinutes,
      minMs,
      isSameRegion,
      elapsedMs,
      remainingMs,
      elapsedStr,
      countdownStr,
      remainingUzbek,
      remainingShortUzbek,
      unlockClockStr,
      startClockStr,
      percent,
      remH,
      remM,
      remS
    };
  }

  // ================= TOAST NOTIFICATIONS =================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'danger') iconName = 'triangle-alert';
    if (type === 'warning') iconName = 'bell';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="margin-top:2px; width:1.25rem; height:1.25rem; flex-shrink:0;"></i>
      <div style="flex:1;">${message}</div>
    `;

    container.appendChild(toast);
    renderLucideIcons(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // ================= LIVE CLOCK & DATE (KUN, OY, YIL + VAQT) =================
  const UZ_MONTHS = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
  ];

  function formatDisplayDate(dateObj = new Date()) {
    const day = dateObj.getDate();
    const month = UZ_MONTHS[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${day}-${month}, ${year}`;
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  }

  function formatDigitalTime(dateObj = new Date()) {
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    const ss = String(dateObj.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function initClock() {
    const timeEl = document.getElementById('live-time-text');
    const dateEl = document.getElementById('live-date-text');
    let lastDateStr = '';

    function update() {
      const now = new Date();
      if (timeEl) {
        timeEl.textContent = formatDigitalTime(now);
      }
      if (dateEl) {
        const currentDateStr = formatDisplayDate(now);
        if (currentDateStr !== lastDateStr) {
          dateEl.textContent = currentDateStr;
          lastDateStr = currentDateStr;
        }
      }
    }
    update();
    setInterval(update, 1000);
  }

  // ================= SESSION MANAGEMENT (Strict Browser Session: Closes on exit) =================
  function checkExistingSession() {
    try {
      // Doimo qat'iy xavfsizlik: localStorage'dagi eski doimiy sessiyalarni o'chiramiz
      localStorage.removeItem(SESSION_KEY);
      
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        currentSession = JSON.parse(stored);
        renderCurrentView();
        return;
      }
    } catch (e) {
      console.warn('Session check failed', e);
    }
    showLoginView();
  }

  function setSession(session) {
    currentSession = session;
    try {
      // Faqatgina ochiq turgan brauzer sessiyasi (sessionStorage) uchun saqlanadi
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.warn('Session save failed', e);
    }
    renderCurrentView();
  }

  // Quick Demo Login Helper
  window.quickFillLogin = function (username, password) {
    const uInput = document.getElementById('login-username');
    const pInput = document.getElementById('login-password');
    if (uInput && pInput) {
      uInput.value = username;
      pInput.value = password;
      const form = document.getElementById('login-form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  };

  function logout() {
    if (window.driverTripTimer) {
      clearInterval(window.driverTripTimer);
      window.driverTripTimer = null;
    }
    document.body.classList.remove('is-viewer');
    isDevUnlocked = false;
    currentSession = null;
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    showLoginView();
    showToast('Tizimdan muvaffaqiyatli chiqdingiz', 'info');
  }

  // ================= VIEW SWITCHING =================
  function hideAllViews() {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const headerUser = document.getElementById('header-user-info');
    if (headerUser) headerUser.style.display = 'none';
  }

  function showLoginView() {
    document.body.classList.remove('is-viewer');
    hideAllViews();
    const loginSection = document.getElementById('login-section');
    if (loginSection) loginSection.classList.add('active');
    
    // Clear inputs
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
  }

  function updateSystemCredentialsDisplay() {
    const credsShowcase = document.getElementById('system-credentials-showcase');
    if (!credsShowcase) return;
    credsShowcase.style.display = 'none';

    const showAdmCard = document.getElementById('showcase-admin-card');
    const showViewCard = document.getElementById('showcase-viewer-card');
    const showcaseTitle = document.getElementById('credentials-showcase-title');

    const showAdmLogin = document.getElementById('showcase-admin-login');
    const showAdmPass = document.getElementById('showcase-admin-pass');
    const showViewLogin = document.getElementById('showcase-viewer-login');
    const showViewPass = document.getElementById('showcase-viewer-pass');

    if (showAdmLogin) showAdmLogin.textContent = appData.admin?.username || 'admin123';
    if (showAdmPass) showAdmPass.textContent = appData.admin?.password || 'admin321';
    if (showViewLogin) showViewLogin.textContent = appData.viewer?.username || 'Husanboy';
    if (showViewPass) showViewPass.textContent = appData.viewer?.password || '20050516';

    if (currentSession?.role === 'viewer') {
      if (showAdmCard) showAdmCard.style.display = 'none';
      if (showViewCard) showViewCard.style.display = 'flex';
      if (showcaseTitle) showcaseTitle.innerHTML = '<i data-lucide="key" class="text-warning"></i> Kuzatuvchi Hisobi (Nazorat Uchun)';
    } else {
      if (showAdmCard) showAdmCard.style.display = 'flex';
      if (showViewCard) showViewCard.style.display = 'none';
      if (showcaseTitle) showcaseTitle.innerHTML = '<i data-lucide="key" class="text-warning"></i> Bosh Administrator Hisobi (Nazorat Uchun)';
    }
  }

  function renderCurrentView() {
    if (!currentSession) {
      showLoginView();
      return;
    }

    hideAllViews();
    const headerUser = document.getElementById('header-user-info');
    const userNameEl = document.getElementById('header-user-name');
    const userRoleEl = document.getElementById('header-user-role');
    const userAvatarEl = document.getElementById('header-user-avatar');
    const tabSettingsText = document.getElementById('tab-settings-nav-text');

    if (headerUser) headerUser.style.display = 'flex';
    const superTabBtn = document.getElementById('tab-btn-users-management');

    if (currentSession.role === 'superadmin') {
      document.body.classList.remove('is-viewer');
      userNameEl.textContent = 'Super Administrator';
      userRoleEl.textContent = '👑 SuperAdmin';
      userRoleEl.className = 'user-role-badge superadmin-badge';
      userAvatarEl.className = 'user-avatar superadmin-avatar';
      userAvatarEl.innerHTML = '<i data-lucide="crown"></i>';

      if (superTabBtn) superTabBtn.style.display = 'inline-flex';
      if (tabSettingsText) tabSettingsText.textContent = 'Admin Sozlamalari';

      const vBanner = document.getElementById('viewer-alert-banner');
      if (vBanner) vBanner.style.display = 'none';

      updateSystemCredentialsDisplay();

      const adminSec = document.getElementById('admin-section');
      if (adminSec) adminSec.classList.add('active');
      renderAdminDashboard();
      renderUsersManagement();
    } else if (currentSession.role === 'admin') {
      if (superTabBtn) superTabBtn.style.display = 'none';
      if (userAvatarEl) userAvatarEl.className = 'user-avatar';
      const activeTabBtn = document.querySelector('.tab-btn.active');
      if (activeTabBtn && activeTabBtn.dataset.tab === 'tab-users-management') {
        window.switchAdminTab('tab-attendance');
      }

      document.body.classList.remove('is-viewer');
      userNameEl.textContent = 'Bosh Administrator';
      userRoleEl.textContent = 'Rahbar';
      userRoleEl.className = 'user-role-badge';
      userAvatarEl.innerHTML = '<i data-lucide="shield-check"></i>';

      if (tabSettingsText) tabSettingsText.textContent = 'Admin Sozlamalari';

      const vBanner = document.getElementById('viewer-alert-banner');
      if (vBanner) vBanner.style.display = 'none';

      updateSystemCredentialsDisplay();

      const adminSec = document.getElementById('admin-section');
      if (adminSec) adminSec.classList.add('active');
      renderAdminDashboard();
    } else if (currentSession.role === 'viewer') {
      if (superTabBtn) superTabBtn.style.display = 'none';
      if (userAvatarEl) userAvatarEl.className = 'user-avatar';
      const activeTabBtn = document.querySelector('.tab-btn.active');
      if (activeTabBtn && activeTabBtn.dataset.tab === 'tab-users-management') {
        window.switchAdminTab('tab-attendance');
      }
      document.body.classList.add('is-viewer');
      userNameEl.textContent = currentSession.username || appData.viewer?.username || 'Kuzatuvchi (Monitoring)';
      userRoleEl.textContent = "Faqat ko'rish";
      userRoleEl.className = 'user-role-badge';
      userAvatarEl.innerHTML = '<i data-lucide="eye"></i>';

      if (tabSettingsText) tabSettingsText.textContent = 'Kuzatuvchi Sozlamalari';

      const vBanner = document.getElementById('viewer-alert-banner');
      if (vBanner) vBanner.style.display = 'flex';

      updateSystemCredentialsDisplay();
      populateViewerSettings();

      const adminSec = document.getElementById('admin-section');
      if (adminSec) adminSec.classList.add('active');
      renderAdminDashboard();
    } else if (currentSession.role === 'driver') {
      const driver = appData.drivers.find(d => d.id === currentSession.driverId);
      if (!driver) {
        showToast("Haydovchi ma'lumotlari topilmadi", 'danger');
        logout();
        return;
      }

      userNameEl.textContent = driver.fullName;
      userRoleEl.textContent = 'Haydovchi';
      userRoleEl.className = 'user-role-badge';
      userAvatarEl.innerHTML = '<i data-lucide="truck"></i>';

      const driverSec = document.getElementById('driver-section');
      if (driverSec) driverSec.classList.add('active');
      renderDriverView(driver);
    }
  }

  // ================= DRIVER VIEW LOGIC =================
  function renderDriverView(driver) {
    const today = new Date();
    const todayStr = getTodayString();
    const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const dailyRate = calculateDailyRate(driver.monthlySalary);

    // Profile Info
    document.getElementById('driver-name').textContent = driver.fullName;
    document.getElementById('driver-phone').textContent = formatPhoneNumber(driver.phone);
    document.getElementById('driver-monthly-salary').textContent = formatMoney(driver.monthlySalary);
    document.getElementById('driver-daily-rate').textContent = formatMoney(dailyRate);
    const hintDaysEl = document.getElementById('driver-days-in-month-hint');
    if (hintDaysEl) hintDaysEl.textContent = '(25 ish kuni standarti)';

    // Date header
    const dateFormatted = today.toLocaleDateString('uz-UZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    document.getElementById('driver-today-date').innerHTML = `<i data-lucide="calendar-days"></i> ${dateFormatted}`;

    // Get Monthly Summary for this driver (Uniform daily salary)
    const summary = getDriverMonthSummary(driver.id, currentMonthPrefix);

    // Today's trips
    const todayTrips = appData.attendances.filter(att => 
      att.driverId === driver.id && att.date === todayStr
    );
    const todayCompletedTrips = todayTrips.filter(att => att.status === 'completed');

    // Update KPI stats
    const tripsCountEl = document.getElementById('driver-trips-count');
    if (tripsCountEl) {
      tripsCountEl.textContent = `${todayCompletedTrips.length} (bugun) • ${summary.completedTripsCount} (oyda)`;
    }
    const tripsHintEl = document.getElementById('driver-trips-hint');
    if (tripsHintEl) {
      tripsHintEl.textContent = `Bugun: ${todayCompletedTrips.length} ta • ${summary.daysWorked} kun ishlangan`;
    }

    document.getElementById('driver-earned-salary').textContent = formatMoney(summary.totalEarned);

    // Olingan avans kartasi (joriy oy uchun)
    const driverAdvances = (appData.advances || []).filter(adv => 
      adv.driverId === driver.id && (!adv.date || adv.date.startsWith(currentMonthPrefix))
    );
    const advanceCardVal = document.getElementById('driver-advance-card-val');
    const advanceCardHint = document.getElementById('driver-advance-card-hint');
    if (advanceCardVal) {
      if (summary.totalAdvances > 0) {
        advanceCardVal.textContent = `-${formatMoney(summary.totalAdvances)}`;
        if (advanceCardHint) advanceCardHint.textContent = `${driverAdvances.length} ta avans olingan`;
      } else {
        advanceCardVal.textContent = "0 so'm";
        if (advanceCardHint) advanceCardHint.textContent = "Avans olinmagan";
      }
    }

    // Sof to'lanadigan qoldiq
    const netCardVal = document.getElementById('driver-net-salary-card-val');
    if (netCardVal) {
      netCardVal.textContent = formatMoney(summary.netSalary);
    }

    // Haydovchilar reytingi preview kartasi
    updateDriverRankingCardPreview(driver, currentMonthPrefix);

    // Avans Banneri
    const advanceBanner = document.getElementById('driver-advance-banner');
    if (advanceBanner) {
      if (summary.totalAdvances > 0) {
        advanceBanner.style.display = 'flex';
        document.getElementById('driver-advance-badge-val').textContent = `-${formatMoney(summary.totalAdvances)}`;
        document.getElementById('driver-advance-net-val').textContent = formatMoney(summary.netSalary);
      } else {
        advanceBanner.style.display = 'none';
      }
    }

    // Populate truck select dropdown (with occupied/free status, disabled occupied trucks, and manual selection)
    const truckSelect = document.getElementById('driver-trip-truck');
    const truckStatusHint = document.getElementById('driver-trip-truck-status');
    const truckAvailSummary = document.getElementById('truck-availability-summary');

    if (truckSelect) {
      const allTrucks = appData.trucks || [];
      const inProgressTrips = (appData.attendances || []).filter(a => a.status === 'in_progress');

      let freeCount = 0;
      let busyCount = 0;

      let optionsHtml = '<option value="">-- Mashinani qo\'lda tanlang (Bo\'sh mashinalar) --</option>';

      allTrucks.forEach(t => {
        const busyTrip = inProgressTrips.find(a => 
          a.truckId === t.id || (a.truckNumber && a.truckNumber.replace(/\s+/g, '').toUpperCase() === (t.plateNumber || '').replace(/\s+/g, '').toUpperCase())
        );

        if (busyTrip) {
          busyCount++;
          optionsHtml += `<option value="${escapeHtml(t.id)}" disabled style="color:#ef4444; background:rgba(239,68,68,0.08); font-weight:600;">⛔ ${escapeHtml(t.name)} (${escapeHtml(t.plateNumber)}) — BAND [${escapeHtml(busyTrip.driverName)} reysda]</option>`;
        } else {
          freeCount++;
          optionsHtml += `<option value="${escapeHtml(t.id)}">🟢 ${escapeHtml(t.name)} (${escapeHtml(t.plateNumber)}) — Bo'sh (Parkda)</option>`;
        }
      });

      truckSelect.innerHTML = optionsHtml;
      // CRITICAL: NEVER auto-select a truck! Always force manual selection!
      truckSelect.value = '';

      if (truckAvailSummary) {
        truckAvailSummary.innerHTML = `<span style="color:#10b981; font-weight:700;"><i data-lucide="check-circle-2"></i> ${freeCount} ta bo'sh</span> / <span style="color:#ef4444; font-weight:700;"><i data-lucide="ban"></i> ${busyCount} ta band</span>`;
      }

      function updateTruckHint() {
        if (!truckStatusHint) return;
        const val = truckSelect.value;

        if (!val) {
          if (freeCount === 0) {
            truckStatusHint.className = 'truck-select-status-hint busy';
            truckStatusHint.innerHTML = `<i data-lucide="triangle-alert"></i> <span><strong>Diqqat:</strong> Hozirda barcha ${allTrucks.length} ta mashina band! Reysni boshlash uchun boshqa haydovchi reysni tugatishini kuting.</span>`;
          } else {
            truckStatusHint.className = 'truck-select-status-hint empty';
            truckStatusHint.innerHTML = `<i data-lucide="pointer"></i> <span>Iltimos, yuqoridagi ro'yxatdan bo'sh mashinani qo'lda tanlang (${freeCount} ta bo'sh mashina mavjud).</span>`;
          }
          return;
        }

        const selected = allTrucks.find(t => t.id === val);
        if (!selected) return;

        const busyTrip = inProgressTrips.find(a => 
          a.truckId === selected.id || (a.truckNumber && a.truckNumber.replace(/\s+/g, '').toUpperCase() === (selected.plateNumber || '').replace(/\s+/g, '').toUpperCase())
        );

        if (busyTrip) {
          truckStatusHint.className = 'truck-select-status-hint busy';
          truckStatusHint.innerHTML = `<i data-lucide="ban"></i> <span><strong>Band mashina!</strong> Ushbu mashinada hozir <strong>${busyTrip.driverName}</strong> reysda (${busyTrip.fromRegion} ➔ ${busyTrip.toRegion}). Uni tanlab bo'lmaydi.</span>`;
        } else {
          truckStatusHint.className = 'truck-select-status-hint free';
          truckStatusHint.innerHTML = `<i data-lucide="check-circle-2"></i> <span><strong>Tanlandi:</strong> ${selected.name} (${selected.plateNumber}) — Mashina parkda bo'sh, reysga tayyor!</span>`;
        }
      }

      truckSelect.onchange = updateTruckHint;
      updateTruckHint();
    }

    function updateRouteDistancePreview() {
      const fromSel = document.getElementById('driver-trip-from');
      const toSel = document.getElementById('driver-trip-to');
      const kmEl = document.getElementById('preview-distance-km');
      const timeEl = document.getElementById('preview-min-time');
      const formulaEl = document.getElementById('preview-min-formula');
      if (!fromSel || !toSel) return;
      const fromVal = fromSel.value;
      const toVal = toSel.value;

      if (fromVal && toVal && fromVal === toVal) {
        if (kmEl) kmEl.innerHTML = `<span style="color:var(--success); font-weight:700;"><i data-lucide="map-pin"></i> Viloyat ichida (Mahalliy)</span>`;
        if (timeEl) timeEl.textContent = "30:00 daqiqa";
        if (formulaEl) formulaEl.textContent = "(Viloyat ichida qat'iy 30 daq)";
        const unlockTimeEl = document.getElementById('preview-unlock-time');
        if (unlockTimeEl) {
          const unlockDate = new Date(Date.now() + 30 * 60 * 1000);
          const hh = String(unlockDate.getHours()).padStart(2, '0');
          const mm = String(unlockDate.getMinutes()).padStart(2, '0');
          unlockTimeEl.textContent = `~${hh}:${mm}`;
        }
        return;
      }

      const km = getRouteDistanceKm(fromVal, toVal);
      const minMin = calculateMinAllowedMinutes(km, fromVal, toVal);
      if (kmEl) kmEl.textContent = `${km} km`;
      if (timeEl) timeEl.textContent = formatMinutesToUzbek(minMin);
      if (formulaEl) formulaEl.textContent = "(70 km/s + 15 daq)";

      const unlockTimeEl = document.getElementById('preview-unlock-time');
      if (unlockTimeEl) {
        const unlockDate = new Date(Date.now() + minMin * 60 * 1000);
        const hh = String(unlockDate.getHours()).padStart(2, '0');
        const mm = String(unlockDate.getMinutes()).padStart(2, '0');
        unlockTimeEl.textContent = `~${hh}:${mm}`;
      }
    }
    window.updateRouteDistancePreview = updateRouteDistancePreview;

    // Populate regions dropdowns
    const fromSelect = document.getElementById('driver-trip-from');
    const toSelect = document.getElementById('driver-trip-to');
    if (fromSelect && toSelect) {
      if (!fromSelect.children.length) {
        fromSelect.innerHTML = REGIONS.map(r => `<option value="${r}">${r}</option>`).join('');
        toSelect.innerHTML = REGIONS.map(r => `<option value="${r}">${r}</option>`).join('');
        fromSelect.value = 'Namangan';
        toSelect.value = 'Farg\'ona';
      }
      fromSelect.onchange = updateRouteDistancePreview;
      toSelect.onchange = updateRouteDistancePreview;
      fromSelect.addEventListener('input', updateRouteDistancePreview);
      toSelect.addEventListener('input', updateRouteDistancePreview);
      updateRouteDistancePreview();
    }

    // Clear previous timer if any
    if (window.driverTripTimer) {
      clearInterval(window.driverTripTimer);
      window.driverTripTimer = null;
    }

    // ================= STATE DETECTION =================
    if (!appData.shifts) appData.shifts = [];
    const todayShift = appData.shifts.find(s => s.driverId === driver.id && s.date === todayStr);
    const activeTrip = appData.attendances.find(att => att.driverId === driver.id && att.status === 'in_progress');

    // UI Action elements
    const actionsContainer = document.getElementById('driver-actions-container');
    const btnStartShift = document.getElementById('btn-start-shift');
    const btnStartTrip = document.getElementById('btn-start-trip');
    const btnStartTripTitle = document.getElementById('btn-start-trip-title');
    const btnStartTripSub = document.getElementById('btn-start-trip-sub');
    const btnFinishTrip = document.getElementById('btn-finish-trip');
    const btnEndShift = document.getElementById('btn-end-shift');

    const badgeEl = document.getElementById('driver-shift-badge');
    const badgeTextEl = document.getElementById('driver-shift-badge-text');
    if (badgeEl) badgeEl.className = 'status-indicator-pill';

    const tripConfigBox = document.getElementById('driver-trip-config-box');
    const activeTripBox = document.getElementById('driver-active-trip-box');
    const driverTruckTag = document.getElementById('driver-truck');
    const alertBox = document.getElementById('driver-shift-completed-alert');

    // Shift times elements
    const shiftStartDisp = document.getElementById('today-shift-start-display');
    const shiftDateDisp = document.getElementById('today-shift-date');
    const tripsCountDisp = document.getElementById('today-trips-count-display');
    const tripsStatusHint = document.getElementById('today-trip-status-hint');
    const shiftEndDisp = document.getElementById('today-shift-end-display');
    const shiftEndStatus = document.getElementById('today-shift-end-status');

    // Reset base displays
    if (alertBox) alertBox.style.display = 'none';
    if (btnStartShift) btnStartShift.style.display = 'none';
    if (btnStartTrip) btnStartTrip.style.display = 'none';
    if (btnFinishTrip) btnFinishTrip.style.display = 'none';
    if (btnEndShift) btnEndShift.style.display = 'none';

    // ---------------- STATE 1: TODAY'S SHIFT COMPLETED ----------------
    if (todayShift && todayShift.status === 'completed') {
      if (badgeEl) badgeEl.classList.add('completed');
      if (badgeTextEl) badgeTextEl.textContent = `🏁 Bugungi ish yakunlangan (${todayCompletedTrips.length} ta reys)`;

      if (driverTruckTag) driverTruckTag.textContent = 'Bugungi smena yakunlandi';
      if (tripConfigBox) tripConfigBox.style.display = 'none';
      if (activeTripBox) activeTripBox.style.display = 'none';
      if (actionsContainer) actionsContainer.style.display = 'none';

      if (shiftStartDisp) shiftStartDisp.textContent = todayShift.startTime || '--:--:--';
      if (shiftDateDisp) shiftDateDisp.innerHTML = `<i data-lucide="calendar-days"></i> Sana: ${formatShortDate(todayStr)}`;
      if (tripsCountDisp) tripsCountDisp.textContent = `${todayCompletedTrips.length} ta reys`;
      if (tripsStatusHint) tripsStatusHint.textContent = `Barcha reyslar yakunlandi`;
      if (shiftEndDisp) shiftEndDisp.textContent = todayShift.endTime || '--:--:--';
      if (shiftEndStatus) shiftEndStatus.innerHTML = `<span style="color:var(--success); font-weight:700;"><i data-lucide="check-circle-2"></i> To'liq yakunlandi</span>`;

      if (alertBox) {
        alertBox.style.display = 'flex';
        const titleEl = document.getElementById('alert-completed-title');
        const descEl = document.getElementById('alert-completed-desc');
        const credEl = document.getElementById('alert-credited-amount');
        if (titleEl) titleEl.textContent = "Bugungi ish kuni to'liq yakunlandi!";
        if (credEl) credEl.textContent = formatMoney(dailyRate);
        if (descEl) descEl.innerHTML = `Bugun jami <strong>${todayCompletedTrips.length} ta reys</strong> muvaffaqiyatli bajarildi. Ushbu ish kuni uchun 1 kunlik stavka (<strong>${formatMoney(dailyRate)}</strong>) hisoblangan maoshingizga qo'shildi. Dam oling!`;
      }
    }
    // ---------------- STATE 2: REYS JARAYONIDA (IN PROGRESS TRIP) ----------------
    else if (activeTrip) {
      if (actionsContainer) {
        actionsContainer.style.display = 'grid';
        actionsContainer.className = 'action-buttons-wrapper single-col';
      }

      const isSameRegion = activeTrip.fromRegion === activeTrip.toRegion;
      if (badgeEl) badgeEl.classList.add('working');
      if (badgeTextEl) {
        badgeTextEl.textContent = isSameRegion 
          ? `🟢 Reysda: ${activeTrip.fromRegion} (Viloyat ichida)`
          : `🟢 Reysda: ${activeTrip.fromRegion} ➔ ${activeTrip.toRegion}`;
      }

      if (driverTruckTag) {
        driverTruckTag.textContent = `${activeTrip.truckName || ''} (${activeTrip.truckNumber})`;
      }

      const activeDistKm = activeTrip.distanceKm !== undefined ? activeTrip.distanceKm : (isSameRegion ? 0 : getRouteDistanceKm(activeTrip.fromRegion, activeTrip.toRegion));
      const distBadge = document.getElementById('active-trip-distance-badge');
      if (distBadge) {
        distBadge.textContent = isSameRegion ? "Viloyat ichida" : `${activeDistKm} km`;
      }

      if (tripConfigBox) tripConfigBox.style.display = 'none';
      if (activeTripBox) {
        activeTripBox.style.display = 'flex';
        const tripLbl = document.getElementById('active-trip-label');
        const fromEl = document.getElementById('active-trip-from');
        const toEl = document.getElementById('active-trip-to');
        const trkEl = document.getElementById('active-trip-truck');
        if (tripLbl) tripLbl.textContent = `Reys #${activeTrip.tripNumber || 1} davom etmoqda`;
        if (fromEl) fromEl.textContent = activeTrip.fromRegion;
        if (toEl) toEl.textContent = activeTrip.toRegion;
        if (trkEl) trkEl.textContent = `${activeTrip.truckName || 'Fura'} (${activeTrip.truckNumber})`;
      }

      if (shiftStartDisp) shiftStartDisp.textContent = todayShift ? todayShift.startTime : activeTrip.checkInTime;
      if (shiftDateDisp) shiftDateDisp.innerHTML = `<i data-lucide="calendar-days"></i> Sana: ${formatShortDate(activeTrip.date)}`;
      if (tripsCountDisp) tripsCountDisp.textContent = `${todayCompletedTrips.length} ta tugatilgan (Reys #${activeTrip.tripNumber || 1} yo'lda)`;
      if (tripsStatusHint) tripsStatusHint.textContent = `Reys davom etmoqda`;
      if (shiftEndDisp) shiftEndDisp.textContent = '--:--:--';
      if (shiftEndStatus) shiftEndStatus.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Minimal vaqt kutilmoqda...`;

      // Show ONLY finish trip button
      if (btnFinishTrip) btnFinishTrip.style.display = 'flex';

      let prevLockedState = true;
      function updateLockCard() {
        const lockStatus = getTripLockStatus(activeTrip);
        const isSame = lockStatus.isSameRegion || activeTrip.fromRegion === activeTrip.toRegion;
        const minUzbek = isSame ? "30:00 daqiqa" : formatMinutesToUzbek(lockStatus.minMinutes);

        const lockCard = document.getElementById('trip-lock-status-card');
        const lockIcon = document.getElementById('trip-lock-icon');
        const lockTitle = document.getElementById('trip-lock-title');
        const lockSub = document.getElementById('trip-lock-sub');
        const countdownEl = document.getElementById('trip-lock-countdown');
        const progressBar = document.getElementById('trip-lock-progress-bar');
        const elapsedDisp = document.getElementById('trip-elapsed-display');
        const statusDisp = document.getElementById('trip-status-display');
        const unlockClockVal = document.getElementById('trip-unlock-clock-val');
        const btnFinishTitle = document.getElementById('btn-finish-trip-title');
        const btnFinishSub = document.getElementById('btn-finish-trip-sub');
        const btnFinishIcon = document.getElementById('btn-finish-trip-icon');

        if (countdownEl) countdownEl.textContent = lockStatus.countdownStr;
        if (elapsedDisp) {
          const valSpan = elapsedDisp.querySelector('.elapsed-disp-val');
          if (!valSpan) {
            elapsedDisp.innerHTML = `<i data-lucide="timer"></i> Boshlanganiga: <span class="elapsed-disp-val">${lockStatus.elapsedStr}</span>`;
            renderLucideIcons(elapsedDisp);
          } else {
            valSpan.textContent = lockStatus.elapsedStr;
          }
        }

        if (lockStatus.isLocked) {
          prevLockedState = true;
          // Locked (< min_allowed_minutes)
          if (btnFinishTrip) {
            btnFinishTrip.disabled = true;
            btnFinishTrip.classList.remove('unlocked-ready');
            btnFinishTrip.title = isSame
              ? `Viloyat ichida reys uchun minimal 30:00 daqiqa talab qilinadi. Qolgan vaqt: ${lockStatus.remainingUzbek}`
              : `Masofa: ${lockStatus.distanceKm} km uchun minimal ${minUzbek} talab qilinadi. Qolgan vaqt: ${lockStatus.remainingUzbek}`;
          }

          if (btnFinishTitle) btnFinishTitle.textContent = "🔒 Reysni yakunlash";
          if (btnFinishSub) btnFinishSub.textContent = `Qolgan vaqt: ${lockStatus.countdownStr} (Minimal: ${minUzbek})`;
          if (btnFinishIcon && btnFinishIcon.getAttribute('data-state') !== 'locked') {
            btnFinishIcon.setAttribute('data-state', 'locked');
            btnFinishIcon.outerHTML = '<i data-lucide="lock" id="btn-finish-trip-icon" data-state="locked"></i>';
            renderLucideIcons();
          }

          if (lockCard) lockCard.classList.remove('unlocked');
          if (lockIcon && lockIcon.getAttribute('data-state') !== 'locked') {
            lockIcon.setAttribute('data-state', 'locked');
            lockIcon.outerHTML = '<i data-lucide="lock" id="trip-lock-icon" data-state="locked"></i>';
            renderLucideIcons();
          }
          if (lockTitle) lockTitle.textContent = isSame
            ? `Minimal ruxsat vaqti: 30:00 daqiqa (Viloyat ichida)`
            : `Minimal ruxsat vaqti: ${minUzbek} (${lockStatus.distanceKm} km)`;
          if (lockSub) lockSub.textContent = isSame
            ? "Viloyat ichida mahalliy reys uchun qat'iy 30:00 daqiqa qulflangan"
            : `70 km/s + 15 daq asosida (Ochilish vaqti: ~${lockStatus.unlockClockStr})`;
          if (statusDisp) {
            statusDisp.className = "lock-status-badge locked";
            const timerSpan = statusDisp.querySelector('.status-disp-time');
            if (!timerSpan) {
              statusDisp.innerHTML = `<i data-lucide="lock"></i> Qulflangan <span class="status-disp-time countdown-timer">(${lockStatus.remainingShortUzbek})</span>`;
              renderLucideIcons(statusDisp);
            } else {
              timerSpan.textContent = `(${lockStatus.remainingShortUzbek})`;
            }
          }
          if (shiftEndStatus) {
            const timerSpan = shiftEndStatus.querySelector('.shift-end-countdown');
            if (!timerSpan) {
              shiftEndStatus.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Minimal vaqt kutilmoqda <span class="shift-end-countdown countdown-timer">(${lockStatus.countdownStr})</span>`;
              renderLucideIcons(shiftEndStatus);
            } else {
              timerSpan.textContent = `(${lockStatus.countdownStr})`;
            }
          }
        } else {
          // Check if just transitioned from locked to unlocked
          if (prevLockedState) {
            prevLockedState = false;
            triggerTripUnlockNotification();
          }

          // Unlocked (>= min_allowed_minutes)
          if (btnFinishTrip) {
            btnFinishTrip.disabled = false;
            btnFinishTrip.classList.add('unlocked-ready');
            btnFinishTrip.title = "Minimal ruxsat vaqti o'tdi. Reysni yakunlash mumkin";
          }

          if (btnFinishTitle) btnFinishTitle.textContent = "🟢 Reysni yakunlash";
          if (btnFinishSub) btnFinishSub.textContent = `Ruxsat berildi (${minUzbek} o'tdi)`;
          if (btnFinishIcon && btnFinishIcon.getAttribute('data-state') !== 'unlocked') {
            btnFinishIcon.setAttribute('data-state', 'unlocked');
            btnFinishIcon.outerHTML = '<i data-lucide="check-circle-2" id="btn-finish-trip-icon" data-state="unlocked"></i>';
            renderLucideIcons();
          }

          if (lockCard) lockCard.classList.add('unlocked');
          if (lockIcon && lockIcon.getAttribute('data-state') !== 'unlocked') {
            lockIcon.setAttribute('data-state', 'unlocked');
            lockIcon.outerHTML = '<i data-lucide="lock-open" id="trip-lock-icon" data-state="unlocked"></i>';
            renderLucideIcons();
          }
          if (lockTitle) lockTitle.textContent = `✅ Minimal ruxsat vaqti (${minUzbek}) bajarildi!`;
          if (lockSub) lockSub.textContent = "Endi reysni muvaffaqiyatli yakunlashingiz mumkin";
          if (statusDisp) {
            statusDisp.className = "lock-status-badge unlocked";
            if (!statusDisp.querySelector('[data-state="unlocked"]')) {
              statusDisp.innerHTML = `<i data-lucide="check-circle-2" data-state="unlocked"></i> Tugatish ruxsat etildi`;
              renderLucideIcons(statusDisp);
            }
          }
          if (shiftEndStatus) {
            if (!shiftEndStatus.querySelector('[data-state="unlocked"]')) {
              shiftEndStatus.innerHTML = `<i data-lucide="lock-open" data-state="unlocked" class="text-success"></i> Tugatish ruxsat etildi`;
              renderLucideIcons(shiftEndStatus);
            }
          }
        }
      }

      updateLockCard();
      window.driverTripTimer = setInterval(updateLockCard, 1000);
    }
    // ---------------- STATE 3: SHIFT ACTIVE, >= 1 TRIP COMPLETED (SIDE-BY-SIDE BUTTONS!) ----------------
    else if (todayShift && todayShift.status === 'active' && todayCompletedTrips.length > 0) {
      if (actionsContainer) {
        actionsContainer.style.display = 'grid';
        actionsContainer.className = 'action-buttons-wrapper two-cols'; // SIDE-BY-SIDE!
      }

      if (badgeEl) badgeEl.classList.add('completed');
      if (badgeTextEl) badgeTextEl.textContent = `✅ Bugun ${todayCompletedTrips.length} ta reys yakunlandi`;

      if (driverTruckTag) driverTruckTag.textContent = 'Erkin haydovchi (Keyingi reysga tayyor)';
      if (tripConfigBox) tripConfigBox.style.display = 'flex';
      if (activeTripBox) activeTripBox.style.display = 'none';

      const lastTrip = todayCompletedTrips[todayCompletedTrips.length - 1];
      if (shiftStartDisp) shiftStartDisp.textContent = todayShift.startTime || lastTrip.checkInTime;
      if (shiftDateDisp) shiftDateDisp.innerHTML = `<i data-lucide="calendar-days"></i> Sana: ${formatShortDate(todayStr)}`;
      if (tripsCountDisp) tripsCountDisp.textContent = `${todayCompletedTrips.length} ta reys yakunlandi`;
      if (tripsStatusHint) tripsStatusHint.textContent = `Yangi reys yoki ishni yakunlash`;
      if (shiftEndDisp) shiftEndDisp.textContent = '--:--:--';
      if (shiftEndStatus) shiftEndStatus.textContent = `Kutilmoqda`;

      // Auto reverse route
      if (fromSelect && toSelect && lastTrip.toRegion) {
        fromSelect.value = lastTrip.toRegion;
        toSelect.value = lastTrip.fromRegion || 'Namangan';
      }

      // SHOW SIDE-BY-SIDE: "Yangi reysni boshlash" and "Ishni yakunlash"
      if (btnStartTrip) {
        btnStartTrip.style.display = 'flex';
        btnStartTrip.disabled = false;
        if (btnStartTripTitle) btnStartTripTitle.textContent = `🟢 Yangi (${todayCompletedTrips.length + 1}-chi) reysni boshlash`;
        if (btnStartTripSub) btnStartTripSub.textContent = `Yangi marshrut tanlang va safarga chiqing`;
      }

      if (btnEndShift) {
        btnEndShift.style.display = 'flex';
        btnEndShift.disabled = false;
        const btnEndShiftTitle = document.getElementById('btn-end-shift-title');
        const btnEndShiftSub = document.getElementById('btn-end-shift-sub');
        if (btnEndShiftTitle) btnEndShiftTitle.textContent = "🔴 Ish kunini yakunlash";
        if (btnEndShiftSub) btnEndShiftSub.textContent = `Bugungi ${todayCompletedTrips.length} ta reys hisoboti to'liq yopiladi`;
      }
    }
    // ---------------- STATE 4: SHIFT ACTIVE, 0 TRIPS COMPLETED (READY FOR 1st TRIP OR REYS BO'LMADI) ----------------
    else if (todayShift && todayShift.status === 'active') {
      if (actionsContainer) {
        actionsContainer.style.display = 'grid';
        actionsContainer.className = 'action-buttons-wrapper';
      }

      if (badgeEl) badgeEl.classList.add('working');
      if (badgeTextEl) badgeTextEl.textContent = '🟢 Smenada (Reys kutmoqda)';

      if (driverTruckTag) driverTruckTag.textContent = 'Erkin haydovchi (Reysda tanlanadi)';
      if (tripConfigBox) tripConfigBox.style.display = 'flex';
      if (activeTripBox) activeTripBox.style.display = 'none';

      if (shiftStartDisp) shiftStartDisp.textContent = todayShift.startTime || '--:--:--';
      if (shiftDateDisp) shiftDateDisp.innerHTML = `<i data-lucide="calendar-days"></i> Sana: ${formatShortDate(todayStr)}`;
      if (tripsCountDisp) tripsCountDisp.textContent = `0 ta reys`;
      if (tripsStatusHint) tripsStatusHint.textContent = `Reys kutilmoqda`;
      if (shiftEndDisp) shiftEndDisp.textContent = '--:--:--';
      if (shiftEndStatus) shiftEndStatus.textContent = `Kutish holatida`;

      // Show "1-reysni boshlash"
      if (btnStartTrip) {
        btnStartTrip.style.display = 'flex';
        btnStartTrip.disabled = false;
        if (btnStartTripTitle) btnStartTripTitle.textContent = "🟢 1-reysni boshlash";
        if (btnStartTripSub) btnStartTripSub.textContent = "Mashina va marshrutni muhrlab yo'lga chiqish";
      }

      // Show "Ishni yakunlash (Reys bo'lmadi)"
      if (btnEndShift) {
        btnEndShift.style.display = 'flex';
        btnEndShift.disabled = false;
        const btnEndShiftTitle = document.getElementById('btn-end-shift-title');
        const btnEndShiftSub = document.getElementById('btn-end-shift-sub');
        if (btnEndShiftTitle) btnEndShiftTitle.textContent = "🔴 Ishni yakunlash (Reys bo'lmadi)";
        if (btnEndShiftSub) btnEndShiftSub.textContent = "Reys bo'lmagani avtomatik qayd etiladi";
      }
    }
    // ---------------- STATE 5: SHIFT NOT STARTED TODAY (SHOW "ISHNI BOSHLASH") ----------------
    else {
      if (actionsContainer) {
        actionsContainer.style.display = 'grid';
        actionsContainer.className = 'action-buttons-wrapper single-col';
      }

      if (badgeEl) badgeEl.classList.add('idle');
      if (badgeTextEl) badgeTextEl.textContent = '🟡 Ish kuni boshlanmagan';

      if (driverTruckTag) driverTruckTag.textContent = 'Dam olishda';
      if (tripConfigBox) tripConfigBox.style.display = 'none';
      if (activeTripBox) activeTripBox.style.display = 'none';

      if (shiftStartDisp) shiftStartDisp.textContent = '--:--:--';
      if (shiftDateDisp) shiftDateDisp.innerHTML = `<i data-lucide="calendar-days"></i> Sana: ${formatShortDate(todayStr)}`;
      if (tripsCountDisp) tripsCountDisp.textContent = `0 ta reys`;
      if (tripsStatusHint) tripsStatusHint.textContent = `Ish kuni kutilmoqda`;
      if (shiftEndDisp) shiftEndDisp.textContent = '--:--:--';
      if (shiftEndStatus) shiftEndStatus.textContent = `Boshlanmagan`;

      // Show ONLY "Ishni boshlash"
      if (btnStartShift) {
        btnStartShift.style.display = 'flex';
        btnStartShift.disabled = false;
      }
    }

    // Render Driver History Logs
    renderDriverHistoryTable(driver.id, currentMonthPrefix);

    // Render Driver Advances Logs
    renderDriverAdvancesTable(driver.id);
  }

  function renderDriverHistoryTable(driverId, monthPrefix) {
    const tbody = document.getElementById('driver-history-tbody');
    const summarySpan = document.getElementById('driver-month-trips-summary');
    if (!tbody) return;

    const logs = appData.attendances
      .filter(att => att.driverId === driverId && att.date.startsWith(monthPrefix))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.tripNumber || 0) - (a.tripNumber || 0));

    if (summarySpan) {
      const completedCount = logs.filter(a => a.status === 'completed').length;
      summarySpan.textContent = `Jami reyslar: ${completedCount} ta`;
    }

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:2rem;">Bu oyda hali reyslar tarixi mavjud emas</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(att => {
      const isCompleted = att.status === 'completed';
      const statusBadge = isCompleted 
        ? '<span class="badge-status completed"><i data-lucide="check-circle-2"></i> Tugatilgan</span>'
        : '<span class="badge-status active"><span class="truck-on-road"><i data-lucide="truck" class="truck-driving"></i></span> Reysda</span>';

      let earnedText = "Kutilmoqda";
      if (isCompleted) {
        if (att.earnedAmount > 0) {
          earnedText = formatMoney(att.earnedAmount);
        } else {
          earnedText = `<span style="color:#64748b; font-size:0.85rem;" title="1 kun uchun 1 marta kunlik stavka hisoblanadi (1-reysda kiritilgan)">0 so'm (Kiritilgan)</span>`;
        }
      }

      const isSame = att.fromRegion === att.toRegion;
      const distKm = isSame ? 0 : (att.distanceKm !== undefined ? att.distanceKm : getRouteDistanceKm(att.fromRegion, att.toRegion));

      return `
        <tr>
          <td><span class="trip-num-tag">Reys #${att.tripNumber || 1}</span></td>
          <td><strong>${att.date}</strong></td>
          <td><span class="truck-badge"><i data-lucide="truck"></i> ${att.truckName || ''} (${att.truckNumber})</span></td>
          <td>
            <span class="route-badge">
              <strong>${att.fromRegion || 'Namangan'}</strong>
              ${isSame ? '<span style="color:#10b981; margin:0 4px;">•</span>' : '<i data-lucide="arrow-right"></i>'}
              <strong>${isSame ? '(Viloyat ichida)' : (att.toRegion || 'Farg\'ona')}</strong>
              ${isSame 
                ? '<span class="route-km-pill" style="margin-left:0.35rem; font-size:0.75rem; background:rgba(16,185,129,0.12); color:var(--success); padding:1px 5px; border-radius:4px; font-weight:700;">Viloyat ichida</span>' 
                : `<span class="route-km-pill" style="margin-left:0.35rem; font-size:0.75rem; background:rgba(99,102,241,0.12); color:var(--primary); padding:1px 5px; border-radius:4px; font-weight:600;">${distKm} km</span>`}
            </span>
          </td>
          <td style="font-family:var(--font-mono);">${att.checkInTime || '-'}</td>
          <td style="font-family:var(--font-mono);">${att.checkOutTime || '-'}</td>
          <td>${att.durationText || '-'}</td>
          <td><strong style="color:var(--success); font-family:var(--font-mono);">${earnedText}</strong></td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
    renderLucideIcons(tbody);
  }

  function renderDriverAdvancesTable(driverId) {
    const tbody = document.getElementById('driver-advances-tbody');
    const badgeTotal = document.getElementById('driver-advances-total-badge');
    if (!tbody) return;

    const list = (appData.advances || [])
      .filter(adv => adv.driverId === driverId)
      .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

    const totalAdv = list.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    if (badgeTotal) {
      badgeTotal.textContent = `Jami avans: -${formatMoney(totalAdv)}`;
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:2rem;">Sizda avans qarzdorligi yo'q (Avans olinmagan)</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((adv, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${adv.date}</strong> <span style="font-size:0.8rem; color:#94a3b8;">${adv.time || ''}</span></td>
          <td><strong class="text-danger" style="font-family:var(--font-mono); font-size:1.05rem;">-${formatMoney(adv.amount)}</strong></td>
          <td>${adv.comment || '<span style="color:#94a3b8;">Yo\'l xarajati uchun</span>'}</td>
          <td><span class="badge-status completed"><i data-lucide="check"></i> Hisobga olingan</span></td>
        </tr>
      `;
    }).join('');
  }

  // Driver action: 1. Ishni boshlash (Start Shift)
  function handleStartShift() {
    if (!currentSession || currentSession.role !== 'driver') return;
    const driver = appData.drivers.find(d => d.id === currentSession.driverId);
    if (!driver) return;

    const todayStr = getTodayString();
    if (!appData.shifts) appData.shifts = [];

    const existingShift = appData.shifts.find(s => s.driverId === driver.id && s.date === todayStr);
    if (existingShift) {
      if (existingShift.status === 'completed') {
        showToast("Bugungi ish kuningiz allaqachon yakunlangan!", 'info');
        return;
      }
      showToast("Bugungi ish kuni allaqachon boshlangan. Endi reysni boshlashingiz mumkin!", 'info');
      renderDriverView(driver);
      return;
    }

    const newShift = {
      id: 'shf_' + Date.now(),
      driverId: driver.id,
      driverName: driver.fullName,
      date: todayStr,
      startTime: getCurrentTimeString(),
      startTimestamp: Date.now(),
      endTime: null,
      endTimestamp: null,
      status: 'active',
      completedTrips: 0
    };

    appData.shifts.push(newShift);
    DB.save(appData);

    showToast(`🟢 Bugungi ish kuningiz ochildi (${newShift.startTime}). Endi 1-reysni boshlashingiz mumkin!`, 'success');
    renderDriverView(driver);
  }

  // Driver action: 2. Reysni boshlash (Start Trip)
  function handleDriverCheckIn() {
    if (!currentSession || currentSession.role !== 'driver') return;
    const driver = appData.drivers.find(d => d.id === currentSession.driverId);
    if (!driver) return;

    const todayStr = getTodayString();
    if (!appData.shifts) appData.shifts = [];

    // Ensure shift is active
    let activeShift = appData.shifts.find(s => s.driverId === driver.id && s.date === todayStr && s.status === 'active');
    if (!activeShift) {
      activeShift = {
        id: 'shf_' + Date.now(),
        driverId: driver.id,
        driverName: driver.fullName,
        date: todayStr,
        startTime: getCurrentTimeString(),
        startTimestamp: Date.now(),
        endTime: null,
        endTimestamp: null,
        status: 'active',
        completedTrips: 0
      };
      appData.shifts.push(activeShift);
    }

    // Check if driver currently has an in_progress trip
    const activeTrip = appData.attendances.find(att => att.driverId === driver.id && att.status === 'in_progress');
    if (activeTrip) {
      showToast("Siz hozir allaqachon reysdasiz! Avval joriy reysni yakunlang.", 'warning');
      return;
    }

    const truckSelect = document.getElementById('driver-trip-truck');
    const fromSelect = document.getElementById('driver-trip-from');
    const toSelect = document.getElementById('driver-trip-to');

    const truckId = truckSelect ? truckSelect.value : '';
    const fromRegion = fromSelect ? fromSelect.value : '';
    const toRegion = toSelect ? toSelect.value : '';

    if (!truckId) {
      showToast("Iltimos, reysga chiqish uchun mashinani qo'lda tanlang! Avtomatik tanlanmaydi.", 'warning');
      if (truckSelect) truckSelect.focus();
      return;
    }

    const selectedTruck = (appData.trucks || []).find(t => t.id === truckId);
    if (!selectedTruck) {
      showToast("Tanlangan mashina topilmadi! Iltimos, ro'yxatdan qayta tanlang.", 'warning');
      if (truckSelect) truckSelect.focus();
      return;
    }

    // Check if the chosen truck is ALREADY IN PROGRESS with another driver
    const activeBusyTrip = (appData.attendances || []).find(a => 
      a.status === 'in_progress' && (a.truckId === selectedTruck.id || (a.truckNumber && a.truckNumber.replace(/\s+/g, '').toUpperCase() === (selectedTruck.plateNumber || '').replace(/\s+/g, '').toUpperCase()))
    );

    if (activeBusyTrip) {
      showToast(`⛔ Ushbu mashina (${selectedTruck.name} • ${selectedTruck.plateNumber}) band! Haydovchi ${activeBusyTrip.driverName} hozir reysda. Iltimos, boshqa bo'sh mashinani tanlang.`, 'danger');
      if (truckSelect) {
        truckSelect.value = '';
        truckSelect.focus();
        if (typeof truckSelect.onchange === 'function') truckSelect.onchange();
      }
      return;
    }

    if (!fromRegion || !toRegion) {
      showToast("Iltimos, chiqish va borish viloyatini tanlang!", 'warning');
      return;
    }

    const todayTrips = appData.attendances.filter(att => att.driverId === driver.id && att.date === todayStr);
    const tripNumber = todayTrips.length + 1;

    const currentTime = getCurrentTimeString();
    const currentTimestamp = Date.now();
    const dailyRate = calculateDailyRate(driver.monthlySalary);

    const isSameRegion = fromRegion === toRegion;
    const distanceKm = isSameRegion ? 0 : getRouteDistanceKm(fromRegion, toRegion);
    const minAllowedMinutes = isSameRegion ? 30 : calculateMinAllowedMinutes(distanceKm, fromRegion, toRegion);
    const minAllowedMs = minAllowedMinutes * 60 * 1000;

    const newAttendance = {
      id: 'att_' + currentTimestamp,
      driverId: driver.id,
      driverName: driver.fullName,
      phone: driver.phone,
      truckId: selectedTruck.id,
      truckName: selectedTruck.name,
      truckNumber: selectedTruck.plateNumber,
      fromRegion: fromRegion,
      toRegion: toRegion,
      distanceKm: distanceKm,
      distance_km: distanceKm,
      minAllowedMinutes: minAllowedMinutes,
      min_allowed_minutes: minAllowedMinutes,
      minAllowedMs: minAllowedMs,
      started_at: currentTimestamp,
      tripNumber: tripNumber,
      date: todayStr,
      checkInTime: currentTime,
      checkInTimestamp: currentTimestamp,
      checkOutTime: null,
      checkOutTimestamp: null,
      durationText: 'Davom etmoqda',
      dailyRate: dailyRate,
      earnedAmount: 0,
      status: 'in_progress',
      shiftId: activeShift.id
    };

    appData.attendances.push(newAttendance);
    DB.save(appData);

    const minUzbek = isSameRegion ? "30:00 daqiqa" : formatMinutesToUzbek(minAllowedMinutes);
    const routeInfo = isSameRegion ? `${fromRegion} (Viloyat ichida)` : `${fromRegion} ➔ ${toRegion} (${distanceKm} km)`;
    const ruleInfo = isSameRegion ? "Viloyat ichida qat'iy 30:00 daq" : "70 km/s + 15 daq";
    showToast(`🟢 Reys #${tripNumber} boshlandi! Marshrut: ${routeInfo}. Minimal ruxsat vaqti: ${minUzbek} (${ruleInfo}). Oq yo'l!`, 'success');
    renderDriverView(driver);
  }

  // Driver action: 3. Reysni yakunlash (Finish Trip)
  function handleDriverCheckOut() {
    if (!currentSession || currentSession.role !== 'driver') return;
    const driver = appData.drivers.find(d => d.id === currentSession.driverId);
    if (!driver) return;

    const activeTripIndex = appData.attendances.findIndex(att => att.driverId === driver.id && att.status === 'in_progress');
    if (activeTripIndex === -1) {
      showToast("Sizda hozir davom etayotgan faol reys yo'q!", 'danger');
      return;
    }

    const att = appData.attendances[activeTripIndex];
    const lockStatus = getTripLockStatus(att);
    const isSame = lockStatus.isSameRegion || att.fromRegion === att.toRegion;
    const minUzbek = isSame ? "30:00 daqiqa" : formatMinutesToUzbek(lockStatus.minMinutes);

    // STRICT ANTI-TAMPER TIME ENFORCEMENT
    if (TimeKeeper.isTampered) {
      showToast("⚠️ Qurilma vaqti noqonuniy o'zgartirilgani aniqlandi! Iltimos, telefoningizda 'Avtomatik sana va vaqt' rejimini yoqing va sahifani yangilang.", 'danger');
      return;
    }

    // STRICT DISTANCE-BASED MINIMAL TIME ENFORCEMENT
    if (lockStatus.isLocked) {
      const distInfo = isSame ? "Viloyat ichida mahalliy reys" : `Masofa: ${lockStatus.distanceKm} km`;
      showToast(`⚠️ Reysni yakunlab bo'lmaydi! ${distInfo} uchun minimal ruxsat etilgan vaqt: ${minUzbek}. Hali ${lockStatus.remainingUzbek} vaqt o'tishi shart!`, 'warning');
      return;
    }

    // Stop live timer
    if (window.driverTripTimer) {
      clearInterval(window.driverTripTimer);
      window.driverTripTimer = null;
    }

    const currentTime = getCurrentTimeString();
    const durationText = calculateDuration(att.checkInTime, currentTime);
    const dailyRate = calculateDailyRate(driver.monthlySalary);

    // Check if any completed trip already exists for today
    const existingCompletedToday = appData.attendances.some(a => 
      a.driverId === driver.id && a.date === att.date && a.status === 'completed' && a.id !== att.id
    );

    att.checkOutTime = currentTime;
    att.checkOutTimestamp = Date.now();
    att.durationText = durationText;
    att.dailyRate = dailyRate;
    // Har bir ishlangan kun uchun faqat 1 marta kunlik stavka to'lanadi
    att.earnedAmount = existingCompletedToday ? 0 : dailyRate;
    att.status = 'completed';

    appData.attendances[activeTripIndex] = att;

    // Update shift completed trips counter
    const todayStr = att.date;
    if (appData.shifts) {
      const shift = appData.shifts.find(s => s.driverId === driver.id && s.date === todayStr && s.status === 'active');
      if (shift) {
        shift.completedTrips = (shift.completedTrips || 0) + 1;
      }
    }

    DB.save(appData);

    const tripEarnedNote = existingCompletedToday 
      ? `(Bugun avvalgi reysda kunlik stavka hisoblangan)` 
      : `Kunlik stavka (${formatMoney(dailyRate)}) hisobingizga qo'shildi!`;

    const finishRouteInfo = isSame ? `${att.fromRegion} (Viloyat ichida)` : `${att.fromRegion} ➔ ${att.toRegion} (${lockStatus.distanceKm} km)`;
    showToast(`🔴 Reys #${att.tripNumber || 1} muvaffaqiyatli yakunlandi! Marshrut: ${finishRouteInfo}. ${tripEarnedNote}`, 'success');
    renderDriverView(driver);
  }

  // Driver action: 4. Ishni yakunlash (End Shift)
  function handleEndShift() {
    if (!currentSession || currentSession.role !== 'driver') return;
    const driver = appData.drivers.find(d => d.id === currentSession.driverId);
    if (!driver) return;

    const todayStr = getTodayString();
    if (!appData.shifts) appData.shifts = [];

    const shift = appData.shifts.find(s => s.driverId === driver.id && s.date === todayStr && s.status === 'active');
    if (!shift) {
      showToast("Bugungi ish kuni topilmadi yoki allaqachon yakunlangan!", 'warning');
      return;
    }

    // Check if driver currently has an in_progress trip
    const activeTrip = appData.attendances.find(att => att.driverId === driver.id && att.status === 'in_progress');
    if (activeTrip) {
      showToast("Reys davom etmoqda! Ishni yakunlashdan oldin avval joriy reysni tugatishingiz kerak.", 'warning');
      return;
    }

    const todayCompletedTrips = appData.attendances.filter(att => 
      att.driverId === driver.id && att.date === todayStr && att.status === 'completed' && !att.isNoTrip
    );

    const currentTime = getCurrentTimeString();
    const dailyRate = calculateDailyRate(driver.monthlySalary);

    shift.endTime = currentTime;
    shift.endTimestamp = Date.now();
    shift.status = 'completed';
    shift.completedTrips = todayCompletedTrips.length;
    shift.earnedAmount = dailyRate;

    // Agar bugun reys bo'lmagan bo'lsa (0 ta reys)
    if (todayCompletedTrips.length === 0) {
      const autoComment = getUzbekDateComment();
      shift.isNoTrip = true;
      shift.autoComment = autoComment;

      if (!appData.attendances) appData.attendances = [];
      const existingNoTripAtt = appData.attendances.find(a => 
        a.driverId === driver.id && a.date === todayStr && a.isNoTrip
      );

      if (!existingNoTripAtt) {
        const noTripRecord = {
          id: 'att_notrip_' + Date.now(),
          driverId: driver.id,
          driverName: driver.fullName,
          phone: driver.phone,
          truckId: '',
          truckName: '-',
          truckNumber: 'Garajda',
          fromRegion: 'Garaj',
          toRegion: 'Reys bo\'lmadi',
          distanceKm: 0,
          tripNumber: 0,
          date: todayStr,
          startTime: shift.startTime,
          endTime: currentTime,
          durationText: calculateDuration(shift.startTime, currentTime),
          status: 'completed',
          isNoTrip: true,
          autoComment: autoComment,
          earnedAmount: dailyRate
        };
        appData.attendances.push(noTripRecord);
      }

      DB.save(appData);
      showToast(`🏁 Ish kuni yakunlandi. Izoh: "${autoComment}". Kunlik stavka (${formatMoney(dailyRate)}) hisobingizga kiritildi.`, 'success');
    } else {
      DB.save(appData);
      showToast(`🏁 Bugungi ish kuni to'liq yakunlandi! Bugun ${todayCompletedTrips.length} ta reys bajardingiz. Kunlik stavka (${formatMoney(dailyRate)}) to'liq kiritildi!`, 'success');
    }

    renderDriverView(driver);
  }

  // ================= ADMIN DASHBOARD LOGIC =================
  function renderAdminDashboard() {
    const todayStr = getTodayString();
    const monthInput = document.getElementById('filter-month');
    
    // Set default month filter if empty
    if (!monthInput.value) {
      const now = new Date();
      monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const selectedMonth = monthInput.value;

    // Top KPIs
    const totalDrivers = appData.drivers.length;
    const todayLogs = appData.attendances.filter(a => a.date === todayStr);
    const todayActiveTrips = todayLogs.filter(a => a.status === 'in_progress');
    const todayTripsCount = todayLogs.filter(a => a.status === 'completed' && !a.isNoTrip).length + todayActiveTrips.length;

    // Smenalar monitoringi (Ishda, kutmoqda, dam olgan)
    const todayShifts = (appData.shifts || []).filter(s => s.date === todayStr);
    const activeShifts = todayShifts.filter(s => s.status === 'active');

    // 1) Hozir yo'lda/reysda bo'lgan unikal haydovchilar soni
    const driversOnTripIds = new Set(todayActiveTrips.map(a => a.driverId));
    const driversOnTripCount = driversOnTripIds.size;

    // 2) Smena ochgan, lekin hozir reysda emas (garajda kutmoqda)
    const driversWaitingCount = activeShifts.filter(s => !driversOnTripIds.has(s.driverId)).length;

    // 3) Bugun umuman ishga kelgan / smena ochgan haydovchilar (jami ishda)
    const driversWorkedTodayIds = new Set(todayShifts.map(s => s.driverId));
    // Shuningdek, bugun reys bajarganlar ham ishda hisoblanadi
    todayLogs.forEach(a => driversWorkedTodayIds.add(a.driverId));
    const driversWorkedTodayCount = driversWorkedTodayIds.size;

    // 4) Dam olganlar (bugun smena ochmagan haydovchilar)
    const driversOffCount = Math.max(0, totalDrivers - driversWorkedTodayCount);

    // Mashinalar parki (Band vs Bo'sh)
    const totalTrucks = (appData.trucks || []).length;
    const busyTruckIds = new Set(todayActiveTrips.map(a => a.truckId).filter(Boolean));
    const busyTruckPlates = new Set(todayActiveTrips.map(a => a.truckNumber).filter(Boolean));
    const busyTrucksCount = (appData.trucks || []).filter(t => busyTruckIds.has(t.id) || busyTruckPlates.has(t.plateNumber)).length;
    const freeTrucksCount = Math.max(0, totalTrucks - busyTrucksCount);

    // Total monthly payout accrued (Uniform daily salary across all drivers)
    const totalPayout = appData.drivers.reduce((sum, drv) => {
      const summary = getDriverMonthSummary(drv.id, selectedMonth);
      return sum + summary.totalEarned;
    }, 0);

    // Total advances given in selected month
    const totalAdvances = (appData.advances || [])
      .filter(a => !a.date || a.date.startsWith(selectedMonth))
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    const statDrivers = document.getElementById('admin-stat-total-drivers');
    if (statDrivers) statDrivers.textContent = `${totalDrivers} nafar`;

    const statTodayTrips = document.getElementById('admin-stat-today-trips');
    if (statTodayTrips) statTodayTrips.textContent = `${todayTripsCount} ta reys`;

    const statTodayActive = document.getElementById('admin-stat-today-active');
    if (statTodayActive) statTodayActive.textContent = `${driversWorkedTodayCount} nafar`;

    const statActiveBreakdown = document.getElementById('admin-stat-active-breakdown');
    if (statActiveBreakdown) {
      statActiveBreakdown.textContent = `Reysda: ${driversOnTripCount} • Kutmoqda: ${driversWaitingCount}`;
    }

    const statTodayFinished = document.getElementById('admin-stat-today-finished');
    if (statTodayFinished) statTodayFinished.textContent = `${driversOffCount} nafar`;

    const statTrucks = document.getElementById('admin-stat-total-trucks');
    if (statTrucks) statTrucks.textContent = `${totalTrucks} ta`;

    const statTrucksBreakdown = document.getElementById('admin-stat-trucks-breakdown');
    if (statTrucksBreakdown) {
      statTrucksBreakdown.textContent = `Band: ${busyTrucksCount} • Bo'sh: ${freeTrucksCount}`;
    }

    const statAdvances = document.getElementById('admin-stat-total-advances');
    if (statAdvances) statAdvances.textContent = `-${formatMoney(totalAdvances)}`;

    const statPayout = document.getElementById('admin-stat-total-payout');
    if (statPayout) statPayout.textContent = formatMoney(totalPayout);

    // Haydovchilar reytingi preview kartasi (Admin & SuperAdmin)
    updateAdminRankingCardPreview(selectedMonth);

    // Populate advance driver select dropdowns
    populateAdvanceDriverSelects();

    // Render Driver Summary Cards for selected month
    renderAdminDriverSummaries(selectedMonth);

    // Render Attendance & Trips Table
    renderAdminAttendanceTable(selectedMonth);

    // Render Driver List Table for selected month
    renderAdminDriversTable(selectedMonth);

    // Render Trucks Table
    renderAdminTrucksTable();

    // Render Advances Table
    renderAdminAdvancesTable();

    // Render Salary Payout Table for selected month
    renderAdminSalaryPayoutTable(selectedMonth);
  }

  function populateAdvanceDriverSelects() {
    const mainSelect = document.getElementById('advance-driver-select');
    const modalSelect = document.getElementById('modal-advance-driver-select');
    const isViewer = currentSession?.role === 'viewer';

    const optionsHtml = '<option value="">-- Haydovchini tanlang --</option>' + 
      appData.drivers.map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.fullName)} (${escapeHtml(isViewer ? maskPhoneNumber(d.phone) : formatPhoneNumber(d.phone))})</option>`).join('');

    if (mainSelect) {
      const cur = mainSelect.value;
      mainSelect.innerHTML = optionsHtml;
      if (cur) mainSelect.value = cur;
    }
    if (modalSelect) {
      const cur = modalSelect.value;
      modalSelect.innerHTML = optionsHtml;
      if (cur) modalSelect.value = cur;
    }
  }

  function renderAdminDriverSummaries(monthPrefix) {
    const container = document.getElementById('driver-summary-cards');
    if (!container) return;

    if (appData.drivers.length === 0) {
      container.innerHTML = `<p style="color:#94a3b8; font-size:0.85rem;">Hozircha birorta ham haydovchi mavjud emas</p>`;
      return;
    }

    const isViewer = currentSession?.role === 'viewer';

    container.innerHTML = appData.drivers.map(drv => {
      const summary = getDriverMonthSummary(drv.id, monthPrefix);

      if (isViewer) {
        return `
          <div class="summary-driver-badge clickable-card" data-driver-id="${escapeHtml(drv.id)}" onclick="window.openDriverDetailsModal('${escapeHtml(drv.id)}')" title="Batafsil ma'lumot va hisobotni ko'rish">
            <div class="name-row" style="display:flex; justify-content:space-between; align-items:center;">
              <span class="name">${escapeHtml(drv.fullName)}</span>
              <i data-lucide="external-link" style="width:0.75rem; height:0.75rem; color:var(--primary); opacity:0.8;"></i>
            </div>
            <div class="stats"><i data-lucide="navigation" class="text-primary"></i> Reyslar: <strong>${summary.completedTripsCount} ta</strong> (${summary.daysWorked} kun)</div>
            <div class="stats" style="color:var(--text-muted); font-size:0.8rem; margin-top:3px;"><i data-lucide="phone"></i> ${escapeHtml(maskPhoneNumber(drv.phone))}</div>
          </div>
        `;
      }

      return `
        <div class="summary-driver-badge clickable-card" data-driver-id="${escapeHtml(drv.id)}" onclick="window.openDriverDetailsModal('${escapeHtml(drv.id)}')" title="Batafsil ma'lumot va hisobotni ko'rish">
          <div class="name-row" style="display:flex; justify-content:space-between; align-items:center;">
            <span class="name">${escapeHtml(drv.fullName)}</span>
            <i data-lucide="external-link" style="width:0.75rem; height:0.75rem; color:var(--primary); opacity:0.8;"></i>
          </div>
          <div class="stats"><i data-lucide="navigation" class="text-primary"></i> Reyslar: <strong>${summary.completedTripsCount} ta</strong> (${summary.daysWorked} kun)</div>
          <div class="earned"><i data-lucide="coins"></i> Ishlangan: ${formatMoney(summary.totalEarned)}</div>
          ${summary.totalAdvances > 0 ? `<div style="font-size:0.75rem; color:#ef4444; font-family:var(--font-mono); font-weight:700;"><i data-lucide="coins"></i> Avans: -${formatMoney(summary.totalAdvances)}</div>` : ''}
          <div style="font-size:0.8rem; color:#10b981; font-weight:700;"><i data-lucide="wallet"></i> Qoldiq: ${formatMoney(summary.netSalary)}</div>
        </div>
      `;
    }).join('');
  }

  let currentAttendanceFilter = 'all';

  function renderAdminAttendanceTable(monthPrefix) {
    const tbody = document.getElementById('admin-attendance-tbody');
    const searchVal = (document.getElementById('search-attendance')?.value || '').toLowerCase().trim();
    if (!tbody) return;

    let filtered = appData.attendances.filter(a => a.date.startsWith(monthPrefix));

    // Apply quick status filters
    if (currentAttendanceFilter === 'in_progress') {
      filtered = filtered.filter(a => a.status === 'in_progress');
    } else if (currentAttendanceFilter === 'completed') {
      filtered = filtered.filter(a => a.status === 'completed');
    } else if (currentAttendanceFilter === 'today') {
      const todayStr = getTodayString();
      filtered = filtered.filter(a => a.date === todayStr);
    }

    if (searchVal) {
      filtered = filtered.filter(a => 
        (a.driverName && a.driverName.toLowerCase().includes(searchVal)) ||
        (a.truckNumber && (a.truckNumber.toLowerCase().includes(searchVal) || a.truckNumber.toLowerCase().replace(/\s+/g, '').includes(searchVal.replace(/\s+/g, '')))) ||
        (a.truckName && a.truckName.toLowerCase().includes(searchVal)) ||
        (a.fromRegion && a.fromRegion.toLowerCase().includes(searchVal)) ||
        (a.toRegion && a.toRegion.toLowerCase().includes(searchVal)) ||
        (a.phone && (a.phone.toLowerCase().includes(searchVal) || a.phone.replace(/\s+/g, '').includes(searchVal.replace(/\s+/g, ''))))
      );
    }

    // Sort descending by date and tripNumber
    filtered.sort((a, b) => b.date.localeCompare(a.date) || (b.tripNumber || 0) - (a.tripNumber || 0));

    const countHint = document.getElementById('table-total-count-hint');
    if (countHint) {
      countHint.textContent = `Jami: ${filtered.length} ta reys`;
    }

    const isViewer = currentSession?.role === 'viewer';

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${isViewer ? 11 : 12}" style="text-align:center; color:#94a3b8; padding:2.5rem;">Ushbu oy va qidiruv bo'yicha hech qanday reys topilmadi</td></tr>`;
      const pagWrap = document.getElementById('attendance-pagination-wrapper');
      if (pagWrap) pagWrap.innerHTML = '';
      if (window.adminTableLiveTicker) {
        clearInterval(window.adminTableLiveTicker);
        window.adminTableLiveTicker = null;
      }
      return;
    }

    const totalItems = filtered.length;
    const pagState = paginationState.attendance;
    const totalPages = Math.max(1, Math.ceil(totalItems / pagState.pageSize));
    if (pagState.page > totalPages) pagState.page = totalPages;
    if (pagState.page < 1) pagState.page = 1;

    const startIndex = (pagState.page - 1) * pagState.pageSize;
    const pageItems = filtered.slice(startIndex, startIndex + pagState.pageSize);

    tbody.innerHTML = pageItems.map((att, idx) => {
      const rowNum = startIndex + idx + 1;

      // Reys bo'lmagan (garajda kutgan) smena yozuvi
      if (att.isNoTrip) {
        const commentBadge = `<span class="badge-status warning" style="font-size:0.8rem; background:rgba(234,179,8,0.15); color:#eab308; border-color:rgba(234,179,8,0.3);"><i data-lucide="history"></i> ${att.autoComment || 'Reys bo\'lmadi'}</span>`;
        return `
          <tr style="background: rgba(234, 179, 8, 0.04);">
            <td>${rowNum}</td>
            <td><strong>${att.date}</strong></td>
            <td><span class="trip-num-tag" style="background:rgba(234,179,8,0.12); color:#eab308; border-color:rgba(234,179,8,0.3);">Reyssiz</span></td>
            <td><strong style="color:var(--primary); font-size:0.95rem;">${att.driverName}</strong></td>
            <td><span style="color:var(--text-muted); font-size:0.85rem;"><i data-lucide="circle-parking"></i> Garajda</span></td>
            <td>
              <span class="route-badge" style="background:rgba(234,179,8,0.08); color:#eab308; border-color:rgba(234,179,8,0.25);">
                <i data-lucide="hourglass"></i> Garaj (Reys bo'lmadi)
              </span>
            </td>
            <td style="font-family:var(--font-mono);">${att.startTime || '-'}</td>
            <td style="font-family:var(--font-mono);">${att.endTime || '-'}</td>
            <td>${att.durationText || '-'}</td>
            <td class="col-attendance-rate"><strong style="color:var(--success); font-family:var(--font-mono); font-size:0.95rem;">${formatMoney(att.earnedAmount || 0)}</strong> <small style="color:var(--text-muted); font-size:0.75rem;">(Kutish)</small></td>
            <td>${commentBadge}</td>
            <td>
              ${isViewer ? `<span class="read-only-badge"><i data-lucide="lock"></i> Faqat ko'rish</span>` : `
              <button class="btn-icon danger" onclick="window.deleteAttendance('${att.id}')" title="Yozuvni o'chirish">
                <i data-lucide="trash-2"></i>
              </button>`}
            </td>
          </tr>
        `;
      }

      const isCompleted = att.status === 'completed';
      let statusBadge;
      let durationDisplay = att.durationText || '-';

      const isSame = att.fromRegion === att.toRegion;

      if (isCompleted) {
        statusBadge = '<span class="badge-status completed"><i data-lucide="check"></i> Tugatilgan</span>';
      } else {
        const lockStatus = getTripLockStatus(att);
        const minUzbek = isSame ? "30:00 daqiqa" : formatMinutesToUzbek(lockStatus.minMinutes);
        durationDisplay = `<span class="live-admin-trip-elapsed" data-trip-id="${att.id}"><i data-lucide="timer"></i> <span class="elapsed-val">${lockStatus.elapsedStr}</span></span>`;
        if (lockStatus.isLocked) {
          const hintTitle = isSame ? "Viloyat ichida 30 daqiqa kutilmoqda" : `${lockStatus.distanceKm} km masofa uchun minimal ${minUzbek} talab qilinadi`;
          statusBadge = `<span class="badge-status warning live-admin-trip-badge" data-trip-id="${att.id}" title="${hintTitle}. Qolgan vaqt: ${lockStatus.remainingUzbek}"><i data-lucide="lock"></i> <span class="badge-label">Reysda (<span class="countdown-val">${lockStatus.countdownStr}</span>)</span></span>`;
        } else {
          statusBadge = `<span class="badge-status active live-admin-trip-badge" data-trip-id="${att.id}" title="Minimal ruxsat vaqti (${minUzbek}) o'tdi, reysni yakunlash mumkin"><i data-lucide="lock-open"></i> <span class="badge-label">Vaqt o'tdi (Reysda)</span></span>`;
        }
      }

      let earnedDisplay = '-';
      if (isCompleted) {
        if (att.earnedAmount > 0) {
          earnedDisplay = `<strong style="color:var(--success); font-family:var(--font-mono); font-size:1rem;">${formatMoney(att.earnedAmount)}</strong>`;
        } else {
          earnedDisplay = `<span style="color:#64748b; font-family:var(--font-mono); font-size:0.85rem;" title="1 kun uchun 1 marta kunlik stavka hisoblanadi (1-reysda hisoblangan)">0 so'm (Kiritilgan)</span>`;
        }
      } else {
        earnedDisplay = `<span style="color:#f59e0b; font-family:var(--font-mono); font-size:0.85rem;">Kutilmoqda</span>`;
      }

      const distKm = isSame ? 0 : (att.distanceKm !== undefined ? att.distanceKm : getRouteDistanceKm(att.fromRegion, att.toRegion));

      return `
        <tr>
          <td>${rowNum}</td>
          <td><strong>${escapeHtml(att.date)}</strong></td>
          <td><span class="trip-num-tag">Reys #${Number(att.tripNumber) || 1}</span></td>
          <td>
            <span class="clickable-driver-name" onclick="window.openDriverDetailsModal('${escapeHtml(att.driverId)}')" title="Haydovchi profilini ochish">
              ${escapeHtml(att.driverName)} <i data-lucide="external-link" style="width:0.75rem; height:0.75rem; margin-left:3px; opacity:0.7;"></i>
            </span>
          </td>
          <td><span class="truck-badge"><i data-lucide="truck"></i> ${escapeHtml(att.truckName || '')} (${escapeHtml(att.truckNumber || '')})</span></td>
          <td>
            <span class="route-badge">
              <strong>${escapeHtml(att.fromRegion || 'Namangan')}</strong>
              ${isSame ? '<span style="color:#10b981; margin:0 4px;">•</span>' : '<i data-lucide="arrow-right"></i>'}
              <strong>${isSame ? '(Viloyat ichida)' : escapeHtml(att.toRegion || "Farg'ona")}</strong>
              ${isSame 
                ? '<span class="route-km-pill" style="margin-left:0.35rem; font-size:0.75rem; background:rgba(16,185,129,0.12); color:var(--success); padding:1px 5px; border-radius:4px; font-weight:700;">Viloyat ichida</span>' 
                : `<span class="route-km-pill" style="margin-left:0.35rem; font-size:0.75rem; background:rgba(99,102,241,0.12); color:var(--primary); padding:1px 5px; border-radius:4px; font-weight:600;">${distKm} km</span>`}
            </span>
          </td>
          <td style="font-family:var(--font-mono);">${escapeHtml(att.checkInTime || att.startTime || '-')}</td>
          <td style="font-family:var(--font-mono);">${att.checkOutTime || att.endTime ? escapeHtml(att.checkOutTime || att.endTime) : '<span style="color:#f59e0b;">Kutilmoqda</span>'}</td>
          <td>${durationDisplay}</td>
          <td class="col-attendance-rate">${earnedDisplay}</td>
          <td>${statusBadge}</td>
          <td>
            ${isViewer ? `<span class="read-only-badge"><i data-lucide="lock"></i> Faqat ko'rish</span>` : `
            <button class="btn-icon danger" onclick="window.deleteAttendance('${escapeHtml(att.id)}')" title="Reys yozuvini o'chirish">
              <i data-lucide="trash-2"></i>
            </button>`}
          </td>
        </tr>
      `;
    }).join('');

    renderPaginationControls('attendance-pagination-wrapper', totalItems, 'attendance', () => {
      renderAdminAttendanceTable(monthPrefix);
    });

    // Setup live countdown interval for active trips in admin/viewer table
    if (window.adminTableLiveTicker) {
      clearInterval(window.adminTableLiveTicker);
      window.adminTableLiveTicker = null;
    }

    const hasActive = filtered.some(a => a.status === 'in_progress');
    if (hasActive) {
      window.adminTableLiveTicker = setInterval(() => {
        const pane = document.getElementById('tab-attendance');
        if (!pane || !pane.classList.contains('active')) return;

        document.querySelectorAll('.live-admin-trip-badge').forEach(badge => {
          const tripId = badge.dataset.tripId;
          const trip = (appData.attendances || []).find(a => a.id === tripId);
          if (trip && trip.status === 'in_progress') {
            const lockStatus = getTripLockStatus(trip);

            const countdownValEl = badge.querySelector('.countdown-val');
            if (lockStatus.isLocked) {
              if (!badge.classList.contains('warning')) {
                badge.className = "badge-status warning live-admin-trip-badge";
                badge.innerHTML = `<i data-lucide="lock"></i> <span class="badge-label">Reysda (<span class="countdown-val">${lockStatus.countdownStr}</span>)</span>`;
                renderLucideIcons(badge);
              } else if (countdownValEl) {
                countdownValEl.textContent = lockStatus.countdownStr;
              }
            } else {
              if (!badge.classList.contains('active')) {
                badge.className = "badge-status active live-admin-trip-badge";
                badge.innerHTML = `<i data-lucide="lock-open"></i> <span class="badge-label">Vaqt o'tdi (Reysda)</span>`;
                renderLucideIcons(badge);
              }
            }

            const elapsedEl = document.querySelector(`.live-admin-trip-elapsed[data-trip-id="${tripId}"]`);
            if (elapsedEl) {
              const elapsedValEl = elapsedEl.querySelector('.elapsed-val');
              if (elapsedValEl) {
                elapsedValEl.textContent = lockStatus.elapsedStr;
              } else {
                elapsedEl.innerHTML = `<i data-lucide="timer"></i> <span class="elapsed-val">${lockStatus.elapsedStr}</span>`;
                renderLucideIcons(elapsedEl);
              }
            }
          }
        });
      }, 1000);
    }
    renderLucideIcons(tbody.parentElement || tbody);
  }

  function renderAdminDriversTable(monthPrefix) {
    const tbody = document.getElementById('admin-drivers-tbody');
    if (!tbody) return;

    const isViewer = currentSession?.role === 'viewer';

    if (appData.drivers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${isViewer ? 6 : 11}" style="text-align:center; color:#94a3b8; padding:2rem;">Hech qanday haydovchi qo'shilmagan</td></tr>`;
      const pagWrap = document.getElementById('drivers-pagination-wrapper');
      if (pagWrap) pagWrap.innerHTML = '';
      return;
    }

    const today = new Date();
    const todayStr = getTodayString();
    if (!monthPrefix) {
      monthPrefix = document.getElementById('admin-month-filter')?.value || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }

    const totalItems = appData.drivers.length;
    const pagState = paginationState.drivers;
    const totalPages = Math.max(1, Math.ceil(totalItems / pagState.pageSize));
    if (pagState.page > totalPages) pagState.page = totalPages;
    if (pagState.page < 1) pagState.page = 1;

    const startIndex = (pagState.page - 1) * pagState.pageSize;
    const pageItems = appData.drivers.slice(startIndex, startIndex + pagState.pageSize);

    tbody.innerHTML = pageItems.map((drv, idx) => {
      const rowNum = startIndex + idx + 1;
      const summary = getDriverMonthSummary(drv.id, monthPrefix);

      // Bugungi holati
      const activeTrip = appData.attendances.find(a => a.driverId === drv.id && a.status === 'in_progress');
      const todayShift = (appData.shifts || []).find(s => s.driverId === drv.id && s.date === todayStr);

      let todayStatusBadge = '<span class="badge-status idle" style="font-size:0.75rem; padding:1px 6px;"><i data-lucide="coffee"></i> Dam olmoqda</span>';
      if (activeTrip) {
        todayStatusBadge = `<span class="badge-status active" style="font-size:0.75rem; padding:1px 6px;"><i data-lucide="truck"></i> Reysda (${activeTrip.fromRegion} ➔ ${activeTrip.toRegion})</span>`;
      } else if (todayShift && todayShift.status === 'active') {
        todayStatusBadge = '<span class="badge-status warning" style="font-size:0.75rem; padding:1px 6px; background:rgba(234,179,8,0.15); color:#eab308; border-color:rgba(234,179,8,0.3);"><i data-lucide="hourglass"></i> Smenada (Reys kutmoqda)</span>';
      } else if (todayShift && todayShift.status === 'completed') {
        todayStatusBadge = todayShift.isNoTrip 
          ? `<span class="badge-status warning" style="font-size:0.75rem; padding:1px 6px;"><i data-lucide="history"></i> ${todayShift.autoComment || 'Reys bo\'lmadi'}</span>`
          : `<span class="badge-status completed" style="font-size:0.75rem; padding:1px 6px;"><i data-lucide="check-circle-2"></i> Smena yakunlangan (${todayShift.completedTrips || 0} ta reys)</span>`;
      }

      return `
        <tr class="clickable-row" onclick="window.openDriverDetailsModal('${escapeHtml(drv.id)}')" title="Haydovchi ma'lumotlarini ko'rish uchun bosing">
          <td>${rowNum}</td>
          <td>
            <strong style="color:var(--primary); font-size:0.95rem;">${escapeHtml(drv.fullName)} <i data-lucide="external-link" style="width:0.75rem; height:0.75rem; margin-left:3px; opacity:0.7;"></i></strong>
            <div style="margin-top:4px;">${todayStatusBadge}</div>
          </td>
          <td>${isViewer ? escapeHtml(maskPhoneNumber(drv.phone)) : escapeHtml(formatPhoneNumber(drv.phone))}</td>
          <td class="col-driver-salary" style="font-family:var(--font-mono); font-weight:700;">${formatMoney(drv.monthlySalary)}</td>
          <td class="col-driver-daily-rate" style="font-family:var(--font-mono); color:var(--info); font-weight:700;">${formatMoney(summary.dailyRate)}</td>
          <td><span class="trip-num-tag"><i data-lucide="navigation"></i> ${summary.completedTripsCount} ta</span></td>
          <td class="col-driver-earned" style="font-family:var(--font-mono); font-weight:700; color:var(--success);">${formatMoney(summary.totalEarned)}</td>
          <td class="col-driver-advance"><strong class="text-danger" style="font-family:var(--font-mono);">${summary.totalAdvances > 0 ? `-${formatMoney(summary.totalAdvances)}` : "0 so'm"}</strong></td>
          <td class="col-driver-net"><strong class="text-net" style="font-family:var(--font-mono); font-size:1rem;">${formatMoney(summary.netSalary)}</strong></td>
          <td onclick="event.stopPropagation()">
            ${isViewer ? `<code class="credential-code">${escapeHtml(drv.login)}</code>` : `<code class="credential-code">${escapeHtml(drv.login)}</code> / <code class="credential-code">${escapeHtml(drv.password)}</code>`}
          </td>
          <td onclick="event.stopPropagation()">
            ${isViewer ? `<span class="read-only-badge"><i data-lucide="lock"></i> Faqat ko'rish</span>` : `
            <button class="btn-icon danger" onclick="event.stopPropagation(); window.deleteDriver('${escapeHtml(drv.id)}')" title="Haydovchini o'chirish">
              <i data-lucide="trash-2"></i>
            </button>`}
          </td>
        </tr>
      `;
    }).join('');

    renderPaginationControls('drivers-pagination-wrapper', totalItems, 'drivers', () => {
      renderAdminDriversTable(monthPrefix);
    });
    renderLucideIcons(tbody);
  }

  // ================= ADMIN TRUCKS MANAGEMENT =================
  function renderAdminTrucksTable() {
    const tbody = document.getElementById('admin-trucks-tbody');
    if (!tbody) return;

    if (!appData.trucks || appData.trucks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:2rem;">Mashinalar parkida hozircha mashina mavjud emas</td></tr>`;
      return;
    }

    tbody.innerHTML = appData.trucks.map((truck, idx) => {
      // Check if truck is currently on trip
      const activeTrip = appData.attendances.find(a => 
        a.status === 'in_progress' && (a.truckId === truck.id || a.truckNumber === truck.plateNumber)
      );

      const statusBadge = activeTrip 
        ? `<span class="badge-status active"><span class="truck-on-road"><i data-lucide="truck" class="truck-driving"></i></span> Reysda (${escapeHtml(activeTrip.driverName)} &bull; ${escapeHtml(activeTrip.fromRegion)} ➔ ${escapeHtml(activeTrip.toRegion)})</span>`
        : `<span class="badge-status completed"><i data-lucide="check-circle-2"></i> Bo'sh (Parkda)</span>`;

      return `
        <tr>
          <td>${idx + 1}</td>
          <td><strong><i data-lucide="truck" class="text-primary"></i> ${escapeHtml(truck.name)}</strong></td>
          <td><span class="truck-badge" style="font-size:0.95rem;">${escapeHtml(formatPlateNumber(truck.plateNumber))}</span></td>
          <td>${statusBadge}</td>
          <td>
            ${currentSession?.role === 'viewer' ? `<span class="read-only-badge"><i data-lucide="lock"></i> Faqat ko'rish</span>` : `
            <button class="btn-icon danger" onclick="window.deleteTruck('${escapeHtml(truck.id)}')" title="Mashinani parkdan o'chirish">
              <i data-lucide="trash-2"></i>
            </button>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  function handleAddTruck(e) {
    e.preventDefault();
    if (currentSession?.role === 'viewer') {
      showToast("Kuzatuvchi rejimida yangi mashina qo'shish taqiqlangan!", 'warning');
      return;
    }
    const name = document.getElementById('new-truck-name').value.trim();
    const rawPlate = document.getElementById('new-truck-plate').value.trim();
    const plate = formatPlateNumber(rawPlate);

    if (!name || !plate) {
      showToast("Mashina rusumi va davlat raqamini kiriting!", 'warning');
      return;
    }

    if (!appData.trucks) appData.trucks = [];

    // Duplicate check (bo'sh joylarni hisobga olmagan holda solishtirish)
    const normalizedPlate = plate.replace(/\s+/g, '').toUpperCase();
    if (appData.trucks.some(t => (t.plateNumber || '').replace(/\s+/g, '').toUpperCase() === normalizedPlate)) {
      showToast(`'${plate}' raqamli mashina allaqachon ro'yxatda mavjud!`, 'danger');
      return;
    }

    const newTruck = {
      id: 'trk_' + Date.now(),
      name: name,
      plateNumber: plate,
      status: 'active'
    };

    appData.trucks.push(newTruck);
    DB.save(appData);

    showToast(`Yangi mashina (${name} - ${plate}) muvaffaqiyatli qo'shildi!`, 'success');
    document.getElementById('add-truck-form').reset();
    renderAdminTrucksTable();
    renderAdminDashboard();
  }

  window.deleteTruck = function (truckId) {
    if (currentSession?.role === 'viewer') {
      showToast("Kuzatuvchi rejimida mashinani o'chirish taqiqlangan!", 'warning');
      return;
    }
    if (!confirm("Haqiqatan ham ushbu mashinani ro'yxatdan o'chirmoqchimisiz?")) return;
    appData.deletedTruckIds = appData.deletedTruckIds || [];
    if (!appData.deletedTruckIds.includes(truckId)) {
      appData.deletedTruckIds.push(truckId);
    }
    appData.trucks = (appData.trucks || []).filter(t => t.id !== truckId);
    DB.save(appData);
    showToast("Mashina ro'yxatdan o'chirildi", 'info');
    renderAdminTrucksTable();
    renderAdminDashboard();
  };

  // ================= ADMIN ADVANCES MANAGEMENT =================
  function renderAdminAdvancesTable() {
    const tbody = document.getElementById('admin-advances-tbody');
    if (!tbody) return;

    if (!appData.advances || appData.advances.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:2rem;">Hozircha hech qanday avans berilmagan</td></tr>`;
      const pagWrap = document.getElementById('advances-pagination-wrapper');
      if (pagWrap) pagWrap.innerHTML = '';
      return;
    }

    const sorted = [...appData.advances].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    const isViewer = currentSession?.role === 'viewer';

    const totalItems = sorted.length;
    const pagState = paginationState.advances;
    const totalPages = Math.max(1, Math.ceil(totalItems / pagState.pageSize));
    if (pagState.page > totalPages) pagState.page = totalPages;
    if (pagState.page < 1) pagState.page = 1;

    const startIndex = (pagState.page - 1) * pagState.pageSize;
    const pageItems = sorted.slice(startIndex, startIndex + pagState.pageSize);

    tbody.innerHTML = pageItems.map((adv, idx) => {
      const rowNum = startIndex + idx + 1;
      return `
        <tr>
          <td>${rowNum}</td>
          <td><strong>${escapeHtml(adv.date)}</strong> <span style="font-size:0.8rem; color:#94a3b8;">${escapeHtml(adv.time || '')}</span></td>
          <td>
            <span class="clickable-driver-name" onclick="window.openDriverDetailsModal('${escapeHtml(adv.driverId)}')" title="Haydovchi profilini ochish">
              ${escapeHtml(adv.driverName)} <i data-lucide="external-link" style="width:0.75rem; height:0.75rem; margin-left:3px; opacity:0.7;"></i>
            </span>
          </td>
          <td>${isViewer ? escapeHtml(maskPhoneNumber(adv.phone)) : escapeHtml(adv.phone ? formatPhoneNumber(adv.phone) : '-')}</td>
          <td><strong class="text-danger" style="font-family:var(--font-mono); font-size:1.1rem;">-${formatMoney(adv.amount)}</strong></td>
          <td>${adv.comment ? escapeHtml(adv.comment) : '<span style="color:#94a3b8;">Izohsiz</span>'}</td>
          <td>
            ${isViewer ? `<span class="read-only-badge"><i data-lucide="lock"></i> Faqat ko'rish</span>` : `
            <button class="btn-icon danger" onclick="window.deleteAdvance('${escapeHtml(adv.id)}')" title="Ushbu avansni bekor qilish / o'chirish">
              <i data-lucide="trash-2"></i>
            </button>`}
          </td>
        </tr>
      `;
    }).join('');

    renderPaginationControls('advances-pagination-wrapper', totalItems, 'advances', () => {
      renderAdminAdvancesTable();
    });
    renderLucideIcons(tbody);
  }

  function handleGiveAdvance(e) {
    e.preventDefault();
    if (currentSession?.role === 'viewer') {
      showToast("Kuzatuvchi rejimida avans berish taqiqlangan!", 'warning');
      return;
    }
    const form = e.target;
    const isModal = form.id === 'modal-quick-advance-form';
    const driverSelect = isModal ? document.getElementById('modal-advance-driver-select') : document.getElementById('advance-driver-select');
    const amountInput = isModal ? document.getElementById('modal-advance-amount-input') : document.getElementById('advance-amount-input');
    const commentInput = isModal ? document.getElementById('modal-advance-comment-input') : document.getElementById('advance-comment-input');

    const driverId = driverSelect ? driverSelect.value : '';
    const amount = Number(amountInput ? amountInput.value : 0);
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!driverId) {
      showToast("Iltimos, avans beriladigan haydovchini tanlang!", 'warning');
      return;
    }

    if (!amount || amount <= 0) {
      showToast("To'g'ri avans summasini kiriting!", 'warning');
      return;
    }

    const driver = appData.drivers.find(d => d.id === driverId);
    if (!driver) {
      showToast("Haydovchi topilmadi!", 'danger');
      return;
    }

    if (!appData.advances) appData.advances = [];

    const newAdvance = {
      id: 'adv_' + Date.now(),
      driverId: driver.id,
      driverName: driver.fullName,
      phone: driver.phone,
      amount: amount,
      date: getTodayString(),
      time: getCurrentTimeString(),
      comment: comment || 'Yo\'l xarajati uchun avans'
    };

    appData.advances.push(newAdvance);
    DB.save(appData);

    showToast(`💸 ${driver.fullName} ga ${formatMoney(amount)} avans muvaffaqiyatli berildi! Haydovchi kabinetida -${formatMoney(amount)} bo'lib aks etadi.`, 'success');

    form.reset();
    if (isModal) {
      window.closeQuickAdvanceModal();
    }

    renderAdminDashboard();
  }

  window.deleteAdvance = function (advId) {
    if (currentSession?.role === 'viewer') {
      showToast("Kuzatuvchi rejimida avansni o'chirish taqiqlangan!", 'warning');
      return;
    }
    if (!confirm("Ushbu avans yozuvini bekor qilishni tasdiqlaysizmi?")) return;
    appData.advances = (appData.advances || []).filter(a => a.id !== advId);
    DB.save(appData);
    showToast("Avans yozuvi o'chirildi", 'info');
    renderAdminDashboard();
  };

  window.openQuickAdvanceModal = function (driverId = null) {
    if (currentSession?.role === 'viewer') return;
    window.switchAdminTab('tab-advances');
    if (driverId) {
      const select = document.getElementById('advance-driver-select');
      if (select) select.value = driverId;
    }
  };

  window.closeQuickAdvanceModal = function () {
    const modal = document.getElementById('quick-advance-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  };

  // ================= ADMIN ADD DRIVER =================
  function handleAddDriver(e) {
    e.preventDefault();
    if (currentSession?.role === 'viewer') {
      showToast("Kuzatuvchi rejimida yangi haydovchi qo'shish taqiqlangan!", 'warning');
      return;
    }
    const name = document.getElementById('new-driver-name').value.trim();
    const rawPhone = document.getElementById('new-driver-phone').value.trim();
    const phone = formatPhoneNumber(rawPhone);
    const phoneDigits = phone.replace(/\D/g, '');
    const salary = Number(document.getElementById('new-driver-salary').value);
    const login = document.getElementById('new-driver-login').value.trim().toLowerCase();
    const password = document.getElementById('new-driver-password').value.trim();

    if (!name || !rawPhone || rawPhone === PHONE_PREFIX || !salary || !login || !password) {
      showToast("Barcha maydonlarni to'ldiring!", 'danger');
      return;
    }

    if (phoneDigits.length < 12) {
      showToast("Iltimos, telefon raqamini to'liq kiriting: +998 XX XXX XX XX", 'danger');
      return;
    }

    // Check duplicate login across all system accounts (drivers, admin, superadmin, viewer)
    const loginLower = login.toLowerCase();
    const isTaken = (appData.drivers || []).some(d => (d.login || '').toLowerCase() === loginLower) ||
      (appData.admin && (appData.admin.username || '').toLowerCase() === loginLower) ||
      (appData.superadmin && (appData.superadmin.username || '').toLowerCase() === loginLower) ||
      (appData.viewer && (appData.viewer.username || '').toLowerCase() === loginLower) ||
      loginLower === 'admin';

    if (isTaken) {
      showToast(`'${login}' logini tizimda allaqachon band. Iltimos boshqa login tanlang!`, 'danger');
      return;
    }

    const newDriver = {
      id: 'drv_' + Date.now(),
      fullName: name,
      phone: phone,
      monthlySalary: salary,
      login: login,
      password: password,
      createdAt: new Date().toISOString()
    };

    appData.drivers.push(newDriver);
    DB.save(appData);

    showToast(`Yangi haydovchi (${name}) muvaffaqiyatli qo'shildi!`, 'success');
    document.getElementById('add-driver-form').reset();
    const newPhoneInput = document.getElementById('new-driver-phone');
    if (newPhoneInput) {
      newPhoneInput.value = PHONE_PREFIX;
      setupPhoneInputMask(newPhoneInput);
    }
    document.getElementById('salary-preview-hint').textContent = 'Kunlik stavka taxminan: 0 so\'m / kun';

    // Switch to drivers list tab
    window.switchAdminTab('tab-drivers');
    renderAdminDashboard();
  }

  // Admin delete driver
  window.deleteDriver = function (driverId) {
    if (currentSession?.role === 'viewer') {
      showToast("Kuzatuvchi rejimida haydovchini o'chirish taqiqlangan!", 'warning');
      return;
    }
    const drv = appData.drivers.find(d => d.id === driverId);
    if (!drv) return;

    if (!confirm(`Haqiqatdan ham "${drv.fullName}" haydovchisini va uning barcha ma'lumotlarini butunlay o'chirmoqchimisiz?`)) {
      return;
    }

    // Add to tombstone list so it NEVER gets resurrected by cloud sync
    appData.deletedDriverIds = appData.deletedDriverIds || [];
    if (!appData.deletedDriverIds.includes(driverId)) {
      appData.deletedDriverIds.push(driverId);
    }

    appData.drivers = (appData.drivers || []).filter(d => d.id !== driverId);
    appData.attendances = (appData.attendances || []).filter(a => a.driverId !== driverId);
    if (appData.advances) {
      appData.advances = appData.advances.filter(a => a.driverId !== driverId);
    }
    if (appData.shifts) {
      appData.shifts = appData.shifts.filter(s => s.driverId !== driverId);
    }
    DB.save(appData);

    showToast(`"${drv.fullName}" haydovchisi tizimdan to'liq o'chirildi!`, 'warning');
    renderAdminDashboard();
  };

  // Admin delete single attendance record
  window.deleteAttendance = function (attendanceId) {
    if (currentSession?.role === 'viewer') {
      showToast("Kuzatuvchi rejimida reys yozuvini o'chirish taqiqlangan!", 'warning');
      return;
    }
    if (!confirm("Ushbu reys yozuvini o'chirishni tasdiqlaysizmi?")) return;

    appData.attendances = (appData.attendances || []).filter(a => a.id !== attendanceId);
    DB.save(appData);

    showToast("Reys yozuvi o'chirildi", 'info');
    renderAdminDashboard();
  };

  // ================= ADMIN CHANGE PASSWORD =================
  function handleChangeAdminPassword(e) {
    e.preventDefault();
    if (currentSession?.role === 'viewer') {
      showToast("Kuzatuvchi rejimida parolni o'zgartirish taqiqlangan!", 'warning');
      return;
    }
    const currentPass = document.getElementById('admin-current-pass').value;
    const newPass = document.getElementById('admin-new-pass').value;
    const confirmPass = document.getElementById('admin-confirm-pass').value;

    if (currentPass !== appData.admin.password) {
      showToast("Hozirgi parol noto'g'ri kiritildi!", 'danger');
      return;
    }

    if (newPass.length < 4) {
      showToast("Yangi parol kamida 4 ta belgidan iborat bo'lishi shart!", 'warning');
      return;
    }

    if (newPass !== confirmPass) {
      showToast("Yangi parollar mos kelmadi!", 'danger');
      return;
    }

    appData.admin.password = newPass;
    DB.save(appData);

    showToast("Admin paroli muvaffaqiyatli yangilandi!", 'success');
    document.getElementById('change-admin-password-form').reset();
  }

  // ================= EXCEL EXPORT (SHEETJS & CSV FALLBACK) =================
  function exportToCSVFallback(attendanceRows, summaryRows, fileName) {
    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel to render Uzbek characters properly

    csvContent += "=== REYSLAR VA KUNLIK MAOSHLAR JURNALI ===\r\n";
    if (attendanceRows.length > 0) {
      const headers = Object.keys(attendanceRows[0]);
      csvContent += headers.map(h => `"${h}"`).join(";") + "\r\n";
      attendanceRows.forEach(row => {
        csvContent += headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(";") + "\r\n";
      });
    }

    csvContent += "\r\n=== OYLIK UMUMIY XULOSA VA AVANSLAR ===\r\n";
    if (summaryRows.length > 0) {
      const sumHeaders = Object.keys(summaryRows[0]);
      csvContent += sumHeaders.map(h => `"${h}"`).join(";") + "\r\n";
      summaryRows.forEach(row => {
        csvContent += sumHeaders.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(";") + "\r\n";
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.xlsx$/, '.csv');
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Hisobot Excel (CSV) formatida yuklab olindi!`, 'success');
  }

  function exportAttendanceToExcel() {
    const isViewer = currentSession?.role === 'viewer';
    const monthInput = document.getElementById('filter-month');
    const selectedMonth = monthInput?.value || getTodayString().slice(0, 7);
    const searchVal = (document.getElementById('search-attendance')?.value || '').toLowerCase().trim();

    let filtered = appData.attendances.filter(a => a.date.startsWith(selectedMonth));

    // Respect active quick filter chips
    if (typeof currentAttendanceFilter !== 'undefined') {
      if (currentAttendanceFilter === 'in_progress') {
        filtered = filtered.filter(a => a.status === 'in_progress');
      } else if (currentAttendanceFilter === 'completed') {
        filtered = filtered.filter(a => a.status === 'completed');
      } else if (currentAttendanceFilter === 'today') {
        const todayStr = getTodayString();
        filtered = filtered.filter(a => a.date === todayStr);
      }
    }

    // Respect search query
    if (searchVal) {
      filtered = filtered.filter(a => 
        (a.driverName && a.driverName.toLowerCase().includes(searchVal)) ||
        (a.truckNumber && (a.truckNumber.toLowerCase().includes(searchVal) || a.truckNumber.toLowerCase().replace(/\s+/g, '').includes(searchVal.replace(/\s+/g, '')))) ||
        (a.truckName && a.truckName.toLowerCase().includes(searchVal)) ||
        (a.fromRegion && a.fromRegion.toLowerCase().includes(searchVal)) ||
        (a.toRegion && a.toRegion.toLowerCase().includes(searchVal))
      );
    }

    if (filtered.length === 0) {
      showToast("Tanlangan filtrlar bo'yicha eksport qilish uchun hech qanday ma'lumot topilmadi!", 'warning');
      return;
    }

    // 1. Prepare detailed attendance rows
    const attendanceRows = filtered.map((att, idx) => {
      const isSame = att.fromRegion === att.toRegion;
      const distKm = isSame ? 0 : (att.distanceKm !== undefined ? att.distanceKm : getRouteDistanceKm(att.fromRegion, att.toRegion));
      const minMin = att.minAllowedMinutes || calculateMinAllowedMinutes(distKm, att.fromRegion, att.toRegion);
      const row = {
        "T/r": idx + 1,
        "Sana": att.date,
        "Reys #": `Reys #${att.tripNumber || 1}`,
        "Haydovchi F.I.O": att.driverName,
        "Mashina": `${att.truckName || ''} (${att.truckNumber})`,
        "Marshrut": isSame ? `${att.fromRegion} (Viloyat ichida)` : `${att.fromRegion || 'Namangan'} -> ${att.toRegion || 'Farg\'ona'}`,
        "Masofa (km)": isSame ? 'Viloyat ichida' : distKm,
        "Telefon": isViewer ? maskPhoneNumber(att.phone) : (att.phone ? formatPhoneNumber(att.phone) : ''),
        "Boshlangan Vaqti": att.checkInTime || '',
        "Tugatilgan Vaqti": att.checkOutTime || '',
        "Davomiyligi": att.durationText || ''
      };

      if (!isViewer) {
        row["Kunlik Stavka (so'm)"] = att.dailyRate || 0;
        row["Hisoblangan Summa (so'm)"] = att.earnedAmount || 0;
      }
      row["Holati"] = att.status === 'completed' ? 'Tugatilgan' : 'Reysda';
      return row;
    });

    // 2. Prepare driver monthly summary rows
    const summaryRows = appData.drivers.map((drv, idx) => {
      const summary = getDriverMonthSummary(drv.id, selectedMonth);

      const row = {
        "T/r": idx + 1,
        "Haydovchi F.I.O": drv.fullName,
        "Telefon": isViewer ? maskPhoneNumber(drv.phone) : (drv.phone ? formatPhoneNumber(drv.phone) : ''),
        "Ishlagan Kunlari Soni": summary.daysWorked,
        "Bajargan Reyslari Soni": summary.completedTripsCount
      };

      if (!isViewer) {
        row["Belgilangan Oylik (so'm)"] = drv.monthlySalary;
        row["To'plangan Maosh (so'm)"] = summary.totalEarned;
        row["Olingan Avans (so'm)"] = summary.totalAdvances;
        row["Qoldiq To'lanadigan (so'm)"] = summary.netSalary;
      }

      return row;
    });

    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const dateFormatted = `${d}.${m}.${y}`;
    const fileName = `BourkhanTrans_Reyslar_Hisoboti_${dateFormatted}.xlsx`;

    // Check if SheetJS is available, otherwise use CSV fallback
    if (typeof XLSX === 'undefined') {
      exportToCSVFallback(attendanceRows, summaryRows, fileName);
      return;
    }

    // Create workbook with SheetJS
    const wb = XLSX.utils.book_new();

    // Sheet 1: Reyslar Jurnali
    const ws1 = XLSX.utils.json_to_sheet(attendanceRows);
    XLSX.utils.book_append_sheet(wb, ws1, "Reyslar jurnali");

    // Sheet 2: Oylik Umumiy Hisob
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws2, isViewer ? "Haydovchilar Faoliyati" : "Oylik Maosh va Avanslar");

    // Sheet 3: Olingan Avanslar Jurnali (admin/superadmin uchun)
    if (!isViewer) {
      const monthAdvances = (appData.advances || []).filter(a => !a.date || a.date.startsWith(selectedMonth));
      if (monthAdvances.length > 0) {
        const advanceRows = monthAdvances.map((adv, idx) => ({
          "T/r": idx + 1,
          "Sana": adv.date,
          "Vaqt": adv.time || '',
          "Haydovchi F.I.O": adv.driverName,
          "Avans Summasi (so'm)": Number(adv.amount) || 0,
          "Izoh": adv.comment || '',
          "Bergan Shaxs": adv.issuedBy || 'Admin'
        }));
        const ws3 = XLSX.utils.json_to_sheet(advanceRows);
        XLSX.utils.book_append_sheet(wb, ws3, "Olingan Avanslar");
      }
    }

    // Write & download
    XLSX.writeFile(wb, fileName);
    showToast(`Hisobot Excel (.xlsx) formatida yuklab olindi!`, 'success');
  }

  // ================= DRIVER DETAILS MODAL =================
  let currentModalDriverId = null;

  window.handleDriverBadgeClick = function () {
    // 2 marta bosganda ma'lumot chiqishi foydalanuvchi talabiga ko'ra o'chirildi
  };

  window.openDriverDetailsModal = function (driverId) {
    const driver = appData.drivers.find(d => d.id === driverId);
    if (!driver) {
      showToast("Haydovchi ma'lumotlari topilmadi", 'warning');
      return;
    }

    const isViewer = currentSession?.role === 'viewer';
    currentModalDriverId = driverId;

    const modal = document.getElementById('driver-details-modal');
    if (!modal) return;

    const monthInput = document.getElementById('filter-month');
    const selectedMonth = monthInput ? (monthInput.value || getTodayString().slice(0, 7)) : getTodayString().slice(0, 7);

    // Profile details
    document.getElementById('modal-driver-name').textContent = driver.fullName;
    document.getElementById('modal-driver-phone').textContent = isViewer ? maskPhoneNumber(driver.phone) : (driver.phone ? formatPhoneNumber(driver.phone) : '-');
    document.getElementById('modal-driver-salary').textContent = formatMoney(driver.monthlySalary);

    const summary = getDriverMonthSummary(driver.id, selectedMonth);
    document.getElementById('modal-driver-daily-rate').textContent = formatMoney(summary.dailyRate);

    const truckEl = document.getElementById('modal-driver-truck');
    if (truckEl) {
      const assignedTruck = (appData.trucks || []).find(t => t.assignedDriverId === driver.id);
      truckEl.textContent = assignedTruck ? `${assignedTruck.model || 'Yuk mashinasi'} (${assignedTruck.plateNumber})` : 'Biriktirilmagan';
    }

    // Trips for this driver in selected month
    const driverLogs = appData.attendances
      .filter(a => a.driverId === driver.id && a.date.startsWith(selectedMonth))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.tripNumber || 0) - (a.tripNumber || 0));

    // Advances for this driver
    const driverAdv = (appData.advances || [])
      .filter(a => a.driverId === driver.id && (!a.date || a.date.startsWith(selectedMonth)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

    document.getElementById('modal-driver-trips-count').textContent = `${summary.completedTripsCount} ta reys (${summary.daysWorked} kun)`;
    document.getElementById('modal-driver-earned-salary').textContent = formatMoney(summary.totalEarned);
    document.getElementById('modal-driver-advance-val').textContent = summary.totalAdvances > 0 ? `-${formatMoney(summary.totalAdvances)}` : "0 so'm";
    document.getElementById('modal-driver-net-salary').textContent = formatMoney(summary.netSalary);

    // Modal table
    const tbody = document.getElementById('modal-driver-attendance-tbody');
    if (tbody) {
      if (driverLogs.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="${isViewer ? 9 : 10}" class="empty-state-cell">
              <div class="empty-state-box">
                <i data-lucide="navigation"></i>
                <span>Ushbu oyda (${selectedMonth}) hali bajargan reyslari tarixi mavjud emas</span>
              </div>
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = driverLogs.map((att, idx) => {
          const isCompleted = att.status === 'completed';
          const statusBadge = isCompleted
            ? '<span class="badge-status completed"><i data-lucide="check"></i> Tugatilgan</span>'
            : '<span class="badge-status active"><span class="truck-on-road"><i data-lucide="truck" class="truck-driving"></i></span> Reysda</span>';
          const earnedText = isCompleted ? formatMoney(att.earnedAmount) : "Kutilmoqda";

          const isSame = att.fromRegion === att.toRegion;
          const distKm = isSame ? 0 : (att.distanceKm !== undefined ? att.distanceKm : getRouteDistanceKm(att.fromRegion, att.toRegion));

          return `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${escapeHtml(att.date)}</strong></td>
              <td><span class="trip-num-tag">Reys #${Number(att.tripNumber) || 1}</span></td>
              <td><span class="truck-badge">${escapeHtml(att.truckName || '')} (${escapeHtml(att.truckNumber || '')})</span></td>
              <td>
                <span class="route-badge">
                  <strong>${escapeHtml(att.fromRegion || 'Namangan')}</strong>
                  ${isSame ? '<span style="color:#10b981; margin:0 4px;">•</span>' : '<i data-lucide="arrow-right"></i>'}
                  <strong>${isSame ? '(Viloyat ichida)' : escapeHtml(att.toRegion || "Farg'ona")}</strong>
                  ${isSame 
                    ? '<span class="route-km-pill" style="margin-left:0.35rem; font-size:0.75rem; background:rgba(16,185,129,0.12); color:var(--success); padding:1px 5px; border-radius:4px; font-weight:700;">Viloyat ichida</span>' 
                    : `<span class="route-km-pill" style="margin-left:0.35rem; font-size:0.75rem; background:rgba(99,102,241,0.12); color:var(--primary); padding:1px 5px; border-radius:4px; font-weight:600;">${distKm} km</span>`}
                </span>
              </td>
              <td style="font-family:var(--font-mono);">${escapeHtml(att.checkInTime || '-')}</td>
              <td style="font-family:var(--font-mono);">${escapeHtml(att.checkOutTime || '-')}</td>
              <td>${escapeHtml(att.durationText || '-')}</td>
              <td class="col-modal-trip-rate" style="font-family:var(--font-mono); font-weight:700; color:var(--success);">${earnedText}</td>
              <td>${statusBadge}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Modal advances table
    const advTbody = document.getElementById('modal-driver-advances-tbody');
    if (advTbody) {
      if (driverAdv.length === 0) {
        advTbody.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state-cell">
              <div class="empty-state-box">
                <i data-lucide="receipt"></i>
                <span>Ushbu haydovchiga hali avans berilmagan (Qarzdorlik yo'q)</span>
              </div>
            </td>
          </tr>
        `;
      } else {
        advTbody.innerHTML = driverAdv.map((a, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td style="font-family:var(--font-mono); font-size:0.9rem;"><strong>${escapeHtml(a.date)}</strong> ${escapeHtml(a.time || '')}</td>
            <td style="font-family:var(--font-mono); font-weight:800; color:var(--danger); font-size:1.05rem;">-${formatMoney(a.amount)}</td>
            <td>${a.comment ? escapeHtml(a.comment) : '<span style="color:#94a3b8;">Yo\'l xarajati</span>'}</td>
            <td><span class="badge-status completed"><i data-lucide="user-check"></i> ${escapeHtml(a.issuedBy || 'Admin')}</span></td>
          </tr>
        `).join('');
      }
    }

    // Modal export single driver
    const exportBtn = document.getElementById('btn-modal-export-excel');
    if (exportBtn) {
      exportBtn.onclick = () => window.exportSingleDriverToExcel(driver.id);
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    renderLucideIcons(modal);
    document.body.style.overflow = 'hidden';
  };

  window.closeDriverDetailsModal = function () {
    const modal = document.getElementById('driver-details-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    currentModalDriverId = null;
    document.body.style.overflow = '';
  };

  window.openTechSupportModal = function () {
    const modal = document.getElementById('tech-support-modal');
    if (modal) {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      renderLucideIcons(modal);
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeTechSupportModal = function () {
    const modal = document.getElementById('tech-support-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  };

  // ================= HAYDOVCHILAR REYTINGI (RANKING & LEADERBOARD LOGIC) =================
  let currentRankingTruckId = 'all';

  function getMonthNameUzbek(monthKey) {
    if (!monthKey) {
      const now = new Date();
      monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const [y, m] = monthKey.split('-');
    const monthsUz = [
      'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
      'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
    ];
    const idx = parseInt(m, 10) - 1;
    return `${monthsUz[idx] || m} ${y}`;
  }

  function calculateDriverRankingStats(truckFilter, selectedMonth) {
    const allDrivers = appData.drivers || [];
    const allAttendances = appData.attendances || [];
    const allTrucks = appData.trucks || [];

    const selectedTruck = (truckFilter && truckFilter !== 'all') ? allTrucks.find(t => t.id === truckFilter) : null;
    const selectedPlateClean = selectedTruck?.plateNumber ? selectedTruck.plateNumber.replace(/\s+/g, '').toUpperCase() : '';

    // Filter attendances for selected month and status completed
    const monthLogs = allAttendances.filter(att => {
      if (!att.date || !att.date.startsWith(selectedMonth)) return false;
      if (att.status !== 'completed' || att.isNoTrip) return false;

      if (truckFilter && truckFilter !== 'all') {
        const attTruckId = att.truckId;
        const attPlateClean = (att.truckNumber || '').replace(/\s+/g, '').toUpperCase();
        const matchId = attTruckId && attTruckId === truckFilter;
        const matchPlate = selectedPlateClean && attPlateClean === selectedPlateClean;
        if (!matchId && !matchPlate) return false;
      }
      return true;
    });

    // Map each driver
    const driverStatsMap = new Map();
    allDrivers.forEach(d => {
      driverStatsMap.set(d.id, {
        id: d.id,
        fullName: d.fullName,
        phone: d.phone,
        monthlySalary: d.monthlySalary,
        tripsCount: 0,
        totalKm: 0,
        lastTripDate: null,
        lastTripTimestamp: 0
      });
    });

    let overallTripsCount = 0;
    let overallKm = 0;

    monthLogs.forEach(att => {
      let stat = driverStatsMap.get(att.driverId);
      if (!stat) {
        stat = {
          id: att.driverId,
          fullName: att.driverName || 'Noma\'lum haydovchi',
          phone: '',
          monthlySalary: 0,
          tripsCount: 0,
          totalKm: 0,
          lastTripDate: null,
          lastTripTimestamp: 0
        };
        driverStatsMap.set(att.driverId, stat);
      }

      let dist = Number(att.distanceKm);
      if (isNaN(dist) || dist <= 0) {
        dist = (att.fromRegion && att.toRegion) ? getRouteDistanceKm(att.fromRegion, att.toRegion) : 0;
      }
      dist = Number(dist) || 0;

      stat.tripsCount++;
      stat.totalKm += dist;
      overallTripsCount++;
      overallKm += dist;

      // Track last trip
      const tripTime = att.checkOutTime || att.checkInTime || '';
      let tripTimestamp = 0;
      if (att.date) {
        if (tripTime) {
          const [h = 0, m = 0, s = 0] = tripTime.split(':').map(Number);
          const d = new Date(att.date);
          d.setHours(h, m, s, 0);
          tripTimestamp = d.getTime() || 0;
        } else {
          tripTimestamp = new Date(att.date).getTime() || 0;
        }
      }

      if (tripTimestamp >= stat.lastTripTimestamp) {
        stat.lastTripTimestamp = tripTimestamp;
        stat.lastTripDateOnly = att.date || '';
        stat.lastTripTimeOnly = tripTime || '';
        stat.lastTripDate = att.date ? `${att.date} ${tripTime}`.trim() : '';
      }
    });

    // Sort drivers: 1) tripsCount DESC, 2) totalKm DESC, 3) fullName ASC
    const rankedList = Array.from(driverStatsMap.values()).sort((a, b) => {
      if (b.tripsCount !== a.tripsCount) {
        return b.tripsCount - a.tripsCount;
      }
      if (b.totalKm !== a.totalKm) {
        return b.totalKm - a.totalKm;
      }
      return (a.fullName || '').localeCompare(b.fullName || '');
    });

    const activeDriversCount = rankedList.filter(d => d.tripsCount > 0).length;

    return {
      rankedList,
      overallTripsCount,
      overallKm,
      activeDriversCount,
      totalDriversCount: allDrivers.length,
      selectedTruck
    };
  }

  window.renderDriverRankingData = function (truckFilter, selectedMonth) {
    if (!selectedMonth) {
      const monthInput = document.getElementById('filter-month');
      selectedMonth = (monthInput && monthInput.value) ? monthInput.value : getTodayString().slice(0, 7);
    }
    currentRankingTruckId = truckFilter || 'all';

    const {
      rankedList,
      overallTripsCount,
      overallKm,
      activeDriversCount,
      totalDriversCount,
      selectedTruck
    } = calculateDriverRankingStats(currentRankingTruckId, selectedMonth);

    // 1. Update strip
    const infoStrip = document.getElementById('ranking-truck-info-strip');
    if (infoStrip) {
      infoStrip.innerHTML = `
        <div class="ranking-info-pill">
          <i data-lucide="navigation" class="text-primary"></i> Jami reyslar: <strong>${overallTripsCount} ta</strong>
        </div>
        <div class="ranking-info-pill">
          <i data-lucide="route" class="text-success"></i> Jami masofa: <strong>${overallKm.toLocaleString('uz-UZ')} km</strong>
        </div>
        <div class="ranking-info-pill">
          <i data-lucide="users" class="text-gold"></i> Faol haydovchilar: <strong>${activeDriversCount} nafar</strong>
        </div>
        ${selectedTruck ? `
        <div class="ranking-info-pill">
          <i data-lucide="truck" class="text-info"></i> Fura: <strong>${escapeHtml(selectedTruck.name)} (${escapeHtml(selectedTruck.plateNumber)})</strong>
        </div>` : ''}
      `;
    }

    // 2. Total drivers tag
    const totalTag = document.getElementById('ranking-total-drivers-tag');
    if (totalTag) {
      totalTag.textContent = `${totalDriversCount} nafar haydovchi`;
    }

    // 3. Podium (Top 3)
    const podiumGrid = document.getElementById('ranking-podium-grid');
    if (podiumGrid) {
      if (overallTripsCount === 0) {
        podiumGrid.innerHTML = `
          <div class="ranking-empty-state" style="grid-column: 1 / -1; width: 100%;">
            <i data-lucide="crown"></i>
            <p>Ushbu ${selectedTruck ? 'fura' : 'oy'} bo'yicha hali reyslar yakunlanmagan. Reyslar bajarilgach, bu yerda TOP 3 peshqadamlar shohona tojlar bilan ko'rinadi!</p>
          </div>
        `;
      } else {
        const top3 = rankedList.slice(0, 3);
        const d1 = top3[0];
        const d2 = top3[1];
        const d3 = top3[2];

        const isCur1 = currentSession?.role === 'driver' && d1 && d1.id === currentSession.driverId;
        const isCur2 = currentSession?.role === 'driver' && d2 && d2.id === currentSession.driverId;
        const isCur3 = currentSession?.role === 'driver' && d3 && d3.id === currentSession.driverId;

        let cardsHtml = '';

        // 1-o'rin: GOLD (tilla toj)
        if (d1) {
          cardsHtml += `
            <div class="podium-card rank-1">
              <div class="podium-crown-icon gold" title="Tilla toj"><i data-lucide="crown"></i></div>
              <div class="podium-place-badge gold"><i data-lucide="crown"></i> GOLD</div>
              <div class="podium-driver-name">${escapeHtml(d1.fullName || '1-o\'rin')}</div>
              ${isCur1 ? '<span class="podium-current-tag"><i data-lucide="user-check"></i> Siz</span>' : ''}
              <div class="podium-trips-stat">
                <strong>${d1.tripsCount} ta</strong>
                <span>Reys bajardi</span>
              </div>
              <div class="podium-km-stat">
                <i data-lucide="route" class="text-primary"></i> ${d1.totalKm.toLocaleString('uz-UZ')} km
              </div>
            </div>
          `;
        }

        // 2-o'rin: SILVER (silver toj)
        if (d2) {
          cardsHtml += `
            <div class="podium-card rank-2">
              <div class="podium-crown-icon silver" title="Silver toj"><i data-lucide="crown"></i></div>
              <div class="podium-place-badge silver"><i data-lucide="crown"></i> SILVER</div>
              <div class="podium-driver-name">${escapeHtml(d2.fullName || '2-o\'rin')}</div>
              ${isCur2 ? '<span class="podium-current-tag"><i data-lucide="user-check"></i> Siz</span>' : ''}
              <div class="podium-trips-stat">
                <strong style="color: #94a3b8;">${d2.tripsCount} ta</strong>
                <span>Reys bajardi</span>
              </div>
              <div class="podium-km-stat">
                <i data-lucide="route" class="text-primary"></i> ${d2.totalKm.toLocaleString('uz-UZ')} km
              </div>
            </div>
          `;
        }

        // 3-o'rin: BRONZA (bronza toj)
        if (d3) {
          cardsHtml += `
            <div class="podium-card rank-3">
              <div class="podium-crown-icon bronze" title="Bronza toj"><i data-lucide="crown"></i></div>
              <div class="podium-place-badge bronze"><i data-lucide="crown"></i> BRONZA</div>
              <div class="podium-driver-name">${escapeHtml(d3.fullName || '3-o\'rin')}</div>
              ${isCur3 ? '<span class="podium-current-tag"><i data-lucide="user-check"></i> Siz</span>' : ''}
              <div class="podium-trips-stat">
                <strong style="color: #d97706;">${d3.tripsCount} ta</strong>
                <span>Reys bajardi</span>
              </div>
              <div class="podium-km-stat">
                <i data-lucide="route" class="text-primary"></i> ${d3.totalKm.toLocaleString('uz-UZ')} km
              </div>
            </div>
          `;
        }

        podiumGrid.innerHTML = cardsHtml;
      }
    }

    // 4. Table
    const tbody = document.getElementById('ranking-table-tbody');
    if (tbody) {
      if (rankedList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">Haydovchilar mavjud emas</td></tr>`;
      } else {
        tbody.innerHTML = rankedList.map((driver, idx) => {
          const rank = idx + 1;
          const isCurrentDriver = currentSession?.role === 'driver' && driver.id === currentSession.driverId;

          let rowClass = '';
          if (rank === 1) rowClass += ' row-rank-1';
          else if (rank === 2) rowClass += ' row-rank-2';
          else if (rank === 3) rowClass += ' row-rank-3';
          if (isCurrentDriver) rowClass += ' row-current-driver';

          let rankBadge = '';
          if (rank === 1) {
            rankBadge = `<div class="rank-badge-cell gold"><i data-lucide="crown"></i> GOLD</div>`;
          } else if (rank === 2) {
            rankBadge = `<div class="rank-badge-cell silver"><i data-lucide="crown"></i> SILVER</div>`;
          } else if (rank === 3) {
            rankBadge = `<div class="rank-badge-cell bronze"><i data-lucide="crown"></i> BRONZA</div>`;
          } else {
            rankBadge = `<div class="rank-badge-cell default">${rank}</div>`;
          }

          return `
            <tr class="${rowClass.trim()}">
              <td style="text-align: center;">${rankBadge}</td>
              <td>
                <div class="driver-name-cell">
                  <strong>${escapeHtml(driver.fullName)}</strong>
                  ${isCurrentDriver ? '<span class="driver-you-badge"><i data-lucide="user"></i> Siz</span>' : ''}
                </div>
              </td>
              <td class="trips-count-cell ${driver.tripsCount > 0 ? (rank === 1 ? 'text-gold' : '') : 'zero'}">
                ${driver.tripsCount} ta reys
              </td>
              <td class="km-count-cell">
                ${driver.totalKm > 0 ? driver.totalKm.toLocaleString('uz-UZ') + ' km' : '0 km'}
              </td>
              <td class="last-trip-cell">
                ${driver.lastTripDateOnly ? `
                  <span class="last-trip-badge">
                    <span class="last-trip-date">${escapeHtml(driver.lastTripDateOnly)}</span>
                    ${driver.lastTripTimeOnly ? `<span class="last-trip-divider">•</span><span class="last-trip-time">${escapeHtml(driver.lastTripTimeOnly)}</span>` : ''}
                  </span>
                ` : (driver.lastTripDate ? `<span class="last-trip-badge"><span class="last-trip-date">${escapeHtml(driver.lastTripDate)}</span></span>` : '—')}
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  };

  function updateDriverRankingCardPreview(driver, monthPrefix) {
    const rankCardVal = document.getElementById('driver-rank-card-val');
    if (rankCardVal) {
      rankCardVal.textContent = 'TOP reyting';
    }
  }

  function updateAdminRankingCardPreview(selectedMonth) {
    const adminRankCardVal = document.getElementById('admin-rank-card-val');
    if (adminRankCardVal) {
      adminRankCardVal.textContent = 'TOP reyting';
    }
  }

  window.openDriverRankingModal = function (preferredTruckId = null) {
    const modal = document.getElementById('driver-ranking-modal');
    if (!modal) return;

    const monthInput = document.getElementById('filter-month');
    const selectedMonth = (monthInput && monthInput.value) ? monthInput.value : getTodayString().slice(0, 7);

    // Month Badge
    const monthBadge = document.getElementById('ranking-month-badge');
    if (monthBadge) {
      monthBadge.innerHTML = `<i data-lucide="calendar-days"></i> ${getMonthNameUzbek(selectedMonth)}`;
    }

    // Populate truck select dropdown
    const truckSelect = document.getElementById('ranking-truck-select');
    const autoHint = document.getElementById('ranking-auto-hint');
    const allTrucks = appData.trucks || [];

    if (truckSelect) {
      let optionsHtml = `<option value="all">⭐ Barcha mashinalar (Umumiy reyting)</option>`;
      allTrucks.forEach(t => {
        optionsHtml += `<option value="${escapeHtml(t.id)}">🚛 ${escapeHtml(t.name)} (${escapeHtml(t.plateNumber)})</option>`;
      });
      truckSelect.innerHTML = optionsHtml;

      // Always default to 'all' (Barcha mashinalar) so all drivers' trips across the company are visible!
      currentRankingTruckId = (preferredTruckId && preferredTruckId !== 'all' && allTrucks.some(t => t.id === preferredTruckId)) ? preferredTruckId : 'all';
      truckSelect.value = currentRankingTruckId;

      if (autoHint) {
        if (currentRankingTruckId === 'all') {
          autoHint.innerHTML = `<i data-lucide="truck"></i> Barcha mashinalar (Umumiy)`;
        } else {
          autoHint.innerHTML = `<i data-lucide="filter"></i> Tanlangan fura`;
        }
        autoHint.style.display = 'inline-flex';
      }
    }

    window.renderDriverRankingData(currentRankingTruckId, selectedMonth);

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    renderLucideIcons(modal);
    document.body.style.overflow = 'hidden';
  };

  window.closeDriverRankingModal = function () {
    const modal = document.getElementById('driver-ranking-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  };

  window.exportSingleDriverToExcel = function (driverId) {
    const isViewer = currentSession?.role === 'viewer';
    const driver = appData.drivers.find(d => d.id === driverId);
    if (!driver) return;

    const monthInput = document.getElementById('filter-month');
    const selectedMonth = monthInput ? (monthInput.value || getTodayString().slice(0, 7)) : getTodayString().slice(0, 7);

    const driverLogs = appData.attendances
      .filter(a => a.driverId === driver.id && a.date.startsWith(selectedMonth))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.tripNumber || 0) - (a.tripNumber || 0));

    if (driverLogs.length === 0) {
      showToast(`${driver.fullName} uchun ${selectedMonth} oyida reyslar mavjud emas!`, 'warning');
      return;
    }

    const attendanceRows = driverLogs.map((att, idx) => {
      const row = {
        "T/r": idx + 1,
        "Sana": att.date,
        "Reys": `Reys #${att.tripNumber || 1}`,
        "Haydovchi": att.driverName,
        "Mashina": `${att.truckName || ''} (${att.truckNumber})`,
        "Marshrut": `${att.fromRegion} -> ${att.toRegion}`,
        "Boshlangan": att.checkInTime || '',
        "Tugatilgan": att.checkOutTime || '',
        "Davomiyligi": att.durationText || ''
      };
      if (!isViewer) {
        row["Stavka (so'm)"] = att.earnedAmount || 0;
      }
      row["Holati"] = att.status === 'completed' ? 'Tugatilgan' : 'Reysda';
      return row;
    });

    const summary = getDriverMonthSummary(driver.id, selectedMonth);
    const completedTrips = summary.completedTripsCount;
    const totalEarned = summary.totalEarned;
    const advTotal = summary.totalAdvances;
    const net = summary.netSalary;

    const summaryRows = [
      {
        "Haydovchi F.I.O": driver.fullName,
        "Telefon": isViewer ? maskPhoneNumber(driver.phone) : (driver.phone ? formatPhoneNumber(driver.phone) : ''),
        "Hisobot Oyi": selectedMonth,
        "Ishlagan Kunlari Soni": summary.daysWorked,
        "Bajargan Reyslari Soni": completedTrips
      }
    ];

    if (!isViewer) {
      summaryRows[0]["Belgilangan Oylik (so'm)"] = driver.monthlySalary;
      summaryRows[0]["Kunlik Stavka (so'm)"] = summary.dailyRate;
      summaryRows[0]["To'plangan Maosh (so'm)"] = totalEarned;
      summaryRows[0]["Olingan Avans (so'm)"] = advTotal;
      summaryRows[0]["To'lanadigan Qoldiq (so'm)"] = net;
    }

    const safeName = driver.fullName.replace(/\s+/g, '_');
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const dateFormatted = `${d}.${m}.${y}`;
    const fileName = `${safeName}_Reyslar_Hisoboti_${dateFormatted}.xlsx`;

    if (typeof XLSX === 'undefined') {
      exportToCSVFallback(attendanceRows, summaryRows, fileName);
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(attendanceRows);
    XLSX.utils.book_append_sheet(wb, ws1, "Reyslar Jurnali");

    if (!isViewer) {
      const driverAdv = (appData.advances || [])
        .filter(a => a.driverId === driver.id && (!a.date || a.date.startsWith(selectedMonth)))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

      const advanceRows = driverAdv.map((a, idx) => ({
        "T/r": idx + 1,
        "Sana": a.date,
        "Vaqt": a.time || '',
        "Avans Summasi (so'm)": Number(a.amount) || 0,
        "Izoh": a.comment || '',
        "Bergan Shaxs": a.issuedBy || 'Admin'
      }));

      if (advanceRows.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet(advanceRows);
        XLSX.utils.book_append_sheet(wb, ws3, "Olingan Avanslar");
      }
    }

    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws2, isViewer ? "Haydovchi Faoliyati" : "Xulosa va Qoldiq");

    XLSX.writeFile(wb, fileName);
    showToast(`${driver.fullName} hisoboti Excel (.xlsx) formatida yuklandi!`, 'success');
  };

  // ================= OYLIK BERISH (SALARY PAYOUT) LOGIC =================
  function renderAdminSalaryPayoutTable(monthPrefix) {
    const tbody = document.getElementById('salary-payout-tbody');
    if (!tbody) return;

    const monthInput = document.getElementById('salary-payout-month');
    const globalMonthInput = document.getElementById('filter-month');
    
    // Synchronize month input
    if (!monthPrefix) {
      if (monthInput && monthInput.value) {
        monthPrefix = monthInput.value;
      } else if (globalMonthInput && globalMonthInput.value) {
        monthPrefix = globalMonthInput.value;
      } else {
        const now = new Date();
        monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
    }

    if (monthInput && monthInput.value !== monthPrefix) {
      monthInput.value = monthPrefix;
    }

    const searchInput = document.getElementById('search-salary-driver');
    const searchVal = (searchInput ? searchInput.value : '').toLowerCase().trim();

    // Filter drivers by search term
    let driversList = appData.drivers || [];
    if (searchVal) {
      driversList = driversList.filter(d => 
        (d.fullName || '').toLowerCase().includes(searchVal) ||
        (d.phone || '').toLowerCase().includes(searchVal) ||
        (d.phone || '').replace(/\s+/g, '').includes(searchVal.replace(/\s+/g, ''))
      );
    }

    // ALPHABETICAL SORTING (A - Z by fullName)
    const sortedDrivers = driversList.slice().sort((a, b) => 
      (a.fullName || '').localeCompare(b.fullName || '', 'uz', { sensitivity: 'base' })
    );

    // Compute KPIs for this month
    let totalDriversCount = (appData.drivers || []).length;
    let totalEarnedSum = 0;
    let totalAdvancesSum = 0;
    let totalPaidSum = 0;

    (appData.drivers || []).forEach(d => {
      const summary = getDriverMonthSummary(d.id, monthPrefix);
      totalEarnedSum += (summary.totalEarned || 0);
      totalAdvancesSum += (summary.totalAdvances || 0);
      const payout = (appData.salaryPayouts || []).find(p => p.driverId === d.id && p.month === monthPrefix);
      if (payout) {
        totalPaidSum += (Number(payout.amount) || 0);
      }
    });

    // Update KPI UI
    const kpiDrivers = document.getElementById('payout-kpi-total-drivers');
    if (kpiDrivers) kpiDrivers.textContent = `${totalDriversCount} ta`;

    const kpiEarned = document.getElementById('payout-kpi-total-earned');
    if (kpiEarned) kpiEarned.textContent = formatMoney(totalEarnedSum);

    const kpiAdvances = document.getElementById('payout-kpi-total-advances');
    if (kpiAdvances) kpiAdvances.textContent = `-${formatMoney(totalAdvancesSum)}`;

    const kpiPaid = document.getElementById('payout-kpi-total-paid');
    if (kpiPaid) kpiPaid.textContent = formatMoney(totalPaidSum);

    // Render Table Rows
    if (sortedDrivers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
            <i data-lucide="user-x" style="width:2.2rem; height:2.2rem; margin-bottom:0.75rem; display:block; opacity:0.6;"></i>
            <span style="font-weight:600;">Birorta ham haydovchi topilmadi</span>
          </td>
        </tr>
      `;
      return;
    }

    const isViewer = currentSession?.role === 'viewer';

    tbody.innerHTML = sortedDrivers.map((driver, index) => {
      const summary = getDriverMonthSummary(driver.id, monthPrefix);
      const existingPayout = (appData.salaryPayouts || []).find(p => p.driverId === driver.id && p.month === monthPrefix);

      // Avatar initials
      const names = (driver.fullName || 'H').trim().split(/\s+/);
      const initials = names.length >= 2 ? (names[0][0] + names[1][0]).toUpperCase() : names[0].slice(0, 2).toUpperCase();

      // Display advances and carryover details
      let advanceDetailsHtml = `<strong class="salary-money text-danger">-${formatMoney(summary.totalAdvances)}</strong>`;
      if (summary.carryoverDebt > 0) {
        advanceDetailsHtml += `
          <div class="carryover-pill debt" title="Oldingi oydan o'tgan ortiqcha to'lov (qarz)">
            <i data-lucide="trending-up"></i> Oldingi oydan qarz: +${formatMoney(summary.carryoverDebt)}
          </div>
        `;
      }
      if (summary.carryoverCredit > 0) {
        advanceDetailsHtml += `
          <div class="carryover-pill credit" title="Oldingi oydan qolgan haqdorlik">
            <i data-lucide="gift"></i> Oldingi oydan haq: -${formatMoney(summary.carryoverCredit)}
          </div>
        `;
      }

      // Input value default
      const defaultInputValue = existingPayout ? existingPayout.amount : summary.netSalary;

      // Status badge
      let statusBadgeHtml = '';
      if (!existingPayout) {
        statusBadgeHtml = `<span class="payout-status-badge unpaid"><i data-lucide="clock"></i> To'lanmagan</span>`;
      } else {
        const diff = Number(existingPayout.difference) || 0;
        if (diff === 0) {
          statusBadgeHtml = `<span class="payout-status-badge paid"><i data-lucide="check-circle-2"></i> To'liq to'langan</span>`;
        } else if (diff > 0) {
          statusBadgeHtml = `
            <span class="payout-status-badge overpaid" title="Ortiqcha berilgan ${formatMoney(diff)} keyingi oyga avans bo'lib o'tadi">
              <i data-lucide="trending-up"></i> +${formatMoney(diff)} ortiqcha
            </span>
          `;
        } else {
          statusBadgeHtml = `
            <span class="payout-status-badge underpaid" title="Haydovchiga ${formatMoney(Math.abs(diff))} haqdorlik keyingi oyga o'tadi">
              <i data-lucide="arrow-down"></i> -${formatMoney(Math.abs(diff))} kam
            </span>
          `;
        }
      }

      // Input and actions cell
      let actionCellHtml = '';
      if (isViewer) {
        actionCellHtml = `<strong class="salary-money">${formatMoney(defaultInputValue)}</strong>`;
      } else {
        actionCellHtml = `
          <div class="salary-input-action-box">
            <input 
              type="number" 
              id="payout-input-${escapeHtml(driver.id)}" 
              class="salary-input-amount" 
              value="${defaultInputValue}" 
              min="0" 
              step="10000"
              placeholder="0"
              title="Berilgan summani kiriting"
            >
            <button 
              type="button" 
              class="btn-salary-save" 
              onclick="window.saveSalaryPayout('${escapeHtml(driver.id)}')" 
              title="Oylik to'lovini tasdiqlash va saqlash"
            >
              <i data-lucide="check"></i> ${existingPayout ? 'Saqlash' : 'To\'lash'}
            </button>
            ${existingPayout ? `
              <button 
                type="button" 
                class="btn-salary-clear" 
                onclick="window.deleteSalaryPayout('${escapeHtml(existingPayout.id)}')" 
                title="To'lovni bekor qilish"
              >
                <i data-lucide="trash-2"></i>
              </button>
            ` : ''}
          </div>
        `;
      }

      return `
        <tr>
          <td style="text-align: center; color: var(--text-muted); font-weight: 700; font-family: var(--font-mono);">${index + 1}</td>
          <td>
            <div class="salary-driver-cell">
              <div class="salary-driver-avatar">${escapeHtml(initials)}</div>
              <div class="salary-driver-meta">
                <span class="salary-driver-name">${escapeHtml(driver.fullName)}</span>
                <span class="salary-driver-phone">${escapeHtml(isViewer ? maskPhoneNumber(driver.phone) : (driver.phone ? formatPhoneNumber(driver.phone) : ''))}</span>
              </div>
            </div>
          </td>
          <td>
            <strong class="salary-money">${formatMoney(driver.monthlySalary)}</strong>
          </td>
          <td style="text-align: center;">
            <span class="salary-days-badge">
              <i data-lucide="calendar-check"></i> ${summary.daysWorked} kun
            </span>
          </td>
          <td>
            <strong class="salary-money text-success">${formatMoney(summary.totalEarned)}</strong>
          </td>
          <td>
            <div class="salary-advance-group">
              ${advanceDetailsHtml}
            </div>
          </td>
          <td>
            ${actionCellHtml}
          </td>
          <td style="text-align: center;">
            ${statusBadgeHtml}
          </td>
        </tr>
      `;
    }).join('');
    renderLucideIcons(tbody);
  }

  window.saveSalaryPayout = function(driverId) {
    if (currentSession?.role === 'viewer') {
      showToast("Kuzatuvchi rejimida oylik to'lash taqiqlangan!", 'warning');
      return;
    }

    const driver = (appData.drivers || []).find(d => d.id === driverId);
    if (!driver) {
      showToast("Haydovchi topilmadi!", 'error');
      return;
    }

    const monthInput = document.getElementById('salary-payout-month');
    const selectedMonth = monthInput ? (monthInput.value || getTodayString().slice(0, 7)) : getTodayString().slice(0, 7);

    const inputEl = document.getElementById(`payout-input-${driverId}`);
    if (!inputEl) return;

    const enteredAmount = Number(inputEl.value);
    if (isNaN(enteredAmount) || enteredAmount < 0) {
      showToast("Iltimos, to'g'ri summa kiriting!", 'error');
      return;
    }

    const summary = getDriverMonthSummary(driverId, selectedMonth);
    const netSalaryDue = summary.netSalary;
    const difference = enteredAmount - netSalaryDue;

    if (!Array.isArray(appData.salaryPayouts)) {
      appData.salaryPayouts = [];
    }

    const existingIndex = appData.salaryPayouts.findIndex(p => p.driverId === driverId && p.month === selectedMonth);
    const payoutRecord = {
      id: existingIndex >= 0 ? appData.salaryPayouts[existingIndex].id : 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      driverId: driver.id,
      driverName: driver.fullName,
      month: selectedMonth,
      amount: enteredAmount,
      netSalaryDue: netSalaryDue,
      totalEarned: summary.totalEarned,
      totalAdvances: summary.totalAdvances,
      difference: difference,
      date: getTodayString(),
      timestamp: Date.now(),
      paidBy: currentSession?.username || 'Admin'
    };

    if (existingIndex >= 0) {
      appData.salaryPayouts[existingIndex] = payoutRecord;
    } else {
      appData.salaryPayouts.push(payoutRecord);
    }

    DB.save(appData);

    if (difference > 0) {
      showToast(`💵 ${driver.fullName} ga ${formatMoney(enteredAmount)} to'landi. Ortiqcha ${formatMoney(difference)} keyingi oyga avans bo'lib o'tadi!`, 'warning');
    } else if (difference < 0) {
      showToast(`💵 ${driver.fullName} ga ${formatMoney(enteredAmount)} to'landi. Qolgan ${formatMoney(Math.abs(difference))} haq keyingi oyga o'tadi.`, 'info');
    } else {
      showToast(`✅ ${driver.fullName} ga to'liq ${formatMoney(enteredAmount)} oylik to'landi!`, 'success');
    }

    renderAdminSalaryPayoutTable(selectedMonth);
    renderAdminDashboard();
  };

  window.deleteSalaryPayout = function(payoutId) {
    if (currentSession?.role === 'viewer') {
      showToast("Kuzatuvchi rejimida to'lovni o'chirish taqiqlangan!", 'warning');
      return;
    }

    const payout = (appData.salaryPayouts || []).find(p => p.id === payoutId);
    if (!payout) return;

    if (!confirm(`${payout.driverName} ning ${payout.month} oyi uchun kiritilgan ${formatMoney(payout.amount)} oylik to'lovi bekor qilinsinmi?`)) {
      return;
    }

    appData.salaryPayouts = appData.salaryPayouts.filter(p => p.id !== payoutId);
    DB.save(appData);
    showToast("Oylik to'lovi bekor qilindi.", 'info');

    const monthInput = document.getElementById('salary-payout-month');
    const selectedMonth = monthInput ? (monthInput.value || getTodayString().slice(0, 7)) : getTodayString().slice(0, 7);
    renderAdminSalaryPayoutTable(selectedMonth);
    renderAdminDashboard();
  };

  // ================= TAB SWITCHING =================
  window.switchAdminTab = function (tabId) {
    if (!tabId) return;
    if (currentSession?.role === 'viewer' && (tabId === 'tab-advances' || tabId === 'tab-add-driver' || tabId === 'tab-database' || tabId === 'tab-users-management' || tabId === 'tab-salary-payout')) {
      tabId = 'tab-attendance';
    }
    if (currentSession?.role === 'admin' && tabId === 'tab-users-management') {
      tabId = 'tab-attendance';
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.admin-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    const activeTabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (activeTabBtn) {
      activeTabBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    if (tabId === 'tab-trucks') {
      renderAdminTrucksTable();
    } else if (tabId === 'tab-advances') {
      renderAdminAdvancesTable();
      populateAdvanceDriverSelects();
    } else if (tabId === 'tab-salary-payout') {
      renderAdminSalaryPayoutTable();
    } else if (tabId === 'tab-settings') {
      populateViewerSettings();
    } else if (tabId === 'tab-database') {
      renderDevDatabaseTab();
    } else if (tabId === 'tab-users-management') {
      renderUsersManagement();
    } else if (tabId === 'tab-add-driver') {
      const p = document.getElementById('new-driver-phone');
      if (p) {
        if (!p.value || !p.value.startsWith(PHONE_PREFIX)) p.value = PHONE_PREFIX;
        setupPhoneInputMask(p);
      }
    }
  };

  // ================= SUPERADMIN: USERS & ROLES MANAGEMENT =================
  let currentUsersFilter = 'all';
  let revealedPasswordUserIds = new Set();
  let deletingUserTarget = null;

  function renderUsersManagement() {
    const tbody = document.getElementById('superadmin-users-tbody');
    const searchInput = document.getElementById('search-users-input');
    const searchVal = (searchInput ? searchInput.value : '').toLowerCase().trim();

    if (!tbody) return;

    // 1. Gather all users into a unified structure
    const allUsers = [];

    // SuperAdmin (Master)
    const superadmin = appData.superadmin || { username: 'AD2717578', password: '51605055960187', fullName: 'Super Administrator', phone: '' };
    allUsers.push({
      id: 'usr_superadmin',
      role: 'superadmin',
      roleTitle: 'SuperAdmin',
      fullName: superadmin.fullName || 'Super Administrator',
      login: superadmin.username || 'AD2717578',
      password: superadmin.password || '51605055960187',
      phone: superadmin.phone || '',
      monthlySalary: null,
      dailyRate: null,
      status: 'Faol',
      canEdit: true,
      canDelete: false
    });

    // Admin (Bosh Administrator)
    const admin = appData.admin || { username: 'admin123', password: 'admin321', fullName: 'Bosh Administrator', phone: '' };
    allUsers.push({
      id: 'usr_admin',
      role: 'admin',
      roleTitle: 'Administrator',
      fullName: admin.fullName || 'Bosh Administrator',
      login: admin.username || 'admin123',
      password: admin.password || 'admin321',
      phone: admin.phone || '',
      monthlySalary: null,
      dailyRate: null,
      status: 'Faol',
      canEdit: true,
      canDelete: false
    });

    // Viewer (Kuzatuvchi)
    const viewer = appData.viewer || { username: 'Husanboy', password: '20050516', fullName: 'Husanboy Husanboyev', phone: '' };
    const isViewerActive = viewer.username && !viewer.username.startsWith('disabled_');
    if (isViewerActive || currentUsersFilter === 'viewer' || currentUsersFilter === 'all') {
      allUsers.push({
        id: 'usr_viewer',
        role: 'viewer',
        roleTitle: 'Kuzatuvchi',
        fullName: viewer.fullName || viewer.username || 'Husanboy Husanboyev',
        login: viewer.username || 'Husanboy',
        password: viewer.password || '20050516',
        phone: viewer.phone || '',
        monthlySalary: null,
        dailyRate: null,
        status: isViewerActive ? 'Faol' : "O'chirilgan",
        canEdit: isViewerActive,
        canDelete: isViewerActive
      });
    }

    // Drivers
    const todayStr = getTodayString();
    const driversList = (appData.drivers || []).filter(d => {
      const deletedIds = Array.isArray(appData.deletedDriverIds) ? appData.deletedDriverIds : [];
      return d && !deletedIds.includes(d.id);
    });

    driversList.forEach(driver => {
      // Determine today's driver status
      let driverStatus = 'Dam olgan';
      const activeTrip = (appData.attendances || []).find(a => a && a.driverId === driver.id && a.date === todayStr && a.status === 'in_progress');
      const todayShift = (appData.shifts || []).find(s => s && s.driverId === driver.id && s.date === todayStr);

      if (activeTrip) {
        driverStatus = 'Reysda';
      } else if (todayShift && todayShift.status === 'active') {
        driverStatus = 'Kutmoqda (Ishda)';
      } else if (todayShift && todayShift.status === 'completed') {
        driverStatus = 'Ishni yakunlagan';
      }

      const dailyRate = Math.round(Number(driver.monthlySalary || 0) / 25);

      allUsers.push({
        id: driver.id,
        role: 'driver',
        roleTitle: 'Haydovchi',
        fullName: driver.fullName || 'Haydovchi',
        login: driver.login || '',
        password: driver.password || '',
        phone: driver.phone || '',
        monthlySalary: driver.monthlySalary || 0,
        dailyRate: dailyRate,
        status: driverStatus,
        canEdit: true,
        canDelete: true
      });
    });

    // 2. Update KPI Stats
    const totalUsersEl = document.getElementById('superadmin-stat-total-users');
    const totalAdminsEl = document.getElementById('superadmin-stat-total-admins');
    const totalViewersEl = document.getElementById('superadmin-stat-total-viewers');
    const totalDriversEl = document.getElementById('superadmin-stat-total-drivers');

    const adminsCount = allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
    const viewersCount = allUsers.filter(u => u.role === 'viewer' && u.status === 'Faol').length;
    const driversCount = driversList.length;

    if (totalUsersEl) totalUsersEl.textContent = `${allUsers.length} nafar`;
    if (totalAdminsEl) totalAdminsEl.textContent = `${adminsCount} nafar`;
    if (totalViewersEl) totalViewersEl.textContent = `${viewersCount} nafar`;
    if (totalDriversEl) totalDriversEl.textContent = `${driversCount} nafar`;

    // Filter pill count badges
    const pillAll = document.getElementById('count-pill-all');
    const pillAdmin = document.getElementById('count-pill-admin');
    const pillViewer = document.getElementById('count-pill-viewer');
    const pillDriver = document.getElementById('count-pill-driver');

    if (pillAll) pillAll.textContent = allUsers.length;
    if (pillAdmin) pillAdmin.textContent = adminsCount;
    if (pillViewer) pillViewer.textContent = viewersCount;
    if (pillDriver) pillDriver.textContent = driversCount;

    // 3. Filter by role
    let filteredUsers = allUsers;
    if (currentUsersFilter === 'admin') {
      filteredUsers = allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin');
    } else if (currentUsersFilter === 'viewer') {
      filteredUsers = allUsers.filter(u => u.role === 'viewer');
    } else if (currentUsersFilter === 'driver') {
      filteredUsers = allUsers.filter(u => u.role === 'driver');
    }

    // 4. Search query
    if (searchVal) {
      filteredUsers = filteredUsers.filter(u => 
        (u.fullName && u.fullName.toLowerCase().includes(searchVal)) ||
        (u.login && u.login.toLowerCase().includes(searchVal)) ||
        (u.phone && (u.phone.toLowerCase().includes(searchVal) || u.phone.replace(/\s+/g, '').includes(searchVal.replace(/\s+/g, '')))) ||
        (u.roleTitle && u.roleTitle.toLowerCase().includes(searchVal))
      );
    }

    // 5. Render rows
    if (filteredUsers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; padding: 2.5rem; color: var(--text-muted);">
            <i data-lucide="user-x" style="width:2rem; height:2rem; margin-bottom:0.5rem; display:block; opacity:0.4;"></i>
            <span>Qidiruv bo'yicha hech qanday foydalanuvchi topilmadi</span>
          </td>
        </tr>
      `;
      const pagWrap = document.getElementById('users-pagination-wrapper');
      if (pagWrap) pagWrap.innerHTML = '';
      renderLucideIcons(tbody);
      return;
    }

    const totalItems = filteredUsers.length;
    const pagState = paginationState.users;
    const totalPages = Math.max(1, Math.ceil(totalItems / pagState.pageSize));
    if (pagState.page > totalPages) pagState.page = totalPages;
    if (pagState.page < 1) pagState.page = 1;

    const startIndex = (pagState.page - 1) * pagState.pageSize;
    const pageItems = filteredUsers.slice(startIndex, startIndex + pagState.pageSize);

    tbody.innerHTML = pageItems.map((user, idx) => {
      const rowNum = startIndex + idx + 1;
      const isRevealed = revealedPasswordUserIds.has(user.id);
      const displayPassword = isRevealed ? (user.password || '(parol yo\'q)') : '••••••••';
      const eyeIcon = isRevealed ? 'eye-off' : 'eye';

      let statusBadge = `<span class="badge badge-success">${user.status}</span>`;
      if (user.status === 'Reysda') {
        statusBadge = `<span class="badge badge-primary"><i data-lucide="navigation"></i> Reysda</span>`;
      } else if (user.status.includes('Kutmoqda')) {
        statusBadge = `<span class="badge badge-warning"><i data-lucide="clock"></i> Ishda</span>`;
      } else if (user.status === 'Dam olgan') {
        statusBadge = `<span class="badge" style="background:var(--bg-surface-tertiary); color:var(--text-muted);"><i data-lucide="coffee"></i> Dam olgan</span>`;
      } else if (user.status === "O'chirilgan") {
        statusBadge = `<span class="badge badge-danger"><i data-lucide="user-x"></i> O'chirilgan</span>`;
      }

      let roleIcon = 'user';
      if (user.role === 'superadmin') roleIcon = 'crown';
      else if (user.role === 'admin') roleIcon = 'shield-check';
      else if (user.role === 'viewer') roleIcon = 'eye';
      else if (user.role === 'driver') roleIcon = 'truck';

      const hasPhone = user.phone && String(user.phone).replace(/\D/g, '').length >= 9;

      return `
        <tr>
          <td style="font-weight: 700; color: var(--text-muted); text-align: center;">${rowNum}</td>
          <td>
            <div class="user-name-col">
              <div class="user-col-avatar ${user.role}">
                <i data-lucide="${roleIcon}"></i>
              </div>
              <div>
                <div class="user-meta-title" ${user.role === 'driver' ? `onclick="window.openDriverDetailsModal('${escapeHtml(user.id)}')" style="cursor:pointer;" title="Haydovchi profilini ochish"` : ''}>
                  ${escapeHtml(user.fullName)} ${user.role === 'driver' ? '<i data-lucide="external-link" style="width:0.7rem; height:0.7rem; color:var(--primary); margin-left:4px; opacity:0.8;"></i>' : ''}
                </div>
                <div class="user-meta-sub">${user.role === 'superadmin' ? 'Tizim mutlaq egasi' : (user.role === 'driver' ? 'Kompaniya haydovchisi' : 'Ma\'muriyat')}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="role-badge-pill ${user.role}">
              <i data-lucide="${roleIcon}"></i> ${escapeHtml(user.roleTitle)}
            </span>
          </td>
          <td>
            <span class="code-pill">
              <i data-lucide="at-sign" class="text-muted"></i> ${escapeHtml(user.login)}
            </span>
          </td>
          <td>
            <span class="code-pill">
              <i data-lucide="key" class="text-warning"></i>
              <span id="pass-display-${escapeHtml(user.id)}" data-password="${escapeHtml(user.password || '')}">${escapeHtml(displayPassword)}</span>
              <button type="button" class="btn-peek-password" id="btn-peek-${escapeHtml(user.id)}" onclick="window.togglePeekUserPassword('${escapeHtml(user.id)}')" title="Parolni ko'rish/yashirish">
                <i data-lucide="${eyeIcon}"></i>
              </button>
            </span>
          </td>
          <td style="font-weight: 500;">
            ${hasPhone ? `<i data-lucide="phone" class="text-muted" style="width:0.8rem; height:0.8rem; margin-right:4px;"></i> ${escapeHtml(formatPhoneNumber(user.phone))}` : '<span class="text-muted">—</span>'}
          </td>
          <td style="font-weight: 700; color: var(--text-main);">
            ${user.monthlySalary !== null ? `<span class="text-success">${formatMoney(user.monthlySalary)}</span>` : '<span class="text-muted">—</span>'}
          </td>
          <td style="font-weight: 600; color: var(--primary);">
            ${user.dailyRate !== null ? formatMoney(user.dailyRate) : '<span class="text-muted">—</span>'}
          </td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions-cell">
              ${user.canEdit ? `
                <button type="button" class="btn-table-action edit" onclick="window.openEditUserModal('${escapeHtml(user.role)}', '${escapeHtml(user.id)}')" title="Tahrirlash">
                  <i data-lucide="pencil"></i>
                </button>
              ` : ''}
              ${user.canDelete ? `
                <button type="button" class="btn-table-action delete" onclick="window.confirmDeleteUser('${escapeHtml(user.role)}', '${escapeHtml(user.id)}')" title="O'chirish">
                  <i data-lucide="trash-2"></i>
                </button>
              ` : ''}
              ${!user.canDelete && user.role === 'superadmin' ? `
                <span class="badge superadmin-badge" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;">
                  <i data-lucide="crown"></i> Asosiy
                </span>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPaginationControls('users-pagination-wrapper', totalItems, 'users', () => {
      renderUsersManagement();
    });
    renderLucideIcons(tbody);
  }

  window.togglePeekUserPassword = function (userId) {
    if (revealedPasswordUserIds.has(userId)) {
      revealedPasswordUserIds.delete(userId);
    } else {
      revealedPasswordUserIds.add(userId);
    }

    const passSpan = document.getElementById('pass-display-' + userId);
    const peekBtn = document.getElementById('btn-peek-' + userId);

    if (passSpan && peekBtn) {
      const isRevealed = revealedPasswordUserIds.has(userId);
      const rawPassword = passSpan.getAttribute('data-password') || '';
      passSpan.textContent = isRevealed ? (rawPassword || '(parol yo\'q)') : '••••••••';
      peekBtn.innerHTML = isRevealed ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
      renderLucideIcons(peekBtn);
    } else {
      renderUsersManagement();
    }
  };

  window.openEditUserModal = function (role, id) {
    const modal = document.getElementById('modal-edit-user');
    const roleInput = document.getElementById('edit-user-role-val');
    const idInput = document.getElementById('edit-user-id-val');
    const nameInput = document.getElementById('edit-user-fullname');
    const loginInput = document.getElementById('edit-user-login');
    const passInput = document.getElementById('edit-user-password');
    const phoneInput = document.getElementById('edit-user-phone');
    const salaryGroup = document.getElementById('edit-user-salary-group');
    const salaryInput = document.getElementById('edit-user-salary');
    const titleEl = document.getElementById('edit-user-modal-title');
    const subEl = document.getElementById('edit-user-modal-sub');

    if (!modal) return;

    roleInput.value = role;
    idInput.value = id;

    // Reset password visibility in edit modal to 'password'
    if (passInput) passInput.type = 'password';
    const togglePassBtn = document.getElementById('toggle-edit-user-password');
    if (togglePassBtn) {
      togglePassBtn.innerHTML = '<i data-lucide="eye"></i>';
    }

    if (role === 'superadmin') {
      const superadmin = appData.superadmin || { username: 'AD2717578', password: '51605055960187', fullName: 'Super Administrator', phone: '' };
      titleEl.innerHTML = `<i data-lucide="crown" class="text-warning"></i> Super Administrator hisobini tahrirlash`;
      subEl.textContent = `Super Administrator login, parol, ism va telefon raqamini yangilash`;
      nameInput.value = superadmin.fullName || 'Super Administrator';
      loginInput.value = superadmin.username || 'AD2717578';
      passInput.value = superadmin.password || '51605055960187';
      phoneInput.value = superadmin.phone ? formatPhoneNumber(superadmin.phone) : PHONE_PREFIX;
      setupPhoneInputMask(phoneInput);
      if (salaryGroup) salaryGroup.style.display = 'none';
    } else if (role === 'admin') {
      const admin = appData.admin || { username: 'admin123', password: 'admin321', fullName: 'Bosh Administrator', phone: '' };
      titleEl.innerHTML = `<i data-lucide="shield-check" class="text-primary"></i> Administrator hisobini tahrirlash`;
      subEl.textContent = `Bosh Administrator login, parol va telefonini yangilash`;
      nameInput.value = admin.fullName || 'Bosh Administrator';
      loginInput.value = admin.username || 'admin123';
      passInput.value = admin.password || 'admin321';
      phoneInput.value = admin.phone ? formatPhoneNumber(admin.phone) : PHONE_PREFIX;
      setupPhoneInputMask(phoneInput);
      if (salaryGroup) salaryGroup.style.display = 'none';
    } else if (role === 'viewer') {
      const viewer = appData.viewer || { username: 'Husanboy', password: '20050516', fullName: 'Husanboy Husanboyev', phone: '' };
      titleEl.innerHTML = `<i data-lucide="eye" class="text-info"></i> Kuzatuvchi hisobini tahrirlash`;
      subEl.textContent = `Kuzatuvchi login, parol va telefonini yangilash`;
      nameInput.value = viewer.fullName || viewer.username || 'Husanboy Husanboyev';
      loginInput.value = viewer.username || 'Husanboy';
      passInput.value = viewer.password || '20050516';
      phoneInput.value = viewer.phone ? formatPhoneNumber(viewer.phone) : PHONE_PREFIX;
      setupPhoneInputMask(phoneInput);
      if (salaryGroup) salaryGroup.style.display = 'none';
    } else if (role === 'driver') {
      const driver = (appData.drivers || []).find(d => d.id === id);
      if (!driver) {
        showToast("Haydovchi topilmadi!", "danger");
        return;
      }
      titleEl.innerHTML = `<i data-lucide="user-cog" class="text-primary"></i> Haydovchini tahrirlash`;
      subEl.textContent = `${driver.fullName} ma'lumotlari va stavkasini o'zgartirish`;
      nameInput.value = driver.fullName || '';
      loginInput.value = driver.login || '';
      passInput.value = driver.password || '';
      phoneInput.value = formatPhoneNumber(driver.phone || PHONE_PREFIX);
      setupPhoneInputMask(phoneInput);
      salaryInput.value = driver.monthlySalary || 2000000;
      if (salaryGroup) salaryGroup.style.display = 'block';
    }

    modal.style.display = 'flex';
    modal.removeAttribute('aria-hidden');
    renderLucideIcons(modal);
  };

  function handleSaveEditUser(e) {
    if (e) e.preventDefault();
    const role = document.getElementById('edit-user-role-val').value;
    const id = document.getElementById('edit-user-id-val').value;
    const fullName = document.getElementById('edit-user-fullname').value.trim();
    const login = document.getElementById('edit-user-login').value.trim();
    const password = document.getElementById('edit-user-password').value.trim();
    const rawPhone = document.getElementById('edit-user-phone').value.trim();
    const phone = (rawPhone && rawPhone !== PHONE_PREFIX) ? formatPhoneNumber(rawPhone) : '';
    const phoneDigits = phone.replace(/\D/g, '');
    const salary = Number(document.getElementById('edit-user-salary').value) || 0;

    if (!login || !password) {
      showToast("Login va parol bo'sh bo'lishi mumkin emas!", "warning");
      return;
    }

    const loginLower = login.toLowerCase();

    if (role === 'driver') {
      if (phoneDigits.length < 12) {
        showToast("Iltimos, haydovchi telefon raqamini to'liq kiriting: +998 XX XXX XX XX", "danger");
        return;
      }
      const driver = (appData.drivers || []).find(d => d.id === id);
      if (!driver) return;

      const isTaken = (appData.drivers || []).some(d => d.id !== id && (d.login || '').toLowerCase() === loginLower) ||
        (appData.admin && (appData.admin.username || '').toLowerCase() === loginLower) ||
        (appData.superadmin && (appData.superadmin.username || '').toLowerCase() === loginLower) ||
        (appData.viewer && (appData.viewer.username || '').toLowerCase() === loginLower);

      if (isTaken) {
        showToast("Ushbu login tizimda allaqachon band! Boshqa login tanlang.", "danger");
        return;
      }

      driver.fullName = fullName || driver.fullName;
      driver.login = login;
      driver.password = password;
      driver.phone = phone || driver.phone;
      if (salary > 0) {
        driver.monthlySalary = salary;
      }
    } else if (role === 'superadmin') {
      const isTaken = (appData.drivers || []).some(d => (d.login || '').toLowerCase() === loginLower) ||
        (appData.admin && (appData.admin.username || '').toLowerCase() === loginLower && (appData.superadmin?.username || '').toLowerCase() !== loginLower) ||
        (appData.viewer && (appData.viewer.username || '').toLowerCase() === loginLower && (appData.superadmin?.username || '').toLowerCase() !== loginLower);

      if (isTaken) {
        showToast("Ushbu login tizimda allaqachon band! Boshqa login tanlang.", "danger");
        return;
      }

      if (!appData.superadmin) appData.superadmin = {};
      appData.superadmin.username = login;
      appData.superadmin.password = password;
      appData.superadmin.fullName = fullName || 'Super Administrator';
      appData.superadmin.phone = phone;

      // Agar hozir SuperAdmin kirgan bo'lsa, sessiyani ham yangilaymiz
      if (currentSession && currentSession.role === 'superadmin') {
        currentSession.username = login;
        currentSession.fullName = appData.superadmin.fullName;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
        const userNameEl = document.getElementById('header-user-name');
        if (userNameEl) userNameEl.textContent = currentSession.fullName;
      }
    } else if (role === 'admin') {
      const isTaken = (appData.drivers || []).some(d => (d.login || '').toLowerCase() === loginLower) ||
        (appData.superadmin && (appData.superadmin.username || '').toLowerCase() === loginLower && (appData.admin?.username || '').toLowerCase() !== loginLower) ||
        (appData.viewer && (appData.viewer.username || '').toLowerCase() === loginLower && (appData.admin?.username || '').toLowerCase() !== loginLower);

      if (isTaken) {
        showToast("Ushbu login tizimda allaqachon band! Boshqa login tanlang.", "danger");
        return;
      }

      if (!appData.admin) appData.admin = {};
      appData.admin.username = login;
      appData.admin.password = password;
      appData.admin.fullName = fullName || 'Bosh Administrator';
      appData.admin.phone = phone;

      if (currentSession && currentSession.role === 'admin') {
        currentSession.username = login;
        currentSession.fullName = appData.admin.fullName;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
      }
    } else if (role === 'viewer') {
      const isTaken = (appData.drivers || []).some(d => (d.login || '').toLowerCase() === loginLower) ||
        (appData.superadmin && (appData.superadmin.username || '').toLowerCase() === loginLower && (appData.viewer?.username || '').toLowerCase() !== loginLower) ||
        (appData.admin && (appData.admin.username || '').toLowerCase() === loginLower && (appData.viewer?.username || '').toLowerCase() !== loginLower);

      if (isTaken) {
        showToast("Ushbu login tizimda allaqachon band! Boshqa login tanlang.", "danger");
        return;
      }

      if (!appData.viewer) appData.viewer = {};
      appData.viewer.fullName = fullName || 'Kuzatuvchi';
      appData.viewer.username = login;
      appData.viewer.password = password;
      appData.viewer.phone = phone;

      if (currentSession && currentSession.role === 'viewer') {
        currentSession.username = login;
        currentSession.fullName = appData.viewer.fullName;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
      }
    }

    DB.save(appData);

    window.closeEditUserModal();
    renderUsersManagement();
    renderAdminDashboard();
    updateSystemCredentialsDisplay();
    showToast("Foydalanuvchi ma'lumotlari muvaffaqiyatli saqlandi!", "success");
  }

  window.confirmDeleteUser = function (role, id) {
    if (role === 'superadmin') {
      showToast("SuperAdmin hisobini o'chirib bo'lmaydi!", "danger");
      return;
    }

    deletingUserTarget = { role, id };
    const modal = document.getElementById('modal-delete-user-confirm');
    const nameDisp = document.getElementById('delete-user-name-display');
    const roleDisp = document.getElementById('delete-user-role-display');

    let userName = '';
    let roleText = '';

    if (role === 'driver') {
      const driver = (appData.drivers || []).find(d => d.id === id);
      userName = driver ? driver.fullName : 'Haydovchi';
      roleText = 'Haydovchi';
    } else if (role === 'admin') {
      userName = (appData.admin?.fullName || 'Bosh Administrator') + ' (@' + (appData.admin?.username || 'admin123') + ')';
      roleText = 'Administrator';
    } else if (role === 'viewer') {
      userName = (appData.viewer?.fullName || 'Kuzatuvchi') + ' (@' + (appData.viewer?.username || 'Husanboy') + ')';
      roleText = 'Kuzatuvchi';
    }

    if (nameDisp) nameDisp.textContent = userName;
    if (roleDisp) roleDisp.textContent = roleText;

    if (modal) {
      modal.style.display = 'flex';
      modal.removeAttribute('aria-hidden');
      renderLucideIcons(modal);
    }
  };

  function handleConfirmDeleteUser() {
    if (!deletingUserTarget) return;
    const { role, id } = deletingUserTarget;

    if (role === 'driver') {
      if (!Array.isArray(appData.deletedDriverIds)) appData.deletedDriverIds = [];
      if (!appData.deletedDriverIds.includes(id)) {
        appData.deletedDriverIds.push(id);
      }
      appData.drivers = (appData.drivers || []).filter(d => d.id !== id);
      appData.attendances = (appData.attendances || []).filter(a => a.driverId !== id);
      if (appData.advances) {
        appData.advances = appData.advances.filter(a => a.driverId !== id);
      }
      if (appData.shifts) {
        appData.shifts = appData.shifts.filter(s => s.driverId !== id);
      }
      (appData.trucks || []).forEach(t => {
        if (t.assignedDriverId === id) t.assignedDriverId = null;
      });
    } else if (role === 'viewer') {
      appData.viewer = {
        username: 'disabled_' + Date.now(),
        password: '',
        fullName: "O'chirilgan Kuzatuvchi",
        phone: ''
      };
    } else if (role === 'admin') {
      appData.admin = {
        username: 'disabled_admin_' + Date.now(),
        password: '',
        fullName: "O'chirilgan Administrator",
        phone: ''
      };
    }

    DB.save(appData);

    window.closeDeleteUserModal();

    renderUsersManagement();
    renderAdminDashboard();
    updateSystemCredentialsDisplay();
    showToast("Foydalanuvchi tizimdan butunlay o'chirildi!", "success");
  }

  window.closeAddUserModal = function () {
    const modal = document.getElementById('modal-add-user');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  };

  window.closeEditUserModal = function () {
    const modal = document.getElementById('modal-edit-user');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  };

  window.closeDeleteUserModal = function () {
    const modal = document.getElementById('modal-delete-user-confirm');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    deletingUserTarget = null;
  };

  window.openAddUserModal = function () {
    const modal = document.getElementById('modal-add-user');
    const form = document.getElementById('add-user-form');
    if (form) form.reset();

    const addPhone = document.getElementById('add-user-phone');
    if (addPhone) {
      addPhone.value = PHONE_PREFIX;
      setupPhoneInputMask(addPhone);
    }

    const passInput = document.getElementById('add-user-password');
    if (passInput) passInput.type = 'password';
    const togglePassBtn = document.getElementById('toggle-add-user-password');
    if (togglePassBtn) {
      togglePassBtn.innerHTML = '<i data-lucide="eye"></i>';
    }

    const salaryGroup = document.getElementById('add-user-salary-group');
    if (salaryGroup) salaryGroup.style.display = 'block';

    const roleSelect = document.getElementById('add-user-role');
    if (roleSelect) roleSelect.value = 'driver';

    const phoneLabel = document.getElementById('add-user-phone-label');
    if (phoneLabel) phoneLabel.innerHTML = '<i data-lucide="phone"></i> Telefon raqami *';

    if (modal) {
      modal.style.display = 'flex';
      modal.removeAttribute('aria-hidden');
      renderLucideIcons(modal);
    }
  };

  function handleAddUserSubmit(e) {
    if (e) e.preventDefault();
    const role = document.getElementById('add-user-role').value;
    const fullName = document.getElementById('add-user-fullname').value.trim();
    const login = document.getElementById('add-user-login').value.trim();
    const password = document.getElementById('add-user-password').value.trim();
    const rawPhone = document.getElementById('add-user-phone').value.trim();
    const phone = (rawPhone && rawPhone !== PHONE_PREFIX) ? formatPhoneNumber(rawPhone) : '';
    const phoneDigits = phone.replace(/\D/g, '');
    const salary = Number(document.getElementById('add-user-salary').value) || 2000000;

    if (!login || !password || !fullName) {
      showToast("Barcha majburiy maydonlarni to'ldiring!", "warning");
      return;
    }

    if (role === 'driver') {
      if (!rawPhone || rawPhone === PHONE_PREFIX || phoneDigits.length < 12) {
        showToast("Haydovchi telefon raqamini to'liq kiriting: +998 XX XXX XX XX", "danger");
        return;
      }
    }

    const loginLower = login.toLowerCase();
    const isTaken = (appData.drivers || []).some(d => (d.login || '').toLowerCase() === loginLower) ||
      (appData.admin && (appData.admin.username || '').toLowerCase() === loginLower) ||
      (appData.viewer && (appData.viewer.username || '').toLowerCase() === loginLower) ||
      (appData.superadmin && (appData.superadmin.username || '').toLowerCase() === loginLower);

    if (isTaken) {
      showToast("Ushbu login band! Boshqa login kiriting.", "danger");
      return;
    }

    if (role === 'driver') {
      const newDriver = {
        id: 'drv_' + Date.now(),
        fullName,
        phone,
        monthlySalary: salary,
        login,
        password,
        createdAt: new Date().toISOString()
      };
      if (!Array.isArray(appData.drivers)) appData.drivers = [];
      appData.drivers.push(newDriver);
    } else if (role === 'admin') {
      appData.admin = {
        username: login,
        password: password,
        fullName: fullName || 'Bosh Administrator',
        phone: phone || ''
      };
    } else if (role === 'viewer') {
      appData.viewer = {
        username: login,
        password: password,
        fullName: fullName || 'Kuzatuvchi',
        phone: phone || ''
      };
    }

    DB.save(appData);

    window.closeAddUserModal();

    renderUsersManagement();
    renderAdminDashboard();
    updateSystemCredentialsDisplay();
    showToast("Yangi foydalanuvchi hisobi muvaffaqiyatli yaratildi!", "success");
  }

  // ================= DEVELOPER DATABASE SECURITY & LOCKOUT =================
  function getDevSecurityState() {
    try {
      const stored = localStorage.getItem(DEV_LOCKOUT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return {
            failedAttempts: Number(parsed.failedAttempts || 0),
            lockoutCount: Number(parsed.lockoutCount || 0),
            lockedUntil: Number(parsed.lockedUntil || 0)
          };
        }
      }
    } catch (e) {}
    return {
      failedAttempts: 0,
      lockoutCount: 0,
      lockedUntil: 0
    };
  }

  function saveDevSecurityState(state) {
    try {
      localStorage.setItem(DEV_LOCKOUT_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function updateDevLockoutCountdown() {
    const state = getDevSecurityState();
    const countdownEl = document.getElementById('dev-lockout-countdown');
    const dateEl = document.getElementById('dev-lockout-date');
    if (!countdownEl) return;

    const diff = (state.lockedUntil || 0) - Date.now();
    if (diff <= 0) {
      state.lockedUntil = 0;
      state.failedAttempts = 0;
      saveDevSecurityState(state);
      renderDevDatabaseTab();
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let timeStr = "";
    if (days > 0) {
      timeStr = `${days} kun ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    countdownEl.textContent = timeStr;

    if (dateEl) {
      const unlockDate = new Date(state.lockedUntil);
      dateEl.textContent = `Blok ochilish vaqti: ${unlockDate.toLocaleString('uz-UZ', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  function renderDevDatabaseTab() {
    const gate = document.getElementById('dev-auth-gate');
    const content = document.getElementById('dev-database-content');
    const pinInput = document.getElementById('dev-secret-code');
    const lockoutBanner = document.getElementById('dev-lockout-banner');
    const normalBox = document.getElementById('dev-auth-normal-box');
    const attemptsWarning = document.getElementById('dev-attempts-warning');
    const attemptsText = document.getElementById('dev-attempts-text');

    if (isDevUnlocked) {
      if (gate) gate.style.display = 'none';
      if (content) content.style.display = 'block';
      if (devLockoutTimerInterval) {
        clearInterval(devLockoutTimerInterval);
        devLockoutTimerInterval = null;
      }
      return;
    }

    if (gate) gate.style.display = 'block';
    if (content) content.style.display = 'none';

    const state = getDevSecurityState();
    const now = Date.now();

    // Blok vaqti o'tib ketgan bo'lsa yangilash
    if (state.lockedUntil && now >= state.lockedUntil) {
      state.lockedUntil = 0;
      state.failedAttempts = 0;
      saveDevSecurityState(state);
    }

    if (state.lockedUntil && now < state.lockedUntil) {
      // Bo'lim bloklangan
      if (lockoutBanner) lockoutBanner.style.display = 'block';
      if (normalBox) normalBox.style.display = 'none';

      updateDevLockoutCountdown();
      if (!devLockoutTimerInterval) {
        devLockoutTimerInterval = setInterval(updateDevLockoutCountdown, 1000);
      }
    } else {
      // Bo'lim ochiq (kod terish mumkin)
      if (lockoutBanner) lockoutBanner.style.display = 'none';
      if (normalBox) normalBox.style.display = 'block';
      if (devLockoutTimerInterval) {
        clearInterval(devLockoutTimerInterval);
        devLockoutTimerInterval = null;
      }

      if (state.failedAttempts > 0) {
        if (attemptsWarning) attemptsWarning.style.display = 'flex';
        const nextDurationText = (state.lockoutCount || 0) === 0 ? "24 soatga" : "7 kunga";
        if (attemptsText) {
          attemptsText.textContent = `Noto'g'ri urinishlar: ${state.failedAttempts} / 3. Yana ${3 - state.failedAttempts} ta xatodan so'ng bo'lim ${nextDurationText} bloklanadi!`;
        }
      } else {
        if (attemptsWarning) attemptsWarning.style.display = 'none';
      }

      if (pinInput) {
        pinInput.value = '';
        setTimeout(() => {
          try { pinInput.focus(); } catch (err) {}
        }, 80);
      }
    }
  }

  function handleDevAuthSubmit(e) {
    e.preventDefault();
    const pinInput = document.getElementById('dev-secret-code');
    const entered = (pinInput ? pinInput.value : '').trim();

    const state = getDevSecurityState();
    const now = Date.now();

    // Agar bloklangan bo'lsa
    if (state.lockedUntil && now < state.lockedUntil) {
      showToast("Xavfsizlik sababli bo'lim bloklangan! Belgilangan vaqt tugashini kuting.", "danger");
      renderDevDatabaseTab();
      return;
    }

    if (!entered) {
      showToast("Iltimos, maxsus xavfsizlik kodini kiriting!", "warning");
      return;
    }

    if (entered === DEV_SECRET_PIN) {
      // To'g'ri kod!
      state.failedAttempts = 0;
      saveDevSecurityState(state);
      isDevUnlocked = true;
      renderDevDatabaseTab();
      showToast("Dasturchi ruxsati tasdiqlandi! Ma'lumotlar bazasi boshqaruvi ochildi.", "success");
    } else {
      // Noto'g'ri kod!
      state.failedAttempts = (state.failedAttempts || 0) + 1;

      if (state.failedAttempts >= 3) {
        // 3 marta ketma-ket xato: 1-marta 24 soat, 2-marta va keyingi barcha marta 7 kun
        const isFirst = (state.lockoutCount || 0) === 0;
        const lockDuration = isFirst ? DEV_LOCK_24H_MS : DEV_LOCK_7D_MS;
        state.lockedUntil = Date.now() + lockDuration;
        state.lockoutCount = (state.lockoutCount || 0) + 1;
        state.failedAttempts = 0;
        saveDevSecurityState(state);

        if (pinInput) pinInput.value = '';
        renderDevDatabaseTab();

        const durationText = isFirst ? "24 soatga" : "7 kunga";
        showToast(`⛔ 3 marta ketma-ket noto'g'ri kod kiritildi! Ma'lumotlar bazasi ${durationText} bloklandi!`, "danger");
      } else {
        saveDevSecurityState(state);
        const remaining = 3 - state.failedAttempts;
        const nextDurationText = (state.lockoutCount || 0) === 0 ? "24 soatga" : "7 kunga";
        renderDevDatabaseTab();
        showToast(`❌ Maxfiy kod noto'g'ri! Qolgan urinishlar: ${remaining} ta. (Yana ${remaining} ta xatoda bo'lim ${nextDurationText} bloklanadi)`, "danger");
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
      }
    }
  }

  function handleLockDev() {
    isDevUnlocked = false;
    renderDevDatabaseTab();
    showToast("Dasturchi bo'limi muvaffaqiyatli qulflandi", "info");
  }

  function populateViewerSettings() {
    const vLogin = document.getElementById('viewer-self-login');
    const vPass = document.getElementById('viewer-self-password');
    const vConfirm = document.getElementById('viewer-self-confirm-password');
    const vSecret = document.getElementById('viewer-secret-code');
    const viewer = appData.viewer || {};
    if (vLogin) vLogin.value = viewer.username || 'Husanboy';
    if (vPass) vPass.value = viewer.password || '20050516';
    if (vConfirm) vConfirm.value = viewer.password || '20050516';
    if (vSecret) vSecret.value = '';
  }

  function handleSaveViewerSelfSettings(e) {
    e.preventDefault();
    const newLogin = document.getElementById('viewer-self-login').value.trim();
    const newPass = document.getElementById('viewer-self-password').value;
    const confirmPass = document.getElementById('viewer-self-confirm-password').value;
    const secretCodeInput = document.getElementById('viewer-secret-code');
    const secretCode = (secretCodeInput ? secretCodeInput.value : '').trim();

    if (!newLogin) {
      showToast("Kuzatuvchi loginini kiriting!", 'warning');
      return;
    }

    if (newLogin.length < 3) {
      showToast("Login kamida 3 ta belgidan iborat bo'lishi kerak!", 'warning');
      return;
    }

    if (appData.admin && newLogin.toLowerCase() === appData.admin.username.toLowerCase()) {
      showToast("Ushbu login band! Administrator logini bilan bir xil bo'lishi mumkin emas.", 'danger');
      return;
    }

    if (!newPass) {
      showToast("Yangi parolni kiriting!", 'warning');
      return;
    }

    if (newPass.length < 4) {
      showToast("Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak!", 'warning');
      return;
    }

    if (newPass !== confirmPass) {
      showToast("Yangi parol va tasdiqlash paroli mos kelmadi!", 'danger');
      return;
    }

    // Maxfiy tasdiqlash kodi tekshiruvi (51605055960187)
    if (!secretCode) {
      showToast("Login va parolni o'zgartirish uchun maxfiy kodni kiriting!", 'warning');
      if (secretCodeInput) secretCodeInput.focus();
      return;
    }

    const REQUIRED_VIEWER_SECRET = '51605055960187';
    if (secretCode !== REQUIRED_VIEWER_SECRET) {
      showToast("Maxfiy kod noto'g'ri! Login va parolni o'zgartirish rad etildi.", 'danger');
      if (secretCodeInput) {
        secretCodeInput.value = '';
        secretCodeInput.focus();
      }
      return;
    }

    appData.viewer = {
      username: newLogin,
      password: newPass
    };

    DB.save(appData);

    if (currentSession && currentSession.role === 'viewer') {
      currentSession.username = newLogin;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
      const userNameEl = document.getElementById('header-user-name');
      if (userNameEl) userNameEl.textContent = newLogin;
    }

    if (secretCodeInput) secretCodeInput.value = '';

    updateSystemCredentialsDisplay();
    showToast("Kuzatuvchi login va paroli muvaffaqiyatli saqlandi!", 'success');
  }

  // ================= AUTH FORM SUBMISSION =================
  function handleLoginSubmit(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value.trim();

    if (!usernameInput || !passwordInput) {
      showToast("Login va parolni kiriting!", 'warning');
      return;
    }

    // 0. Check SuperAdministrator (Highest authority)
    const superadminData = appData.superadmin || { username: 'AD2717578', password: '51605055960187' };
    const superadminUser = (superadminData.username || 'AD2717578').trim().toLowerCase();
    const isSuperAdminUser = usernameInput.trim().toLowerCase() === superadminUser;

    if (isSuperAdminUser) {
      if (passwordInput === superadminData.password) {
        showToast("Xush kelibsiz, Super Administrator!", 'success');
        setSession({
          role: 'superadmin',
          username: superadminData.username,
          fullName: 'Super Administrator'
        });
        return;
      } else {
        showToast("SuperAdmin paroli noto'g'ri!", 'danger');
        return;
      }
    }

    // 1. Check Admin
    if (usernameInput.toLowerCase() === appData.admin.username.toLowerCase()) {
      if (passwordInput === appData.admin.password) {
        showToast("Xush kelibsiz, Bosh Administrator!", 'success');
        setSession({
          role: 'admin',
          username: appData.admin.username
        });
        return;
      } else {
        showToast("Admin paroli noto'g'ri!", 'danger');
        return;
      }
    }

    // 2. Check Kuzatuvchi (Viewer / Monitoring - Faqat ko'rish)
    const viewerData = appData.viewer || { username: 'Husanboy', password: '20050516' };
    const viewerUser = (viewerData.username || 'Husanboy').toLowerCase();
    const isViewerUser = usernameInput.toLowerCase() === viewerUser;
    if (isViewerUser) {
      if (passwordInput === viewerData.password) {
        showToast("Xush kelibsiz, Kuzatuvchi (Monitoring)! Barcha ma'lumotlar to'liq ko'rinadi.", 'info');
        setSession({
          role: 'viewer',
          username: viewerData.username || 'Husanboy',
          fullName: "Kuzatuvchi (Monitoring)"
        });
        return;
      } else {
        showToast("Kuzatuvchi paroli noto'g'ri!", 'danger');
        return;
      }
    }

    // 3. Check Driver
    const driver = appData.drivers.find(d => 
      d.login.toLowerCase() === usernameInput.toLowerCase() && d.password === passwordInput
    );

    if (driver) {
      showToast(`Xush kelibsiz, ${driver.fullName}!`, 'success');
      setSession({
        role: 'driver',
        driverId: driver.id
      });
      return;
    }

    // If neither
    showToast("Login yoki parol noto'g'ri!", 'danger');
  }

  // ================= INITIALIZATION & EVENT LISTENERS =================
  function initEvents() {
    // Lucide initialization and observer
    initLucideAutoObserver();
    renderLucideIcons();

    // Telefon va davlat raqamlari maskalashini ishga tushirish
    initAllPhoneInputMasks();
    initAllPlateInputMasks();

    // Theme setup (Dark / Light)
    ThemeManager.init();
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => ThemeManager.toggle());
    }

    // Clock
    initClock();

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

    // Toggle password visibility
    const togglePassBtn = document.getElementById('toggle-password-btn');
    if (togglePassBtn) {
      togglePassBtn.addEventListener('click', () => {
        const passInput = document.getElementById('login-password');
        if (passInput) {
          const isPass = passInput.type === 'password';
          passInput.type = isPass ? 'text' : 'password';
          togglePassBtn.innerHTML = isPass ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
          renderLucideIcons(togglePassBtn);
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Swap Route button (Namangan ⇄ Farg'ona)
    const swapRouteBtn = document.getElementById('btn-swap-regions');
    if (swapRouteBtn) {
      swapRouteBtn.addEventListener('click', () => {
        const fromSel = document.getElementById('driver-trip-from');
        const toSel = document.getElementById('driver-trip-to');
        if (fromSel && toSel) {
          const temp = fromSel.value;
          fromSel.value = toSel.value;
          toSel.value = temp;
          if (typeof window.updateRouteDistancePreview === 'function') {
            window.updateRouteDistancePreview();
          }
          showToast(`Yo'nalish almashtirildi: ${fromSel.value} ➔ ${toSel.value}`, 'info');
        }
      });
    }

    // Direct event listeners on region select dropdowns
    const fromSelGlobal = document.getElementById('driver-trip-from');
    const toSelGlobal = document.getElementById('driver-trip-to');
    if (fromSelGlobal) {
      fromSelGlobal.addEventListener('change', () => {
        if (typeof window.updateRouteDistancePreview === 'function') window.updateRouteDistancePreview();
      });
      fromSelGlobal.addEventListener('input', () => {
        if (typeof window.updateRouteDistancePreview === 'function') window.updateRouteDistancePreview();
      });
    }
    if (toSelGlobal) {
      toSelGlobal.addEventListener('change', () => {
        if (typeof window.updateRouteDistancePreview === 'function') window.updateRouteDistancePreview();
      });
      toSelGlobal.addEventListener('input', () => {
        if (typeof window.updateRouteDistancePreview === 'function') window.updateRouteDistancePreview();
      });
    }

    // Driver action buttons
    const btnStartShift = document.getElementById('btn-start-shift');
    const btnStartTrip = document.getElementById('btn-start-trip');
    const btnFinishTrip = document.getElementById('btn-finish-trip');
    const btnEndShift = document.getElementById('btn-end-shift');

    if (btnStartShift) btnStartShift.addEventListener('click', handleStartShift);
    if (btnStartTrip) btnStartTrip.addEventListener('click', handleDriverCheckIn);
    if (btnFinishTrip) btnFinishTrip.addEventListener('click', handleDriverCheckOut);
    if (btnEndShift) btnEndShift.addEventListener('click', handleEndShift);

    // Fallback for legacy IDs
    const btnCheckin = document.getElementById('btn-checkin');
    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckin) btnCheckin.addEventListener('click', handleDriverCheckIn);
    if (btnCheckout) btnCheckout.addEventListener('click', handleDriverCheckOut);

    // Admin Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tab) {
          window.switchAdminTab(btn.dataset.tab);
        }
      });
    });

    // Add Driver Form
    const addDriverForm = document.getElementById('add-driver-form');
    if (addDriverForm) addDriverForm.addEventListener('submit', handleAddDriver);

    // Add Truck Form
    const addTruckForm = document.getElementById('add-truck-form');
    if (addTruckForm) addTruckForm.addEventListener('submit', handleAddTruck);

    // Give Advance Form (Tab 4 - Faqat Avanslar bo'limida)
    const giveAdvanceForm = document.getElementById('give-advance-form');
    if (giveAdvanceForm) giveAdvanceForm.addEventListener('submit', handleGiveAdvance);

    // Salary preview in Add Driver Form
    const salaryInput = document.getElementById('new-driver-salary');
    const salaryHint = document.getElementById('salary-preview-hint');
    if (salaryInput && salaryHint) {
      salaryInput.addEventListener('input', () => {
        const val = Number(salaryInput.value);
        if (val > 0) {
          const rate = calculateDailyRate(val);
          salaryHint.textContent = `Kunlik stavka taxminan: ${formatMoney(rate)} / kun`;
        } else {
          salaryHint.textContent = 'Kunlik stavka taxminan: 0 so\'m / kun';
        }
      });
    }

    // Admin Change Password Form
    const changePassForm = document.getElementById('change-admin-password-form');
    if (changePassForm) changePassForm.addEventListener('submit', handleChangeAdminPassword);

    // Excel Export
    const exportBtn = document.getElementById('btn-export-excel');
    if (exportBtn) exportBtn.addEventListener('click', exportAttendanceToExcel);

    // Attendance Filter & Search
    const monthFilter = document.getElementById('filter-month');
    if (monthFilter) {
      monthFilter.addEventListener('change', () => {
        paginationState.attendance.page = 1;
        renderAdminDashboard();
      });
    }

    const searchInput = document.getElementById('search-attendance');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        paginationState.attendance.page = 1;
        renderAdminAttendanceTable(monthFilter ? monthFilter.value : getTodayString().slice(0, 7));
      });
    }

    // Quick Attendance Filter Chips
    const filterChips = document.querySelectorAll('#attendance-filter-chips .filter-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentAttendanceFilter = chip.dataset.filter || 'all';
        paginationState.attendance.page = 1;
        const mVal = monthFilter ? monthFilter.value : getTodayString().slice(0, 7);
        renderAdminAttendanceTable(mVal);
      });
    });

    // Backup & Reset
    const btnBackup = document.getElementById('btn-export-backup');
    if (btnBackup) {
      btnBackup.addEventListener('click', () => {
        const jsonStr = JSON.stringify(appData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LogistPay_Backup_${getTodayString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Zaxira nusxasi (JSON) yuklab olindi", 'info');
      });
    }

    // Zaxirani qayta tiklash (Import Backup JSON)
    const btnImport = document.getElementById('btn-import-backup');
    const inputImport = document.getElementById('input-import-backup');
    if (btnImport && inputImport) {
      btnImport.addEventListener('click', () => {
        if (currentSession?.role === 'viewer') {
          showToast("Kuzatuvchi rejimida zaxirani tiklash taqiqlangan!", 'warning');
          return;
        }
        inputImport.click();
      });

      inputImport.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
          try {
            const imported = JSON.parse(evt.target.result);
            if (!imported || typeof imported !== 'object') {
              throw new Error("Noto'g'ri JSON fayl formati");
            }

            if (!Array.isArray(imported.drivers) && !Array.isArray(imported.trucks)) {
              throw new Error("Fayl ichida LogistPay ma'lumotlari topilmadi");
            }

            const driverCount = imported.drivers ? imported.drivers.length : 0;
            const truckCount = imported.trucks ? imported.trucks.length : 0;
            const tripCount = imported.attendances ? imported.attendances.length : 0;

            if (!confirm(`Zaxira fayli aniqlandi:\n\n• Haydovchilar: ${driverCount} nafar\n• Mashinalar: ${truckCount} ta\n• Reyslar: ${tripCount} ta\n\nUshbu ma'lumotlarni joriy tizim va Firebase bazasiga tiklashni tasdiqlaysizmi?`)) {
              inputImport.value = '';
              return;
            }

            imported.deletedDriverIds = Array.isArray(imported.deletedDriverIds) ? imported.deletedDriverIds : [];
            imported.deletedTruckIds = Array.isArray(imported.deletedTruckIds) ? imported.deletedTruckIds : [];
            imported.drivers = Array.isArray(imported.drivers) ? imported.drivers : [];
            imported.trucks = Array.isArray(imported.trucks) ? imported.trucks : [];
            imported.attendances = Array.isArray(imported.attendances) ? imported.attendances : [];
            imported.shifts = Array.isArray(imported.shifts) ? imported.shifts : [];
            imported.advances = Array.isArray(imported.advances) ? imported.advances : [];
            imported.salaryPayouts = Array.isArray(imported.salaryPayouts) ? imported.salaryPayouts : [];

            appData = imported;
            DB.save(appData);
            showToast("Zaxira nusxasi muvaffaqiyatli tiklandi va Firebase ga saqlandi!", 'success');
            renderAdminDashboard();
          } catch (err) {
            console.error("Import xatosi:", err);
            showToast("Zaxira faylini o'qishda xatolik: " + err.message, 'danger');
          } finally {
            inputImport.value = '';
          }
        };
        reader.readAsText(file);
      });
    }

    const btnReset = document.getElementById('btn-reset-demo');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (currentSession?.role === 'viewer') {
          showToast("Kuzatuvchi rejimida tizimni qayta tiklash taqiqlangan!", 'warning');
          return;
        }
        const confirmWord = prompt(
          "⚠️ DIQQAT! Barcha kiritilgan haydovchilar, mashinalar va reyslar ma'lumotlari butunlay o'chib ketadi!\n\n" +
          "Haqiqatdan ham boshlang'ich holatga qaytarmoqchi bo'lsangiz, tasdiqlash uchun 'TOZALASH' so'zini yozing:"
        );
        if (confirmWord === 'TOZALASH') {
          appData = DB.reset();
          showToast("Ma'lumotlar bazasi boshlang'ich holatga qaytarildi", 'info');
          renderAdminDashboard();
        } else if (confirmWord !== null) {
          showToast("Noto'g'ri so'z kiritildi. Baza o'zgarishsiz qoldi.", 'warning');
        }
      });
    }

    // Salary Payout Events
    const salaryMonthInput = document.getElementById('salary-payout-month');
    if (salaryMonthInput) {
      salaryMonthInput.addEventListener('change', () => {
        renderAdminSalaryPayoutTable(salaryMonthInput.value);
      });
    }

    const btnRefreshSalary = document.getElementById('btn-refresh-salary-payout');
    if (btnRefreshSalary) {
      btnRefreshSalary.addEventListener('click', () => {
        const m = salaryMonthInput ? salaryMonthInput.value : null;
        renderAdminSalaryPayoutTable(m);
        showToast("Oylik jadvali yangilandi", 'info');
      });
    }

    const searchSalaryDriver = document.getElementById('search-salary-driver');
    if (searchSalaryDriver) {
      searchSalaryDriver.addEventListener('input', () => {
        const m = salaryMonthInput ? salaryMonthInput.value : null;
        renderAdminSalaryPayoutTable(m);
      });
    }

    // Driver details modal close events
    const btnCloseModal = document.getElementById('btn-close-driver-modal');
    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => window.closeDriverDetailsModal());
    }

    const btnCloseModalFooter = document.getElementById('btn-modal-close-footer');
    if (btnCloseModalFooter) {
      btnCloseModalFooter.addEventListener('click', () => window.closeDriverDetailsModal());
    }

    const modalOverlay = document.getElementById('driver-details-modal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          window.closeDriverDetailsModal();
        }
      });
    }

    // Quick advance modal overlay close
    const quickModalOverlay = document.getElementById('quick-advance-modal');
    if (quickModalOverlay) {
      quickModalOverlay.addEventListener('click', (e) => {
        if (e.target === quickModalOverlay) {
          window.closeQuickAdvanceModal();
        }
      });
    }

    // Technical Support & Developer Branding Modal Events
    ['btn-header-support', 'btn-login-support'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => window.openTechSupportModal());
      }
    });

    ['btn-close-support-modal', 'btn-close-support-footer'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => window.closeTechSupportModal());
      }
    });

    const supportOverlay = document.getElementById('tech-support-modal');
    if (supportOverlay) {
      supportOverlay.addEventListener('click', (e) => {
        if (e.target === supportOverlay) {
          window.closeTechSupportModal();
        }
      });
    }

    // Haydovchilar reytingi Modal Events (Driver, Admin, SuperAdmin)
    ['driver-ranking-card', 'admin-ranking-card', 'btn-open-ranking-tab'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => window.openDriverRankingModal());
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.openDriverRankingModal();
          }
        });
      }
    });

    ['btn-close-ranking-modal', 'btn-close-ranking-modal-footer'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => window.closeDriverRankingModal());
      }
    });

    const rankingOverlay = document.getElementById('driver-ranking-modal');
    if (rankingOverlay) {
      rankingOverlay.addEventListener('click', (e) => {
        if (e.target === rankingOverlay) {
          window.closeDriverRankingModal();
        }
      });
    }

    const rankingTruckSelect = document.getElementById('ranking-truck-select');
    if (rankingTruckSelect) {
      rankingTruckSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const autoHint = document.getElementById('ranking-auto-hint');
        if (autoHint) {
          if (val === 'all') {
            autoHint.innerHTML = `<i data-lucide="truck"></i> Barcha mashinalar (Umumiy)`;
          } else {
            autoHint.innerHTML = `<i data-lucide="filter"></i> Tanlangan fura`;
          }
          autoHint.style.display = 'inline-flex';
        }
        const monthInput = document.getElementById('filter-month');
        const selectedMonth = (monthInput && monthInput.value) ? monthInput.value : getTodayString().slice(0, 7);
        window.renderDriverRankingData(val, selectedMonth);
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeDriverDetailsModal();
        window.closeQuickAdvanceModal();
        window.closeTechSupportModal();
        window.closeDriverRankingModal();
        if (typeof window.closeAddUserModal === 'function') window.closeAddUserModal();
        if (typeof window.closeEditUserModal === 'function') window.closeEditUserModal();
        if (typeof window.closeDeleteUserModal === 'function') window.closeDeleteUserModal();
      }
    });

    // Firebase Cloud Config form submit
    const firebaseForm = document.getElementById('firebase-config-form');
    if (firebaseForm) {
      firebaseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (currentSession?.role === 'viewer') {
          showToast("Kuzatuvchi rejimida bulut sozlamalarini o'zgartirish taqiqlangan!", 'warning');
          return;
        }
        const rawJson = document.getElementById('firebase-config-json').value.trim();
        if (!rawJson) {
          showToast("Iltimos, Firebase Config ma'lumotlarini kiriting!", "warning");
          return;
        }

        let parsed = null;
        try {
          parsed = JSON.parse(rawJson);
        } catch (err) {
          try {
            const cleaned = rawJson
              .replace(/(?:const|var|let)\s+[a-zA-Z0-9_$]+\s*=\s*/, '')
              .replace(/;+\s*$/, '');
            const extractKey = (k) => {
              const m = cleaned.match(new RegExp(`['"]?${k}['"]?\\s*:\\s*['"]([^'"]+)['"]`));
              return m ? m[1] : '';
            };
            parsed = {
              apiKey: extractKey('apiKey'),
              authDomain: extractKey('authDomain'),
              projectId: extractKey('projectId'),
              storageBucket: extractKey('storageBucket'),
              messagingSenderId: extractKey('messagingSenderId'),
              appId: extractKey('appId')
            };
          } catch (e2) {}
        }

        if (!parsed || !parsed.apiKey || !parsed.projectId) {
          showToast("Firebase Config formati noto'g'ri! 'apiKey' va 'projectId' mavjudligini tekshiring.", "danger");
          return;
        }

        window.FIREBASE_CONFIG = parsed;
        localStorage.setItem('logistpay_firebase_config', JSON.stringify(parsed));
        showToast("Firebase sozlamalari saqlandi! Ulanish amalga oshirilmoqda...", "info");
        DB.initCloud();
      });
    }

    const btnSyncCloud = document.getElementById('btn-sync-to-cloud');
    if (btnSyncCloud) {
      btnSyncCloud.addEventListener('click', () => {
        if (currentSession?.role === 'viewer') {
          showToast("Kuzatuvchi rejimida bulutga yuklash taqiqlangan!", 'warning');
          return;
        }
        DB.syncToCloudNow();
      });
    }

    const btnDisconnectCloud = document.getElementById('btn-disconnect-firebase');
    if (btnDisconnectCloud) {
      btnDisconnectCloud.addEventListener('click', () => {
        if (currentSession?.role === 'viewer') {
          showToast("Kuzatuvchi rejimida ulanishni uzish taqiqlangan!", 'warning');
          return;
        }
        if (confirm("Haqiqatdan ham Firebase ulanishini uzmoqchimisiz?")) {
          DB.disconnectCloud();
        }
      });
    }

    // Populate textarea if config exists
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId) {
      const cfgTextarea = document.getElementById('firebase-config-json');
      if (cfgTextarea && !cfgTextarea.value) {
        cfgTextarea.value = JSON.stringify(window.FIREBASE_CONFIG, null, 2);
      }
    }

    // Initialize Cloud connection if configured
    DB.initCloud();

    // Kuzatuvchi Self Settings Form
    const viewerSelfForm = document.getElementById('viewer-self-settings-form');
    if (viewerSelfForm) {
      viewerSelfForm.addEventListener('submit', handleSaveViewerSelfSettings);
    }

    // Password toggles for viewer settings
    const toggleViewerPass = document.getElementById('toggle-viewer-self-pass');
    if (toggleViewerPass) {
      toggleViewerPass.addEventListener('click', () => {
        const passInput = document.getElementById('viewer-self-password');
        if (passInput) {
          const isPass = passInput.type === 'password';
          passInput.type = isPass ? 'text' : 'password';
          toggleViewerPass.innerHTML = isPass ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
          renderLucideIcons(toggleViewerPass);
        }
      });
    }

    const toggleViewerConfirm = document.getElementById('toggle-viewer-self-confirm');
    if (toggleViewerConfirm) {
      toggleViewerConfirm.addEventListener('click', () => {
        const passInput = document.getElementById('viewer-self-confirm-password');
        if (passInput) {
          const isPass = passInput.type === 'password';
          passInput.type = isPass ? 'text' : 'password';
          toggleViewerConfirm.innerHTML = isPass ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
          renderLucideIcons(toggleViewerConfirm);
        }
      });
    }

    const toggleViewerSecret = document.getElementById('toggle-viewer-secret-code');
    if (toggleViewerSecret) {
      toggleViewerSecret.addEventListener('click', () => {
        const passInput = document.getElementById('viewer-secret-code');
        if (passInput) {
          const isPass = passInput.type === 'password';
          passInput.type = isPass ? 'text' : 'password';
          toggleViewerSecret.innerHTML = isPass ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
          renderLucideIcons(toggleViewerSecret);
        }
      });
    }

    // Pre-populate viewer fields if on settings
    populateViewerSettings();

    // Developer Database PIN Gate Listeners
    const devAuthForm = document.getElementById('dev-auth-form');
    if (devAuthForm) {
      devAuthForm.addEventListener('submit', handleDevAuthSubmit);
    }

    const btnLockDev = document.getElementById('btn-lock-dev');
    if (btnLockDev) {
      btnLockDev.addEventListener('click', handleLockDev);
    }

    const toggleDevCode = document.getElementById('toggle-dev-secret-code');
    if (toggleDevCode) {
      toggleDevCode.addEventListener('click', () => {
        const pinInput = document.getElementById('dev-secret-code');
        if (pinInput) {
          const isPass = pinInput.type === 'password';
          pinInput.type = isPass ? 'text' : 'password';
          toggleDevCode.innerHTML = isPass ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
          renderLucideIcons(toggleDevCode);
        }
      });
    }

    // SuperAdmin Users & Roles Management Listeners
    document.querySelectorAll('.role-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.role-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentUsersFilter = pill.dataset.filter || 'all';
        paginationState.users.page = 1;
        renderUsersManagement();
      });
    });

    const searchUsersInput = document.getElementById('search-users-input');
    if (searchUsersInput) {
      searchUsersInput.addEventListener('input', () => {
        paginationState.users.page = 1;
        renderUsersManagement();
      });
    }

    const btnOpenAddUser = document.getElementById('btn-open-add-user-modal');
    if (btnOpenAddUser) {
      btnOpenAddUser.addEventListener('click', window.openAddUserModal);
    }

    const editUserForm = document.getElementById('edit-user-form');
    if (editUserForm) {
      editUserForm.addEventListener('submit', handleSaveEditUser);
    }

    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) {
      addUserForm.addEventListener('submit', handleAddUserSubmit);
    }

    const confirmDeleteBtn = document.getElementById('btn-confirm-delete-user');
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', handleConfirmDeleteUser);
    }

    // Modal close & cancel buttons
    const btnCloseEditModal = document.getElementById('btn-close-edit-user-modal');
    const btnCancelEditUser = document.getElementById('btn-cancel-edit-user');
    if (btnCloseEditModal) {
      btnCloseEditModal.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        window.closeEditUserModal();
      });
    }
    if (btnCancelEditUser) {
      btnCancelEditUser.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        window.closeEditUserModal();
      });
    }

    const editUserModalOverlay = document.getElementById('modal-edit-user');
    if (editUserModalOverlay) {
      editUserModalOverlay.addEventListener('click', (e) => {
        if (e.target === editUserModalOverlay) {
          window.closeEditUserModal();
        }
      });
    }

    const btnCloseAddModal = document.getElementById('btn-close-add-user-modal');
    const btnCancelAddUser = document.getElementById('btn-cancel-add-user');
    if (btnCloseAddModal) {
      btnCloseAddModal.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        window.closeAddUserModal();
      });
    }
    if (btnCancelAddUser) {
      btnCancelAddUser.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        window.closeAddUserModal();
      });
    }

    const addUserModalOverlay = document.getElementById('modal-add-user');
    if (addUserModalOverlay) {
      addUserModalOverlay.addEventListener('click', (e) => {
        if (e.target === addUserModalOverlay) {
          window.closeAddUserModal();
        }
      });
    }

    const btnCloseDeleteModal = document.getElementById('btn-close-delete-user-modal');
    const btnCancelDeleteUser = document.getElementById('btn-cancel-delete-user');
    if (btnCloseDeleteModal) {
      btnCloseDeleteModal.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        window.closeDeleteUserModal();
      });
    }
    if (btnCancelDeleteUser) {
      btnCancelDeleteUser.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        window.closeDeleteUserModal();
      });
    }

    const deleteUserModalOverlay = document.getElementById('modal-delete-user-confirm');
    if (deleteUserModalOverlay) {
      deleteUserModalOverlay.addEventListener('click', (e) => {
        if (e.target === deleteUserModalOverlay) {
          window.closeDeleteUserModal();
        }
      });
    }

    // Add user role select change (toggle salary field and phone requirement)
    const addUserRoleSelect = document.getElementById('add-user-role');
    if (addUserRoleSelect) {
      addUserRoleSelect.addEventListener('change', () => {
        const isDriver = addUserRoleSelect.value === 'driver';
        const salGroup = document.getElementById('add-user-salary-group');
        if (salGroup) {
          salGroup.style.display = isDriver ? 'block' : 'none';
        }
        const phoneLabel = document.getElementById('add-user-phone-label');
        if (phoneLabel) {
          phoneLabel.innerHTML = isDriver ? '<i data-lucide="phone"></i> Telefon raqami *' : '<i data-lucide="phone"></i> Telefon raqami (ixtiyoriy)';
          renderLucideIcons(phoneLabel);
        }
      });
    }

    // Modal password visibility toggles
    const toggleEditPassBtn = document.getElementById('toggle-edit-user-password');
    if (toggleEditPassBtn) {
      toggleEditPassBtn.addEventListener('click', () => {
        const passInp = document.getElementById('edit-user-password');
        if (passInp) {
          const isPass = passInp.type === 'password';
          passInp.type = isPass ? 'text' : 'password';
          toggleEditPassBtn.innerHTML = isPass ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
          renderLucideIcons(toggleEditPassBtn);
        }
      });
    }

    const toggleAddPassBtn = document.getElementById('toggle-add-user-password');
    if (toggleAddPassBtn) {
      toggleAddPassBtn.addEventListener('click', () => {
        const passInp = document.getElementById('add-user-password');
        if (passInp) {
          const isPass = passInp.type === 'password';
          passInp.type = isPass ? 'text' : 'password';
          toggleAddPassBtn.innerHTML = isPass ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
          renderLucideIcons(toggleAddPassBtn);
        }
      });
    }

    // Check existing session on load
    checkExistingSession();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEvents);
  } else {
    initEvents();
  }

  // ================= PWA SERVICE WORKER REGISTRATION =================
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      // updateViaCache: 'none' forces browser to always check server for sw.js without HTTP cache
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
        reg.update().catch(() => {});
      }).catch((err) => {
        console.warn('SW registration notice:', err);
      });
    });

    // Auto-reload seamlessly once when a new Service Worker takes control
    let isReloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!isReloading) {
        isReloading = true;
        window.location.reload();
      }
    });
  }

})();
