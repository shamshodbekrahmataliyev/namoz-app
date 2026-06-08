// ===== PRAYER TIMES & QIBLA APP =====

const PRAYER_NAMES = {
  Fajr: '🌙 Bomdod',
  Sunrise: '🌅 Quyosh chiqishi',
  Dhuhr: '☀️ Peshin',
  Asr: '🌤️ Asr',
  Maghrib: '🌆 Shom',
  Isha: '🌙 Xufton'
};

let userLat = 41.2995; // Default: Toshkent
let userLon = 69.2401;
let cityName = 'Toshkent';
let prayerTimes = {};
let tasbehCount = 0;
let tasbehRounds = 0;
let tasbehTarget = 33;
let currentZikr = 'SubhanAllah';
let countdownInterval;
let compassInterval;
let qiblaAngle = 0;
let deviceHeading = 0;

// ===== INIT =====
window.addEventListener('load', () => {
  getLocation();
  updateClock();
  setInterval(updateClock, 1000);
  requestNotificationPermission();
});

// ===== LOCATION =====
function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLat = pos.coords.latitude;
        userLon = pos.coords.longitude;
        reverseGeocode(userLat, userLon);
        fetchPrayerTimes();
        calculateQibla();
      },
      () => {
        document.getElementById('location-info').textContent = '📍 Toshkent (standart)';
        fetchPrayerTimes();
        calculateQibla();
      }
    );
  } else {
    fetchPrayerTimes();
    calculateQibla();
  }
}

function reverseGeocode(lat, lon) {
  fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
    .then(r => r.json())
    .then(d => {
      cityName = d.address?.city || d.address?.town || d.address?.state || 'Joylashuv';
      document.getElementById('location-info').textContent = `📍 ${cityName}`;
    })
    .catch(() => {});
}

// ===== PRAYER TIMES (AlAdhan API) =====
function fetchPrayerTimes() {
  const today = new Date();
  const date = `${today.getDate().toString().padStart(2,'0')}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getFullYear()}`;
  fetch(`https://api.aladhan.com/v1/timings/${date}?latitude=${userLat}&longitude=${userLon}&method=3`)
    .then(r => r.json())
    .then(data => {
      const t = data.data.timings;
      prayerTimes = {
        Fajr: t.Fajr,
        Sunrise: t.Sunrise,
        Dhuhr: t.Dhuhr,
        Asr: t.Asr,
        Maghrib: t.Maghrib,
        Isha: t.Isha
      };
      renderPrayerList();
      updateNextPrayer();
      scheduleNotifications();
      if (countdownInterval) clearInterval(countdownInterval);
      countdownInterval = setInterval(updateNextPrayer, 60000);
    })
    .catch(() => {
      document.getElementById('prayer-list').innerHTML = '<p style="text-align:center;color:#ff9090;">Namoz vaqtlarini olishda xato. Internet aloqasini tekshiring.</p>';
    });
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function renderPrayerList() {
  const list = document.getElementById('prayer-list');
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  list.innerHTML = '';
  Object.entries(prayerTimes).forEach(([key, time]) => {
    const mins = timeToMinutes(time);
    const isCurrent = isCurrentPrayer(key);
    const div = document.createElement('div');
    div.className = 'prayer-item' + (isCurrent ? ' current' : '');
    div.innerHTML = `
      <div style="display:flex;align-items:center">
        <span class="prayer-icon">${getPrayerIcon(key)}</span>
        <span class="prayer-name">${PRAYER_NAMES[key]}</span>
      </div>
      <span class="prayer-time">${time}</span>
    `;
    list.appendChild(div);
  });
}

function getPrayerIcon(key) {
  const icons = { Fajr:'🌙', Sunrise:'🌅', Dhuhr:'☀️', Asr:'🌤️', Maghrib:'🌆', Isha:'⭐' };
  return icons[key] || '🕐';
}

function isCurrentPrayer(key) {
  const keys = Object.keys(prayerTimes);
  const idx = keys.indexOf(key);
  if (idx === -1) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(prayerTimes[key]);
  const end = idx < keys.length - 1 ? timeToMinutes(prayerTimes[keys[idx+1]]) : 24*60;
  return cur >= start && cur < end;
}

function updateNextPrayer() {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  let nextKey = null, nextMins = null;
  for (const [key, time] of Object.entries(prayerTimes)) {
    const m = timeToMinutes(time);
    if (m > cur) { nextKey = key; nextMins = m; break; }
  }
  if (!nextKey) {
    nextKey = 'Fajr';
    nextMins = timeToMinutes(prayerTimes['Fajr']) + 24*60;
  }
  const diff = nextMins - cur;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  document.getElementById('next-prayer-name').textContent = PRAYER_NAMES[nextKey];
  document.getElementById('next-prayer-countdown').textContent =
    h > 0 ? `${h} soat ${m} daqiqadan keyin` : `${m} daqiqadan keyin`;
  renderPrayerList();
}

// ===== NOTIFICATIONS =====
function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission();
  }
}

function scheduleNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  Object.entries(prayerTimes).forEach(([key, time]) => {
    const [h, m] = time.split(':').map(Number);
    const prayerDate = new Date();
    prayerDate.setHours(h, m, 0, 0);
    const diff = prayerDate.getTime() - now.getTime();
    if (diff > 0) {
      setTimeout(() => {
        new Notification(`🕌 ${PRAYER_NAMES[key]} vaqti!`, {
          body: `Namoz vaqti keldi. Allahu Akbar! 🤲`,
          icon: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/72x72/1f54c.png'
        });
      }, diff);
    }
  });
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2,'0');
  const m = now.getMinutes().toString().padStart(2,'0');
  const s = now.getSeconds().toString().padStart(2,'0');
  document.getElementById('current-time').textContent = `${h}:${m}:${s}`;
  document.getElementById('hijri-date').textContent = getHijriDate(now);
}

function getHijriDate(date) {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(date) + ' (Hijriy)';
  } catch { return ''; }
}

// ===== QIBLA =====
function calculateQibla() {
  const kaabaLat = 21.4225;
  const kaabaLon = 39.8262;
  const lat1 = userLat * Math.PI / 180;
  const lat2 = kaabaLat * Math.PI / 180;
  const dLon = (kaabaLon - userLon) * Math.PI / 180;
  const x = Math.sin(dLon) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let bearing = Math.atan2(x, y) * 180 / Math.PI;
  qiblaAngle = (bearing + 360) % 360;

  const dist = getDistanceKm(userLat, userLon, kaabaLat, kaabaLon);
  document.getElementById('qibla-degree').textContent = `Qibla: ${Math.round(qiblaAngle)}° shimoldan`;
  document.getElementById('qibla-distance').textContent = `Ka'baga masofa: ~${Math.round(dist).toLocaleString()} km`;

  // Device orientation
  if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      document.getElementById('qibla-needle').parentElement.addEventListener('click', () => {
        DeviceOrientationEvent.requestPermission().then(p => {
          if (p === 'granted') listenOrientation();
        });
      });
    } else {
      listenOrientation();
    }
  }
  updateQiblaArrow();
}

function listenOrientation() {
  window.addEventListener('deviceorientationabsolute', e => {
    deviceHeading = e.alpha || 0;
    updateQiblaArrow();
  });
  window.addEventListener('deviceorientation', e => {
    if (e.webkitCompassHeading !== undefined) {
      deviceHeading = e.webkitCompassHeading;
    } else {
      deviceHeading = e.alpha || 0;
    }
    updateQiblaArrow();
  });
}

function updateQiblaArrow() {
  const rotation = qiblaAngle - deviceHeading;
  document.getElementById('qibla-needle').style.transform =
    `translate(-50%, -50%) rotate(${rotation}deg)`;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ===== TASBEH =====
const ZIKR_TARGETS = {
  'SubhanAllah': 33,
  'Alhamdulillah': 33,
  'Allahu Akbar': 33,
  'La ilaha illallah': 100,
  'Astaghfirullah': 100
};

function changeZikr() {
  const sel = document.getElementById('zikr-select');
  currentZikr = sel.value;
  tasbehTarget = ZIKR_TARGETS[currentZikr] || 33;
  document.getElementById('zikr-name').textContent = currentZikr;
  document.getElementById('tasbeh-target').textContent = `/ ${tasbehTarget}`;
  resetTasbeh();
}

function countTasbeh() {
  tasbehCount++;
  if (tasbehCount >= tasbehTarget) {
    tasbehRounds++;
    tasbehCount = 0;
    document.getElementById('tasbeh-rounds').textContent = `Aylanishlar: ${tasbehRounds}`;
    document.getElementById('tasbeh-main-btn').style.background = 'linear-gradient(135deg, #2d6a4f, #40916c)';
    setTimeout(() => {
      document.getElementById('tasbeh-main-btn').style.background = 'linear-gradient(135deg, #0f3460, #533483)';
    }, 400);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  } else {
    if (navigator.vibrate) navigator.vibrate(30);
  }
  document.getElementById('tasbeh-count').textContent = tasbehCount;
  const pct = (tasbehCount / tasbehTarget) * 100;
  document.getElementById('progress-bar').style.width = pct + '%';
}

function resetTasbeh() {
  tasbehCount = 0;
  tasbehRounds = 0;
  document.getElementById('tasbeh-count').textContent = '0';
  document.getElementById('tasbeh-rounds').textContent = 'Aylanishlar: 0';
  document.getElementById('progress-bar').style.width = '0%';
}

// ===== TABS =====
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById(name + '-tab').classList.add('active');
  event.target.classList.add('active');
}
