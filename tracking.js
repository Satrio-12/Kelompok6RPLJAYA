/**
 * tracking.js - Real-time e-Procurement Tracking & Operations Simulation
 * e-ProcureFlow Web Application
 */

let activeTrackingPO = null;

document.addEventListener('DOMContentLoaded', () => {
  // Guard page (FR-02)
  requireAuth(['PA/KPA', 'PPK', 'Pejabat Pengadaan', 'Pokja']);

  // Check URL query parameters for active tracking ID
  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get('id');
  
  if (poId) {
    const searchInput = document.getElementById('tracking-search-input');
    if (searchInput) searchInput.value = poId;
    loadTracking(poId);
  }
});

window.searchPOTracking = function() {
  const searchInput = document.getElementById('tracking-search-input');
  if (!searchInput) return;

  const poId = searchInput.value.trim().toUpperCase();
  if (poId === '') {
    showToast('Harap isi ID Purchase Order!', 'warning');
    return;
  }

  // Push PO id to URL without reloading page for consistency
  const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?id=' + poId;
  window.history.pushState({path:newurl},'',newurl);

  loadTracking(poId);
};

function loadTracking(poId) {
  const orders = JSON.parse(localStorage.getItem('eproc_orders') || '[]');
  activeTrackingPO = orders.find(o => o.id === poId);

  const resultArea = document.getElementById('tracking-result-area');
  const errorCard = document.getElementById('tracking-error-card');

  if (!activeTrackingPO) {
    // PO ID not found
    if (resultArea) resultArea.style.display = 'none';
    if (errorCard) errorCard.style.display = 'block';
    return;
  }

  // PO ID Found, render visuals
  if (errorCard) errorCard.style.display = 'none';
  if (resultArea) resultArea.style.display = 'grid';

  renderTrackingHeader();
  renderTimelineSteps();
  setupSimulationPanel();
}

function renderTrackingHeader() {
  const o = activeTrackingPO;
  
  // Status badge style
  const badge = document.getElementById('tracking-badge-status');
  if (badge) {
    badge.innerText = o.status;
    badge.className = 'badge'; // reset
    
    let badgeClass = 'badge-draft';
    if (o.status === 'Menunggu Persetujuan') badgeClass = 'badge-pending';
    else if (['Disetujui', 'Diproses', 'Dikirim', 'Selesai'].includes(o.status)) badgeClass = 'badge-approved';
    else if (o.status === 'Ditolak') badgeClass = 'badge-rejected';
    
    badge.classList.add(badgeClass);
  }

  // Meta Info
  document.getElementById('detail-po-id').innerText = o.id;
  document.getElementById('detail-po-creator').innerText = o.creator;
  document.getElementById('detail-po-total').innerText = formatRupiah(o.total);

  // BSrE details display (FR-22)
  const bsreRow = document.getElementById('detail-bsre-row');
  if (o.tteHash) {
    bsreRow.style.display = 'flex';
    document.getElementById('detail-bsre-hash').innerText = o.tteHash;
  } else {
    bsreRow.style.display = 'none';
  }
}

// ==========================================
// RENDER GLOWING TIMELINE NODES (FR-24, FR-25)
// ==========================================
function renderTimelineSteps() {
  const o = activeTrackingPO;
  const container = document.getElementById('vertical-timeline-steps');
  if (!container) return;

  // Stages Map
  const stages = [
    { key: 'Draft', title: 'Pembuatan Draft PO', defaultDesc: 'Draft Purchase Order dibuat oleh Pejabat Pengadaan.' },
    { key: 'Menunggu Persetujuan', title: 'Pengajuan Persetujuan', defaultDesc: 'Pemeriksaan anggaran pagu dan pengiriman berkas PO ke pejabat PPK.' },
    { key: 'Disetujui', title: 'Persetujuan Pejabat PPK & BSrE TTE', defaultDesc: 'Verifikasi TTE Digital disetujui resmi oleh PPK.' },
    { key: 'Diproses', title: 'Pemrosesan Penyedia', defaultDesc: 'Penyedia e-Katalog memverifikasi spesifikasi barang dan memproses pengiriman.' },
    { key: 'Dikirim', title: 'Barang Dikirim', defaultDesc: 'Kurir penyedia mengirim barang fisik menuju instansi tujuan.' },
    { key: 'Selesai', title: 'Serah Terima Selesai', defaultDesc: 'Dokumen serah terima barang (BAST) ditandatangani dan pengadaan diselesaikan.' }
  ];

  // Helper status checkers
  const statusHistoryList = o.history.map(h => h.status);
  const currentStatus = o.status;

  // Find index of current status to highlight steps
  const statusOrder = ['Draft', 'Menunggu Persetujuan', 'Disetujui', 'Diproses', 'Dikirim', 'Selesai'];
  
  // Re-map index if rejected
  let currentStatusIndex = statusOrder.indexOf(currentStatus);
  if (currentStatus === 'Ditolak') {
    currentStatusIndex = 2; // highlights up to step 3 as rejected
  }

  container.innerHTML = stages.map((stage, idx) => {
    let stepClass = '';
    let dateText = '';
    let descText = stage.defaultDesc;

    // Check if this step is recorded in history
    const historyRecord = o.history.find(h => h.status === stage.key || 
                                              (stage.key === 'Disetujui' && h.status === 'Ditolak'));
    
    if (historyRecord) {
      dateText = historyRecord.date;
      descText = historyRecord.note;
    }

    // Assign CSS statuses
    if (currentStatus === 'Ditolak' && idx === 2) {
      stepClass = 'rejected';
    } else if (idx < currentStatusIndex) {
      stepClass = 'done';
    } else if (idx === currentStatusIndex) {
      stepClass = 'active';
    }

    return `
      <div class="timeline-step ${stepClass}">
        <div class="step-title-row">
          <span class="step-title">${stage.title}</span>
          <span class="step-date">${dateText}</span>
        </div>
        <p class="step-desc">${descText}</p>
      </div>
    `;
  }).join('');
}

// ==========================================
// REAL-TIME LOGISTICAL OPERATIONS PANEL (FR-25)
// ==========================================
function setupSimulationPanel() {
  const panel = document.getElementById('simulation-panel');
  const user = getLoggedInUser();
  const o = activeTrackingPO;

  if (!panel) return;

  // Simulation is only allowed for Pejabat Pengadaan / Pokja / PPK operations roles, 
  // and only AFTER the PO is approved (Disetujui, Diproses, Dikirim)
  const allowedRoles = ['Pejabat Pengadaan', 'PPK', 'Pokja'];
  const trackingStatusList = ['Disetujui', 'Diproses', 'Dikirim'];

  if (user && allowedRoles.includes(user.role) && trackingStatusList.includes(o.status)) {
    panel.style.display = 'block';
    
    // Enable/disable specific steps controls depending on current logistics step
    const btnProcess = document.getElementById('sim-btn-process');
    const btnShip = document.getElementById('sim-btn-ship');
    const btnComplete = document.getElementById('sim-btn-complete');

    btnProcess.disabled = (o.status !== 'Disetujui');
    btnShip.disabled = (o.status !== 'Diproses');
    btnComplete.disabled = (o.status !== 'Dikirim');

    // visually dim disabled buttons
    btnProcess.style.opacity = o.status === 'Disetujui' ? '1' : '0.4';
    btnShip.style.opacity = o.status === 'Diproses' ? '1' : '0.4';
    btnComplete.style.opacity = o.status === 'Dikirim' ? '1' : '0.4';

  } else {
    panel.style.display = 'none';
  }
}

window.simulateLogisticsStep = function(nextStatus) {
  if (!activeTrackingPO) return;

  const orders = JSON.parse(localStorage.getItem('eproc_orders') || '[]');
  const index = orders.findIndex(o => o.id === activeTrackingPO.id);

  if (index > -1) {
    const now = new Date();
    const formatTime = now.getFullYear() + '-' + 
                       String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(now.getDate()).padStart(2, '0');

    let logNote = '';
    if (nextStatus === 'Diproses') {
      logNote = 'Barang sedang dipersiapkan dan dikemas oleh penyedia e-Katalog.';
    } else if (nextStatus === 'Dikirim') {
      logNote = 'Barang dalam perjalanan logistik menggunakan kurir logistik LKPP.';
    } else if (nextStatus === 'Selesai') {
      logNote = 'Barang sukses diterima di lokasi instansi. Berita Acara Serah Terima (BAST) sukses ditandatangani.';
    }

    // 1. Update status
    orders[index].status = nextStatus;
    orders[index].history.push({
      status: nextStatus,
      date: formatTime,
      note: logNote
    });

    window.saveToKV('eproc_orders', orders);

    // 2. Add dynamic operational alert notifications (FR-28, FR-29)
    addNotification(activeTrackingPO.creator, `🚚 Perubahan Status PO: ${activeTrackingPO.id} saat ini berstatus: ${nextStatus}.`);

    showToast(`Status Purchase Order diperbarui menjadi: ${nextStatus}!`, 'success');
    
    // Reload data inside tracking
    loadTracking(activeTrackingPO.id);
  }
}
