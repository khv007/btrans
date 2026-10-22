const https = require('https');

const url = 'https://firestore.googleapis.com/v1/projects/bourkhantrans-461df/databases/(default)/documents/logistpay_system/main_database?key=AIzaSyBg0_2Nu4Nh-x0VySPhtuh1i4KFSnJ8Pkg';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('HTTP Status:', res.statusCode);
      if (res.statusCode !== 200) {
        console.log('Error Response:', JSON.stringify(parsed, null, 2));
        return;
      }
      
      const fields = parsed.fields || {};
      
      // Check top-level Firestore fields
      console.log('\n--- TOP-LEVEL FIRESTORE FIELDS ---');
      if (fields.lastUpdated) console.log('lastUpdated:', fields.lastUpdated);
      if (fields.systemName) console.log('systemName:', fields.systemName);
      
      function parseValue(val) {
        if (!val) return null;
        if (val.stringValue !== undefined) return val.stringValue;
        if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
        if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
        if (val.booleanValue !== undefined) return val.booleanValue;
        if (val.arrayValue !== undefined) {
          return (val.arrayValue.values || []).map(parseValue);
        }
        if (val.mapValue !== undefined) {
          const res = {};
          const f = val.mapValue.fields || {};
          for (const k of Object.keys(f)) {
            res[k] = parseValue(f[k]);
          }
          return res;
        }
        return val;
      }

      const topDrivers = parseValue(fields.drivers);
      const topTrucks = parseValue(fields.trucks);
      const topDelDrivers = parseValue(fields.deletedDriverIds);
      const topDelTrucks = parseValue(fields.deletedTruckIds);

      console.log('Top-level drivers count:', Array.isArray(topDrivers) ? topDrivers.length : 'not array/empty');
      console.log('Top-level trucks count:', Array.isArray(topTrucks) ? topTrucks.length : 'not array/empty');
      console.log('Top-level deletedDriverIds:', topDelDrivers);
      console.log('Top-level deletedTruckIds:', topDelTrucks);

      let payload = null;
      if (fields.payload && fields.payload.stringValue) {
        try {
          payload = JSON.parse(fields.payload.stringValue);
        } catch (e) {
          console.log('Could not parse payload stringValue');
        }
      }

      console.log('\n--- PAYLOAD CONTENT (What app.js syncs) ---');
      if (payload) {
        console.log('Haydovchilar soni (Drivers count):', (payload.drivers || []).length);
        (payload.drivers || []).forEach((d, i) => {
          console.log(`  ${i + 1}. Ismi: "${d.fullName}", Login: "${d.login}", Tel: "${d.phone}", Oylik: ${d.monthlySalary}, ID: ${d.id}`);
        });

        console.log('\nMashinalar soni (Trucks count):', (payload.trucks || []).length);
        (payload.trucks || []).forEach((t, i) => {
          console.log(`  ${i + 1}. Rusumi: "${t.name || t.model}", Davlat raqami: "${t.plateNumber}", ID: ${t.id}`);
        });

        console.log('\nO\'chirilgan haydovchilar (deletedDriverIds):', payload.deletedDriverIds || []);
        console.log('O\'chirilgan mashinalar (deletedTruckIds):', payload.deletedTruckIds || []);
        console.log('Reyslar soni (Trips count):', (payload.attendances || payload.trips || []).length);
        console.log('Avanslar soni (Advances count):', (payload.advances || []).length);
      } else {
        console.log('Payload field is missing or empty.');
      }

    } catch (e) {
      console.error('Parse error:', e);
    }
  });
}).on('error', (err) => {
  console.error('HTTPS request failed:', err);
});
