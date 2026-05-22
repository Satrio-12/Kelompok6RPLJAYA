/**
 * global.js - Core Logic, LocalStorage Shared Database, and Layout Injection
 * e-ProcureFlow Web Application
 */

async function syncFromKV() {
  const keys = ['eproc_users', 'eproc_catalog', 'eproc_budget', 'eproc_orders', 'eproc_notifications'];
  try {
    const res = await fetch('/api/kv?t=' + Date.now() + '&keys=' + keys.join(','), { cache: 'no-store' });
    if (res.ok) {
      const db = await res.json();
      let hasData = false;
      keys.forEach(k => {
        if (db[k]) {
          localStorage.setItem(k, JSON.stringify(db[k]));
          hasData = true;
        }
      });
      return hasData;
    }
  } catch (error) {
    console.error("Failed to sync from KV:", error);
  }
  return false;
}

let saveTimeout = null;
let savePromise = null;

window.saveToKV = function(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  
  if (saveTimeout) clearTimeout(saveTimeout);
  
  savePromise = new Promise((resolve) => {
    saveTimeout = setTimeout(async () => {
      const keys = ['eproc_users', 'eproc_catalog', 'eproc_budget', 'eproc_orders', 'eproc_notifications'];
      const fullDb = {};
      keys.forEach(k => {
        const item = localStorage.getItem(k);
        if (item) fullDb[k] = JSON.parse(item);
      });

      try {
        await fetch('/api/kv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullDb)
        });
      } catch (e) {
        console.error("KV Sync failed:", e);
      }
      resolve();
    }, 500);
  });
};

window.waitForSave = async function() {
  if (savePromise) await savePromise;
};

document.addEventListener('DOMContentLoaded', async () => {
  const hasData = await syncFromKV();
  if (!hasData) {
    initializeDatabase();
  }
  injectLayout();
  setupNotifications();
});

// ==========================================
// 1. LOCAL STORAGE DATABASE ENGINE
// ==========================================
function initializeDatabase() {
  // --- SEED USERS (FR-02, FR-05) ---
  if (!localStorage.getItem('eproc_users')) {
    const defaultUsers = [
      { username: 'admin', name: 'Budi Santoso', role: 'Admin', active: true },
      { username: 'pakpa', name: 'Dr. Ir. Hermawan M.T.', role: 'PA/KPA', active: true },
      { username: 'ppk', name: 'Ahmad Subarjo S.T.', role: 'PPK', active: true },
      { username: 'pengadaan', name: 'Rian Hidayat', role: 'Pejabat Pengadaan', active: true },
      { username: 'pokja', name: 'Siti Aminah', role: 'Pokja', active: true }
    ];
    // Default passwords are username + 123 (e.g. admin123, ppk123)
    window.saveToKV('eproc_users', defaultUsers);
  }

  // --- SEED CATALOG PRODUCTS (FR-08, FR-10) ---
  if (!localStorage.getItem('eproc_catalog')) {
    const defaultCatalog = [
      { id: 'PROD-001', name: 'Laptop ASUS ExpertBook B1', category: 'Teknologi Informasi', price: 14500000, provider: 'PT ASUS Technology Indonesia', specs: 'Intel Core i7, 16GB RAM, 512GB SSD, Windows 11 Pro, Layar 14"', availability: 'Ready Stock', skp: 4.8 },
      { id: 'PROD-002', name: 'AC Split Daikin Premium 1.5 PK', category: 'Peralatan Kantor', price: 7200000, provider: 'CV Sejuk Sentosa', specs: 'Inverter, R32 Freon, Hemat Energi, Kapasitas Pendinginan 12000 BTU/h', availability: '10 Unit', skp: 4.2 },
      { id: 'PROD-003', name: 'Server Rackmount HPE ProLiant DL380 Gen10', category: 'Infrastruktur IT', price: 185000000, provider: 'PT Sinergi Global Solusindo', specs: 'Intel Xeon Gold, 64GB RAM, 2x 1.2TB SAS HDD, Dual Power Supply 800W', availability: 'Indent (2 Minggu)', skp: 4.9 },
      { id: 'PROD-004', name: 'Kursi Kerja Ergonomis Modern Futura', category: 'Furnitur Kantor', price: 2800000, provider: 'PT Indofutura Meubelindo', specs: 'High-back mesh, Adjustable Lumbar Support & Armrest, Heavy Duty Nylon Base', availability: 'Ready Stock', skp: 1.8 }, // SKP < 2.5 (Supplier Performance Warning)
      { id: 'PROD-005', name: 'Desktop PC Lenovo ThinkCentre M70q', category: 'Teknologi Informasi', price: 12000000, provider: 'PT Lenovo Distributor Utama', specs: 'Intel Core i5, 8GB RAM, 256GB SSD, Monitor 21.5", Mouse & Keyboard', availability: '50 Unit', skp: 4.5 },
      { id: 'PROD-006', name: 'Projektor Epson EB-X500 XGA', category: 'Peralatan Kantor', price: 6500000, provider: 'CV Epson Multi Raya', specs: '3600 Lumens, XGA Resolution, HDMI & USB, Contrast Ratio 16.000:1', availability: '15 Unit', skp: 3.8 },
      { id: 'PROD-007', name: 'Paket Lisensi Cloud Server AWS Government 1 Tahun', category: 'Infrastruktur IT', price: 450000000, provider: 'PT Amazon Web Services Indonesia', specs: 'EC2 Dedicated Host, RDS Database, 10TB S3 Storage, Managed Support', availability: 'Instan', skp: 4.9 }
    ];
    window.saveToKV('eproc_catalog', defaultCatalog);
  }

  // --- SEED BUDGET LIMITS & REALIZATION (FR-15, FR-26) ---
  if (!localStorage.getItem('eproc_budget')) {
    const defaultBudget = {
      totalPagu: 5000000000, // 5 Billion IDR
      realisasi: 1250000000,  // 1.25 Billion IDR
      sisa: 3750000000        // 3.75 Billion IDR
    };
    window.saveToKV('eproc_budget', defaultBudget);
  }

  // --- SEED PURCHASE ORDERS (FR-13, FR-14, FR-18) ---
  if (!localStorage.getItem('eproc_orders')) {
    const defaultOrders = [
      {
        id: 'PO-2026-0001',
        creator: 'pengadaan',
        items: [
          { id: 'PROD-001', name: 'Laptop ASUS ExpertBook B1', price: 14500000, qty: 5, provider: 'PT ASUS Technology Indonesia' }
        ],
        total: 72500000,
        status: 'Disetujui',
        createdDate: '2026-05-10',
        approvedDate: '2026-05-11',
        history: [
          { status: 'Draft', date: '2026-05-10', note: 'Draft purchase order dibuat.' },
          { status: 'Menunggu Persetujuan', date: '2026-05-10', note: 'Dikirim ke PPK Ahmad Subarjo S.T.' },
          { status: 'Disetujui', date: '2026-05-11', note: 'Disetujui oleh PPK. TTE Berhasil disematkan.' }
        ],
        tteHash: 'SHA-256:7b5d86e92f254bca6a12b4e883fc514838bca87b0a7dbf224a1e948c26ab6d14',
        tteUser: 'ppk',
        catatanPenolakan: ''
      },
      {
        id: 'PO-2026-0002',
        creator: 'pengadaan',
        items: [
          { id: 'PROD-003', name: 'Server Rackmount HPE ProLiant DL380 Gen10', price: 185000000, qty: 2, provider: 'PT Sinergi Global Solusindo' }
        ],
        total: 370000000,
        status: 'Menunggu Persetujuan',
        createdDate: '2026-05-20',
        approvedDate: '',
        history: [
          { status: 'Draft', date: '2026-05-20', note: 'Draft purchase order dibuat.' },
          { status: 'Menunggu Persetujuan', date: '2026-05-20', note: 'Dikirim ke PPK Ahmad Subarjo S.T.' }
        ],
        tteHash: '',
        tteUser: '',
        catatanPenolakan: ''
      }
    ];
    window.saveToKV('eproc_orders', defaultOrders);
  }

  // --- SEED NOTIFICATIONS (FR-28, FR-29) ---
  if (!localStorage.getItem('eproc_notifications')) {
    const defaultNotifs = [
      { id: 'NOT-001', recipient: 'ppk', message: 'Terdapat 1 Purchase Order (PO-2026-0002) baru yang membutuhkan approval Anda.', time: '2026-05-20 14:30', unread: true },
      { id: 'NOT-002', recipient: 'pengadaan', message: 'Purchase Order PO-2026-0001 Anda telah DISETUJUI oleh PPK.', time: '2026-05-11 10:15', unread: false }
    ];
    window.saveToKV('eproc_notifications', defaultNotifs);
  }
}

// ==========================================
// 2. AUTHENTICATION & SECURITY GUARD (FR-01, FR-03, FR-04)
// ==========================================
function getLoggedInUser() {
  const session = localStorage.getItem('eproc_session');
  if (!session) return null;
  return JSON.parse(session);
}

function requireAuth(allowedRoles = []) {
  const user = getLoggedInUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Check if account is active
  const users = JSON.parse(localStorage.getItem('eproc_users') || '[]');
  const currentUser = users.find(u => u.username === user.username);
  if (!currentUser || !currentUser.active) {
    alert('Akun Anda dinonaktifkan oleh Admin. Silakan hubungi administrator.');
    logout();
    return;
  }

  // Check role authorization
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    alert('Akses Ditolak: Role Anda (' + user.role + ') tidak diizinkan mengakses halaman ini.');
    window.location.href = 'dashboard.html';
  }
}

function logout() {
  localStorage.removeItem('eproc_session');
  window.location.href = 'login.html';
}

// ==========================================
// 3. AUTOMATIC LAYOUT INJECTION
// ==========================================
function injectLayout() {
  const user = getLoggedInUser();
  if (!user) return; // If login page, don't inject

  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    const activePage = window.location.pathname.split('/').pop().replace('.html', '');
    
    // Custom navigation items based on Role (FR-02)
    let linksHtml = '';
    
    // Everyone except Admin can see Dashboard
    if (user.role !== 'Admin') {
      linksHtml += `
        <a href="dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Dashboard</span>
        </a>
      `;
    }

    // Catalog & Keranjang: Pejabat Pengadaan, Pokja, PA/KPA
    if (['Pejabat Pengadaan', 'Pokja', 'PA/KPA'].includes(user.role)) {
      linksHtml += `
        <a href="katalog.html" class="nav-link ${activePage === 'katalog' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
          <span>e-Katalog Barang</span>
        </a>
        <a href="keranjang.html" class="nav-link ${activePage === 'keranjang' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
          <span>Keranjang Belanja</span>
        </a>
      `;
    }

    // Purchase Orders list: PPK, PA/KPA, Pejabat Pengadaan, Pokja
    if (user.role !== 'Admin') {
      linksHtml += `
        <a href="purchase.html" class="nav-link ${activePage === 'purchase' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          <span>Purchase Orders</span>
        </a>
      `;
    }

    // Approvals: PPK, PA/KPA (FR-19, FR-21)
    if (['PPK', 'PA/KPA'].includes(user.role)) {
      linksHtml += `
        <a href="approval.html" class="nav-link ${activePage === 'approval' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <span>Approval PPK</span>
        </a>
      `;
    }

    // Tracking (All Users except Admin can view status)
    if (user.role !== 'Admin') {
      linksHtml += `
        <a href="tracking.html" class="nav-link ${activePage === 'tracking' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          <span>Tracking Progress</span>
        </a>
      `;
    }

    // User Management: Admin only (FR-05)
    if (user.role === 'Admin') {
      linksHtml += `
        <a href="manajemen-pengguna.html" class="nav-link ${activePage === 'manajemen-pengguna' ? 'active' : ''}">
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          <span>Kelola Pengguna</span>
        </a>
      `;
    }

    // Assemble Sidebar Content
    sidebarContainer.innerHTML = `
      <div class="sidebar">
        <div class="brand-section">
          <div class="brand-logo">e</div>
          <div class="brand-name">e-ProcureFlow</div>
        </div>
        <div class="user-profile-section">
          <div class="user-avatar">${user.name.split(' ').map(n => n[0]).slice(0,2).join('')}</div>
          <div class="user-info">
            <span class="user-name" title="${user.name}">${user.name}</span>
            <span class="user-role-badge">${user.role}</span>
          </div>
        </div>
        <nav class="nav-links">
          ${linksHtml}
        </nav>
        <button class="logout-btn" onclick="logout()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          <span>Keluar</span>
        </button>
      </div>
    `;
  }

  // Inject Navbar Header if needed (FR-23)
  const navbarContainer = document.getElementById('navbar-container');
  if (navbarContainer) {
    const pageTitle = document.title.split('-')[0].trim();
    navbarContainer.innerHTML = `
      <div class="top-navbar">
        <h1 class="page-title">${pageTitle}</h1>
        <div class="nav-actions">
          <!-- Notification Bell -->
          <div class="notification-hub" id="notification-hub">
            <div class="notification-trigger" id="notif-trigger">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <div class="notification-badge" id="notif-badge" style="display: none;">0</div>
            </div>
            <div class="notification-dropdown" id="notif-dropdown">
              <div class="notification-header">
                <span>Notifikasi</span>
                <span class="clear-notif-btn" onclick="clearNotifications()">Hapus Semua</span>
              </div>
              <div class="notification-list" id="notif-list">
                <!-- Items populated by JS -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

// ==========================================
// 4. NOTIFICATION ENGINE (FR-28, FR-29)
// ==========================================
function setupNotifications() {
  const user = getLoggedInUser();
  if (!user) return;

  const trigger = document.getElementById('notif-trigger');
  const dropdown = document.getElementById('notif-dropdown');
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notif-list');

  if (!trigger || !dropdown) return;

  // Toggle dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    markNotificationsAsRead();
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });

  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Render notifications
  renderNotifications();
}

function renderNotifications() {
  const user = getLoggedInUser();
  if (!user) return;

  const notifications = JSON.parse(localStorage.getItem('eproc_notifications') || '[]');
  const myNotifications = notifications.filter(n => n.recipient === user.username || n.recipient === 'all');
  
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notif-list');
  if (!list || !badge) return;

  const unreadCount = myNotifications.filter(n => n.unread).length;
  
  if (unreadCount > 0) {
    badge.innerText = unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }

  if (myNotifications.length === 0) {
    list.innerHTML = `<div class="notification-item" style="text-align: center; color: var(--text-muted);">Tidak ada notifikasi baru</div>`;
    return;
  }

  // Sort newest first
  myNotifications.sort((a,b) => new Date(b.time) - new Date(a.time));

  list.innerHTML = myNotifications.map(n => `
    <div class="notification-item ${n.unread ? 'unread' : ''}" onclick="handleNotificationClick('${n.id}')">
      <div>${n.message}</div>
      <div class="time">${n.time}</div>
    </div>
  `).join('');
}

function addNotification(recipient, message) {
  const notifications = JSON.parse(localStorage.getItem('eproc_notifications') || '[]');
  const now = new Date();
  const formatTime = now.getFullYear() + '-' + 
                     String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(now.getDate()).padStart(2, '0') + ' ' + 
                     String(now.getHours()).padStart(2, '0') + ':' + 
                     String(now.getMinutes()).padStart(2, '0');
                     
  const newNotif = {
    id: 'NOT-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
    recipient: recipient,
    message: message,
    time: formatTime,
    unread: true
  };

  notifications.push(newNotif);
  window.saveToKV('eproc_notifications', notifications);
  
  // Re-render
  renderNotifications();
  showToast(message, 'info');
}

function markNotificationsAsRead() {
  const user = getLoggedInUser();
  if (!user) return;

  const notifications = JSON.parse(localStorage.getItem('eproc_notifications') || '[]');
  notifications.forEach(n => {
    if (n.recipient === user.username && n.unread) {
      n.unread = false;
    }
  });
  window.saveToKV('eproc_notifications', notifications);
  
  // Update badge immediately
  const badge = document.getElementById('notif-badge');
  if (badge) badge.style.display = 'none';
}

function clearNotifications() {
  const user = getLoggedInUser();
  if (!user) return;

  let notifications = JSON.parse(localStorage.getItem('eproc_notifications') || '[]');
  notifications = notifications.filter(n => n.recipient !== user.username);
  window.saveToKV('eproc_notifications', notifications);
  
  renderNotifications();
}

function handleNotificationClick(id) {
  // Try to redirect or simply alert
  const notifications = JSON.parse(localStorage.getItem('eproc_notifications') || '[]');
  const notif = notifications.find(n => n.id === id);
  if (notif) {
    if (notif.message.includes('PO-')) {
      // Find purchase order code
      const match = notif.message.match(/PO-\d{4}-\d+/);
      if (match) {
        const poId = match[0];
        const user = getLoggedInUser();
        if (['PPK', 'PA/KPA'].includes(user.role)) {
          window.location.href = `approval.html?id=${poId}`;
        } else {
          window.location.href = `tracking.html?id=${poId}`;
        }
        return;
      }
    }
  }
}

// ==========================================
// 5. TOAST ENGINE & GENERAL HELPERS
// ==========================================
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '🔔';
  if (type === 'success') icon = '✅';
  if (type === 'warning') icon = '⚠️';
  if (type === 'danger') icon = '❌';

  toast.innerHTML = `
    <span>${icon}</span>
    <div>${message}</div>
  `;

  container.appendChild(toast);

  // Remove toast after 4s
  setTimeout(() => {
    toast.style.animation = 'slideInToast 0.3s cubic-bezier(0.4, 0, 0.2, 1) reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Formatting functions
function formatRupiah(value) {
  return 'Rp ' + Number(value).toLocaleString('id-ID');
}
