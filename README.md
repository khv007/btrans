# 🏢 BOURKHAN TRANS "MCHJ" - Haydovchilar & Reyslar Ekotizimi

Bourkhan Trans logistika firmasi haydovchilar davomati, avtopark, reyslar va maoshni boshqaruvchi rasmiy korporativ ekotizimi.

---

## 📌 Asosiy Xususiyatlar va Rollar

### 👑 0. SUPERADMIN (Tizimning mutlaq boshqaruvchisi)
- **Avtorizatsiya**: SuperAdmin hisobi: Login: `AD2717578` / Parol: `51605055960187`.
- **👑 Rollar Boshqaruvi Paneli**:
  - Tizimdagi barcha rollar (Administratorlar, Kuzatuvchi, Haydovchilar) yagona interaktiv boshqaruv markazidan nazorat qilinadi.
  - Har bir foydalanuvchining **F.I.O, Tizimdagi roli, Logini, Paroli, Telefon raqami, Belgilangan oylik maoshi va Kunlik stavkasi** to'liq ko'rsatiladi.
  - **Parollarni ko'rish/yashirish**: Har bir parol maskalangan (`••••••••`) va ko'zcha (`👁️`) tugmasi orqali ochib ko'riladi.
  - **Tahrirlash**: Har qanday foydalanuvchining login, parol, telefon, ism va oylik maoshini bevosita tahrirlash imkoniyati.
  - **O'chirish (Delete)**: SuperAdmin istalgan foydalanuvchini (hatto admin yoki haydovchini) tizimdan butunlay o'chirib tashlay oladi.
  - **Yangi foydalanuvchi yaratish**: Istalgan rolda yangi xodim yoki boshqaruvchini tizimga biriktirish.
- **🛡️ Ma'lumotlar bazasiga kirish**:
  - SuperAdmin "Ma'lumotlar bazasi" bo'limiga ham xavfsizlik uchun faqat maxsus maxfiy kod (`51605055960187`) kiritilgandagina kira oladi.

---

### 👨‍💼 1. ADMIN (Rahbar) paneli
- **Avtorizatsiya**: Boshqaruv paneliga maxsus login va parol (`admin123` / `20040915`) orqali kirish.
- **Haydovchilar boshqaruvi**:
  - Yangi haydovchi qo'shish (*F.I.O, Telefon raqami, Belgilangan oylik maoshi, Login va Parol*).
  - Har qanday haydovchiga yo'nalish masofasiga qarab **Minimal ruxsat vaqti (70 km/s + 15 daq)** tatbiq etiladi (Viloyat ichida esa 30:00 daqiqa).
  - Haydovchilar ro'yxatini ko'rish, qidirish va o'chirish.
  - **O'chirish xatoligi to'g'rilandi**: Haydovchi o'chirilganda u qayta paydo bo'lmaydi va bazadan (`deletedDriverIds` tombstones orqali) butunlay o'chiriladi.
- **Mashinalar parki boshqaruvi (Trucks Fleet)**:
  - Mashinalar alohida baza sifatida yuritiladi (*Mashina rusumi: Volvo FH 500, MAN TGX, Isuzu; Davlat raqami: 01 A 777 AA*).
  - Yangi yuk mashinalarini kiritish, tahrirlash va o'chirish.
- **Avans berish tizimi (Advances Management)**:
  - Admin istalgan haydovchiga avans mablag'i ajratadi (*Summa, sana, vaqt, izoh / maqsad*).
  - Avanslar to'plangan maoshdan avtomatik ravishda chegirilib, sof to'lanadigan qoldiq ko'rsatiladi:
    $$\text{Qoldiq maosh} = \max(0, \text{Jami to'plangan maosh} - \text{Jami olingan avans})$$
- **Davomat va Reyslar jurnali**:
  - Kunlik barcha reyslar (1-reys, 2-reys...), qaysi mashinada ketgani, yo'nalishi (masalan, *Namangan ➔ Farg'ona*), masofasi (km), boshlangan/tugatilgan vaqti va stavkasi.
  - Reysda bo'lgan haydovchilar uchun masofaga qarab hisoblangan minimal vaqt, qolgan vaqt va holat aniq ko'rinib turadi.
  - **Sahifalash (Universal Pagination)**: Reyslar, Avanslar, Haydovchilar va SuperAdmin Rollar boshqaruvi jadvallarida har bir sahifada 10 tadan qilib sahifalash joriy etilgan (tanlov: 10, 25, 50, 100 ta). Tartib raqamlari (`#`) sahifalar bo'yicha uzluksiz ketma-ketlikda davom etadi.
- **Batafsil Hisobot Modali**:
  - Admin panelidagi istalgan haydovchi qatoriga bosilganda kengaytirilgan **Batafsil Hisobot Modali** ochiladi.
  - Unda: 4 ta KPI ko'rsatkich, Barcha bajargan reyslari jurnali, Olingan avanslar tarixi, Tezkor avans berish tugmasi va Excelga (.xlsx) yuklash tugmasi mavjud.
- **Excel (.xlsx) ga eksport**:
  - Ko'p sahifali (multi-sheet) professional fayl: *Reyslar Jurnali* (Masofa va minimal ruxsat vaqti bilan), *Olingan Avanslar*, *Xulosa va Qoldiq*.
- **Admin Sozlamalari**:
  - Admin parolini xavfsiz yangilash bo'limi.

---

### 🛡️ 2. DASTURCHI MAXFIY BO'LIMI ("Ma'lumotlar bazasi")
- **Joylashuvi**: Navigatsiya panelida "Admin Sozlamalari" tugmasi yonida joylashgan.
- **🔒 Qat'iy maxfiy himoya**:
  - Ushbu bo'limga na oddiy admin, na kuzatuvchi va na haydovchi kira oladi.
  - Kirish uchun faqat dasturchiga tegishli maxsus PIN kod talab qilinadi: `51605055960187`.
  - PIN kod to'g'ri kiritilmaguncha bo'lim to'liq qulflangan holatda bo'ladi.
- **⛔ Bosqichma-bosqich Bloklash Tizimi (Brute-force himoyasi)**:
  - **1-bosqich**: Ketma-ket **3 marta** noto'g'ri kod kiritilganda — bo'lim **24 soatga** to'liq bloklanadi.
  - **2-bosqich va keyingilari**: 24 soat o'tib yana ketma-ket **3 marta** xato kiritilsa — bo'lim **7 kunga** bloklanadi (keyingi har qanday 3 xatoda ham qat'iy 7 kunlik blok belgilanadi).
  - **Bloklangan vaqtda**: Kod kiritish maydoni yopiladi, ekranda katta qizil blok banneri va **sekundomerli jonli orqaga sanash taymeri** (qolgan kun, soat, daqiqa, soniya) hamda aniq ochilish vaqti ko'rsatiladi.
  - **Doimiylik**: Bloklash ma'lumotlari xotirada saqlanadi, brauzerni yangilash yoki qayta ochish orqali blokni aylanib o'tib bo'lmaydi.
- **Imkoniyatlar va Baza Boshqaruvi**:
  - **Firebase Firestore Cloud Database**: Haqiqiy onlayn bulutli ma'lumotlar bazasi konfiguratsiyasi va sinxronizatsiya boshqaruvi.
  - **Ma'lumotlar xavfsizligi**: Adminlar tasodifan yoki bilmasdan bazani tozalab yubormasligi (Reset Demo) uchun xavfli zonalarning barchasi ushbu dasturchi paneliga ko'chirilgan.
  - **Qulflash tugmasi**: Ish tugagach, dasturchi **"🔒 Qulflash"** tugmasi orqali bo'limni darhol qayta qulflab qo'yishi mumkin.

---

### 👁️ 3. KUZATUVCHI (Faqat Ko'rish / To'liq Nazorat va Monitoring)
- **Avtorizatsiya**: Kuzatuvchi hisobi (`Husanboy` / `20050516`). Kuzatuvchi o'z sozlamalar bo'limidan o'z login va parolini maxsus maxfiy kod (`51605055960187`) kiritish orqali yangilashi mumkin.
- **Admin paneldan maxfiylik**: Bosh Administrator panelida kuzatuvchi haqida hech qanday login, parol yoki ma'lumotlar ko'rinmaydi.
- **Monitoring va kuzatish huquqi**:
  - Barcha haydovchilar faoliyati, ularning bajargan reyslari soni, joriy holati (reysda, kutmoqda, dam olgan).
  - Mashinalar parki (garajda bo'sh turgan va yo'lda yurgan mashinalar).
  - Davomat va barcha reyslar jurnali, qidiruv va filtrlash.
  - Excel (.xlsx) formatida hisobotlarni yuklab olish.
- **🔒 Maxfiylik va Shaxsiy Ma'lumotlar Himoyasi**:
  - **Avanslar yashirilgan**: Haydovchilar olgan avanslar (Avanslar bo'limi, avans hisobotlari va kartochkalari) kuzatuvchiga mutlaqo ko'rinmaydi.
  - **Kunlik topayotgan oyliklari / stavkalari yashirilgan**: Haydovchilarning kunlik stavkasi va oylik daromadlari kuzatuvchi ekranida (davomat jadvallari, umumiy xulosa va modallarda) to'liq yashirilgan.
  - **Shaxsiy telefon raqami oxirgi 4 tasi yashirilgan**: Haydovchilarning shaxsiy telefon raqamlarining oxirgi 4 ta raqami kuzatuvchi uchun maskalangan holda ko'rsatiladi (masalan: `+998 90 123 ** **`).
  - **Haydovchilar paroli yashirilgan**: "Haydovchilar ro'yxati" bo'limida haydovchilarning shaxsiy parollari kuzatuvchiga ko'rsatilmaydi (faqat login ko'rinadi, ustun nomi ham "Login" bo'ladi). Bosh Administrator uchun esa login va parol to'liq ko'rinadi.
- **🔒 Qat'iy daxlsizlik (Faqat ko'rish tartibi)**:
  - Boshqa ma'lumotlarga (haydovchilar, mashinalar, avanslar, reyslar, admin paroli, bulut sozlamalari) tegib bo'lmaydi, tahrirlab bo'lmaydi, o'chirib bo'lmaydi.
  - Barcha o'chirish tugmalari, yangi haydovchi/mashina qo'shish formalari, avans berish va admin parolini o'zgartirish vositalari bloklangan.
  - **Hisob sozlamalari xavfsizligi**: Kuzatuvchi o'z login va parolini o'zgartirishi uchun maxsus xavfsizlik kodi (`51605055960187`) kiritilishi shart. Maxfiy kod kiritilmaguncha yoki noto'g'ri kiritilsa almashtirishga yo'l qo'yilmaydi.
  - "Ma'lumotlar bazasi" va "Avanslar" tugmalari kuzatuvchi uchun ko'rinmaydi (to'liq yashirilgan).

---

### 🚛 3. HAYDOVCHI (Xodim) Kabineti
- **Yirik, qulay va kengaytirilgan dizayn**:
  - 6 ta asosiy ko'rsatkich (*Belgilangan oylik, Kunlik stavka, Reyslar soni, To'plangan maosh, Olingan avans, To'lanadigan sof qoldiq*).
  - Qulay va keng ochiladigan Mashina selektori.
  - Shaharlar marshruti selektori (*Qayerdan ➔ Qayerga*), real masofa (km) va minimal vaqt ko'rsatkichi hamda bir bosishda yo'nalishni almashtiruvchi (⇄) katta tugma.
- **🛡️ Minimal Ruxsat Vaqti (70 km/s + 15 daqiqa) va Viloyat ichida 30 daqiqa nazorati**:
  - Qat'iy umumiy 4 soatlik cheklov bekor qilingan.
  - **Bir xil viloyat (Namangan ➔ Namangan, Toshkent ➔ Toshkent va h.k.)**: zapret butunlay bekor qilingan, viloyat ichida mahalliy reys uchun qat'iy **30 daqiqa (30:00)** minimal vaqt beriladi.
  - **Viloyatlararo reyslar uchun**: har bir marshrut masofasiga (km) qarab 70 km/soat tezlik + 15 daqiqa yuklash/texnik vaqt hisoblanadi:
    $$\text{minimal\_daqiqalar} = \left\lceil \frac{\text{masofa (km)}}{70} \times 60 \right\rceil + 15 \text{ daqiqa texnik vaqt}$$
  - *Misollar*:
    - **Namangan ➔ Namangan**: Qat'iy **30 daqiqa** (30:00).
    - **50 km masofa**: $\lceil (50/70)\times 60 \rceil + 15 = 43 + 15 = \mathbf{58 \text{ daqiqa}}$.
    - **Namangan ➔ Farg'ona (85 km)**: $\lceil (85/70)\times 60 \rceil + 15 = 73 + 15 = \mathbf{88 \text{ daqiqa}}$ (1 soat 28 daqiqa).
    - **Namangan ➔ Andijon (65 km)**: $\lceil (65/70)\times 60 \rceil + 15 = 56 + 15 = \mathbf{71 \text{ daqiqa}}$ (1 soat 11 daqiqa).
    - **Toshkent ➔ Samarqand (310 km)**: $\lceil (310/70)\times 60 \rceil + 15 = 266 + 15 = \mathbf{281 \text{ daqiqa}}$ (4 soat 41 daqiqa).
  - **Reys davomida**: **"🔴 Reysni yakunlash"** tugmasi nofaol (`disabled`) holatda bo'ladi, qolgan vaqt jonli orqaga sanovchi taymerda va progress bar ko'rinishida aks etadi.
  - **Reysni yakunlashda**: Agar o'tgan vaqt hisoblangan minimal vaqtdan kam bo'lsa, tizim qat'iy taqiqlaydi, qolgan vaqtni ko'rsatib xatolik qaytaradi. Vaqt to'lgandagina reysni `completed` qilib yopishga ruxsat etiladi.
- **1 kunda bir nechta reys**:
  - Reys yakunlangach, haydovchi navbatdagi reysni (Reys #2, Reys #3...) bemalol boshlay oladi.
  - Birinchi reysda to'liq kunlik stavka hisoblanadi.

---

### 🔑 Tizim hisob ma'lumotlari:
- **Saytga kirish sahifasi**: Login va parollar ochiq holda ko'rsatilmaydi (xavfsizlik va maxfiylik uchun demo chiplar olib tashlangan).
- **👑 SuperAdmin (Mutlaq boshqaruv)**: `AD2717578` / parol: `51605055960187`
- **Admin (Bosh Administrator)**: `admin123` / parol: `admin321`
- **Kuzatuvchi (Faqat ko'rish)**: `Husanboy` / parol: `20050516`
- **Haydovchilar**:
  - `alisher` / parol: `1234`
  - `botir` / parol: `1234`
  - `jasur` / parol: `1234`
  - `anvar` / parol: `12345`

---

### 🚀 Qanday ishga tushiriladi?
1. [index.html](file:///d:/Loyihalar/Maoshni%20taqsimlash/index.html) faylini to'g'ridan-to'g'ri istalgan zamonaviy brauzeringizda (Chrome, Edge, Firefox, Safari) oching yoki quyidagi buyruq bilan lokal serverni ishga tushiring:
   ```bash
   python -m http.server 8089
   ```
   So'ngra brauzeringizda `http://127.0.0.1:8089` manziliga kiring.
2. O'z login va parolingiz bilan tizimga kiring.
3. Loyiha qoidalariga binoan barcha fayllar va amallar faqat **D:** diskida amalga oshiriladi.

---

## 💰 Maosh Taqsimoti va Xarajatlar Boshqaruvi
- **Oylik va Kunlik Stavka**: Belgilangan oylik maosh (masalan: 2,000,000 so'm) va 25 ish kuni asosida har bir ish kuni uchun avtomatik 80,000 so'm stavka hisoblanadi.
- **Taqsimot Qoidalari (Allocation Engine)**:
  - `50 / 30 / 20`: 50% Majburiy xarajatlar, 30% Ixtiyoriy xarajatlar, 20% Jamg'arma va investitsiya.
  - `60 / 20 / 20`: 60% Ehtiyojlar, 20% Istaklar, 20% Jamg'arma.
  - `Maxsus (Custom)`: Foydalanuvchi xohishiga ko'ra foizlarni moslashtirish.
- **Xarajatlar Nazorati**: Kategoriyalar bo'yicha cheklovlar, sarflangan foiz va qoldiq budjet monitoringi.
- **Tahlil va Statistika**: Dinamik vizual diagrammalar va xarajatlar tahlili.
- **Zaxiralash (Backup)**: Barcha ma'lumotlarni JSON formatida eksport va import qilish imkoniyati.

