// Service Worker kaydı
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('SW registered: ', registration);
      })
      .catch(function(registrationError) {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// HTML dosyasındaki JavaScript kodlarını buraya taşıyın
const KEY = "kendime_notes_v2";
let notes = JSON.parse(localStorage.getItem(KEY) || "[]");
let query = "";
let currentFilter = "all";
let selectedColor = "#fff";
let editingId = null;
let recognition = null;
let isListening = false;
let touchStartX = 0;
let touchStartY = 0;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

// Diğer tüm JavaScript fonksiyonları HTML'den buraya taşınacak
// (Bu örnekte kısa tutuyorum, tüm kodu taşımanız gerekiyor)