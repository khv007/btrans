/**
 * BOURKHAN TRANS - FIREBASE CLOUD DATABASE SOZLAMALARI
 * =========================================================================
 * Barcha IP manzillar, kompyuterlar va haydovchilarning telefonlari
 * bitta umumiy internet bazasiga ulanishi uchun ushbu konfiguratsiya ishlatiladi.
 * =========================================================================
 */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBg0_2Nu4Nh-x0VySPhtuh1i4KFSnJ8Pkg",
  authDomain: "bourkhantrans-461df.firebaseapp.com",
  projectId: "bourkhantrans-461df",
  storageBucket: "bourkhantrans-461df.firebasestorage.app",
  messagingSenderId: "787870716249",
  appId: "1:787870716249:web:c2607929a3e930b6cd3c48",
  measurementId: "G-7RV3M4B3M9"
};

// Agar admin panelining o'zidan kiritilib saqlangan bo'lsa, o'shani yuklab oladi
(function () {
  try {
    const saved = localStorage.getItem('logistpay_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.projectId && parsed.apiKey) {
        window.FIREBASE_CONFIG = parsed;
      }
    }
  } catch (e) {
    console.error('Firebase config yuklashda xatolik:', e);
  }
})();
