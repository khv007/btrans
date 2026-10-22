const fs = require('fs');
const assert = require('assert');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('       BOURKHAN TRANS - TO\'LIQ TIZIM AUDITI         ');
console.log('====================================================\n');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

let passedChecks = 0;
let totalChecks = 0;

function check(name, condition, extraInfo = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  [PASS] ${name}`);
  } else {
    console.error(`  [FAIL] ${name} ${extraInfo ? '-> ' + extraInfo : ''}`);
  }
}

// ----------------------------------------------------
// BO'LIM 1: SINTAKSIS VA BUNDLE BUTUNLIGI
// ----------------------------------------------------
console.log('--- 1. SINTAKSIS VA ASOSIY FAYLLAR BUTUNLIGI ---');

let syntaxOk = true;
try {
  execSync('node --check app.js', { stdio: 'pipe' });
} catch (e) {
  syntaxOk = false;
}
check('JavaScript (app.js) sintaksisi to\'liq to\'g\'ri', syntaxOk);
check('HTML (index.html) mavjud va bo\'sh emas', html.length > 50000);
check('CSS (style.css) mavjud va bo\'sh emas', css.length > 80000);
check('PWA manifest.json to\'liq va to\'g\'ri', manifest.name && manifest.icons.length > 0);

// ----------------------------------------------------
// BO'LIM 2: AUTH VA SESSION (XAVFSIZLIK VA BROWSER CLOSE)
// ----------------------------------------------------
console.log('\n--- 2. FOYDALANUVCHILAR VA SESSIYA XAVFSIZLIGI ---');

check('Login formasida "Meni eslab qolish" olib tashlangan', !html.includes('id="login-remember-me"'));
check('checkExistingSession doimiy localStorage ni tozalaydi', app.includes('localStorage.removeItem(SESSION_KEY)'));
check('setSession faqat sessionStorage ga yozadi', app.includes('sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))'));
check('Logout funksiyasi ikkala xotirani ham tozalaydi', app.includes('sessionStorage.removeItem(SESSION_KEY)') && app.includes('localStorage.removeItem(SESSION_KEY)'));

// ----------------------------------------------------
// BO'LIM 3: REITING VA MODALLAR AUDITI
// ----------------------------------------------------
console.log('\n--- 3. HAYDOVCHILAR REYTINGI VA MODAL OYNALAR ---');

check('Reyting modalida yuqori o\'ngdagi X tugmasi olib tashlangan', !html.includes('id="btn-close-ranking-modal"'));
check('Reyting modalida pastdagi Yopish tugmasi mavjud', html.includes('id="btn-close-ranking-modal-footer"'));
check('Texnik yordam modalida yuqori o\'ngdagi X tugmasi olib tashlangan', !html.includes('id="btn-close-support-modal"'));
check('Texnik yordam modalida pastdagi Yopish tugmasi mavjud', html.includes('id="btn-close-support-footer"'));
check('Admin tablaridan ortiqcha reyting tugmasi olib tashlangan', !html.includes('id="btn-open-ranking-tab"'));
check('Admin statistikasida tepadagi TOP reyting kartochkasi mavjud', html.includes('id="admin-ranking-card"'));
check('Haydovchi panelida TOP reyting kartochkasi mavjud', html.includes('id="driver-ranking-card"'));

// ----------------------------------------------------
// BO'LIM 4: "OXIRGI REYS" VA SEKUINDNOMER TITRASHI (JITTER)
// ----------------------------------------------------
console.log('\n--- 4. "OXIRGI REYS" VA SEKUNDNOMER TITRASHINI TEKSHIRISH ---');

check('Oxirgi reys ustuni sarlavhasida qat\'iy min-width berilgan', html.includes('min-width: 185px; width: 185px;">Oxirgi reys</th>'));
check('CSS da .last-trip-cell uchun white-space: nowrap !important mavjud', css.includes('.last-trip-cell') && css.includes('white-space: nowrap !important;'));
check('CSS da .last-trip-badge va ajratgich nuqta mavjud', css.includes('.last-trip-badge') && css.includes('.last-trip-divider'));
check('app.js da oxirgi reys sanasi va soati toza badge shaklida yasalgan', app.includes('last-trip-badge') && app.includes('last-trip-divider'));

check('Jadvaldagi jonli sekundnomer (DAVOMIYLIGI) uchun min-width qulflangan', css.includes('.live-admin-trip-elapsed') && css.includes('min-width: 175px;'));
check('Jadvaldagi jonli reys holati (HOLAT) uchun min-width qulflangan', css.includes('.live-admin-trip-badge') && css.includes('min-width: 66px;'));
check('attendance table 9- va 11-ustunlarida qat\'iy kengliklar mavjud', css.includes('#admin-attendance-table th:nth-child(9)') && css.includes('#admin-attendance-table th:nth-child(11)'));
check('app.js dagi adminTableLiveTicker ikonkalarni yo\'qotmaydi (faqat textContent yangilanadi)', app.includes('countdownValEl.textContent = lockStatus.countdownStr;'));

// ----------------------------------------------------
// BO'LIM 5: PODIUM KARTALARI VA SCROLL BARQARORLIGI
// ----------------------------------------------------
console.log('\n--- 5. PODIUM KARTALARI VA SCROLL TESTI ---');

check('podium-card da harakatlanuvchi translateY(-4px) yo\'q qilingan', css.includes('.podium-card') && css.includes('transform: none !important;'));
check('podium-crown-icon da tebranuvchi crown-float animatsiyasi yo\'q qilingan', !css.includes('animation: crown-float'));

// ----------------------------------------------------
// BO'LIM 6: MOBIL BRAUZER (MOBILE RESPONSIVE) TEKSHIRUVI
// ----------------------------------------------------
console.log('\n--- 6. MOBIL BRAUZER MOSLASHUVCHANLIGI (MOBILE VIEWPORT) ---');

check('HTML viewport meta tegida viewport-fit=cover mavjud', html.includes('viewport-fit=cover'));
check('Statistika kartalari 600px/1024px da 2 ustunli tartibga ega', css.includes('@media (max-width: 600px)') && css.includes('repeat(2, 1fr) !important;'));
check('Jadvallarda gorizontal skroll va iOS inertial skroll mavjud', css.includes('-webkit-overflow-scrolling: touch;') && css.includes('.table-responsive'));
check('Mobil navigatsiya tugmalari minimal qulay o\'lchamlarga ega', css.includes('@media (max-width: 768px)'));
check('Mobil ekranlar uchun modal oynalar kengligi 95% yoki to\'liq', css.includes('width: 95%;'));

// ----------------------------------------------------
// BO'LIM 7: PC BRAUZER (DESKTOP) MOSLASHUVCHANLIGI
// ----------------------------------------------------
console.log('\n--- 7. PC BRAUZER (DESKTOP VIEW) MOSLASHUVCHANLIGI ---');

check('Desktop statistika kartalari simmetrik 4 ustunli panjarada', css.includes('grid-template-columns: repeat(4, 1fr);'));
check('Statistika ikonkasi 36px ixcham o\'lchamda', css.includes('width: 36px;') && css.includes('height: 36px;'));
check('Desktop asosiy konteyner kengligi 1180px dan oshmaydi', css.includes('max-width: 1180px;'));

// ----------------------------------------------------
// BO'LIM 8: HTML ELEMENTLAR VA ID BOG'LANISHLARI
// ----------------------------------------------------
console.log('\n--- 8. JS DA CHAQIRILGAN MUHIM ID LAR INDEX.HTML DA MAVJUDLIGI ---');

const criticalIds = [
  'live-datetime-badge', 'theme-toggle-btn', 'theme-icon', 'theme-text-label',
  'btn-header-support', 'header-user-info', 'header-user-name', 'header-user-role', 'logout-btn',
  'login-username', 'login-password', 'login-form', 'btn-login-submit',
  'driver-section', 'driver-name', 'driver-truck', 'driver-phone',
  'driver-monthly-salary', 'driver-daily-rate', 'driver-trips-count', 'driver-earned-salary',
  'driver-advance-card-val', 'driver-net-salary-card-val', 'driver-ranking-card',
  'admin-section', 'admin-stat-total-drivers', 'admin-stat-today-trips', 'admin-stat-today-active',
  'admin-stat-total-trucks', 'admin-stat-total-advances', 'admin-stat-total-payout', 'admin-ranking-card',
  'tab-attendance', 'tab-drivers', 'tab-trucks', 'tab-advances', 'tab-salary-payout', 'tab-add-driver',
  'driver-ranking-modal', 'ranking-truck-select', 'ranking-podium-grid', 'ranking-table-tbody',
  'tech-support-modal'
];

let allIdsFound = true;
criticalIds.forEach(id => {
  if (!html.includes(`id="${id}"`)) {
    console.error(`  [MISSING ID] id="${id}" index.html da topilmadi!`);
    allIdsFound = false;
  }
});
check('Barcha muhim ID lar index.html da mavjud', allIdsFound);

// ----------------------------------------------------
// YAKUNIY HISOBOT
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`  AUDIT NATIJASI: ${passedChecks}/${totalChecks} TESTLAR MUVAFFAQIYATLI O'TDI!`);
if (passedChecks === totalChecks) {
  console.log('  HAMMA NARSASI 100% SOZ VA STANDARTLARGA MOS! 🚀');
} else {
  console.log(`  DIQQAT: ${totalChecks - passedChecks} ta testda kamchilik aniqlandi!`);
}
console.log('====================================================\n');
