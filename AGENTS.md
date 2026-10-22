# Loyiha qoidalari (Project Rules)

- **Faqat D: diskidan foydalanish**: Barcha fayllar, kutubxonalar, vaqtinchalik ma'lumotlar va o'rnatishlar faqat `D:\` diskida (ushbu loyiha katalogida) amalga oshirilishi shart.
- **C: diskiga tegilmasin**: `C:\` diskiga hech narsa yozilmasin, saqlanmasin va u yerdan hech narsa olinmasin.

## ⚠️ Texnik Ishlar Banneri Qoidasi (Maintenance Notice Banner)
Saytda texnik ta'mirlash, testlash yoki yangilash ishlari olib borilayotganda PC va telefon brauzerida sariq undovli ogohlantirish banneri ko'rsatiladi:
- **Element joylashuvi**: [index.html](file:///d:/Loyihalar/Maoshni%20taqsimlash/index.html) da `<div id="maintenance-banner" class="maintenance-banner" role="alert">`
- **Banner matni**: `⚠️ Diqqat! Tizimni yanada yaxshilash ustida ishlayapmiz. Keltirilgan noqulaylik uchun uzr so‘raymiz ⚙️`
- **Doimiylik**: Bannerda yopish (X) tugmasi yo'q, sahifada doimiy ko'rinib turadi va foydalanuvchi tasodifan yopib yubora olmaydi.
- **Yoqish (ON)**: `index.html` dagi `#maintenance-banner` elementidan `style="display: none;"` olib tashlanadi (ya'ni doimiy ko'rinadigan holatga keltiriladi).
- **O'chirish (OFF)**: `index.html` dagi `#maintenance-banner` elementiga `style="display: none;"` qo'shiladi.
- **Vazifa**: Foydalanuvchi so'raganda yoki saytda yangi funksiyalar qo'shilayotganda ushbu sariq undovli bannerni yoqib qo'yish, barcha ishlar yakunlanib tekshirilgach esa o'chirib qo'yish lozim.

