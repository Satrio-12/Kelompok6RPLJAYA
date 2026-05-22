/**
 * approval.js - Procurement Workflow Approvals & BSrE Digital Signatures
 * e-ProcureFlow Web Application
 */

let submittedPOs = [];
let selectedPO = null;

document.addEventListener('DOMContentLoaded', () => {
  // Guard page (FR-02)
  requireAuth(['PA/KPA', 'PPK']);

  setupDelegationUI();
  loadApprovals();
});

// ==========================================
// 1. DELEGATION WORKFLOW MANAGEMENT (FR-21)
// ==========================================
function setupDelegationUI() {
  const user = getLoggedInUser();
  const delegationPanel = document.getElementById('delegation-panel');
  const checkbox = document.getElementById('delegation-toggle-checkbox');
  const label = document.getElementById('delegation-status-label');

  if (!delegationPanel) return;

  // Delegation state in LocalStorage
  const delegationActive = localStorage.getItem('eproc_delegation_active') === 'true';
  checkbox.checked = delegationActive;
  updateDelegationLabel(delegationActive);

  if (user.role === 'PPK') {
    // PPK can delegate authority
    delegationPanel.style.display = 'flex';
    checkbox.disabled = false;
  } else if (user.role === 'PA/KPA') {
    // PA/KPA can view delegation status or override if delegated
    delegationPanel.style.display = 'flex';
    checkbox.disabled = true; // PA/KPA cannot toggle themselves
    
    if (delegationActive) {
      showToast('Wewenang Approval PPK saat ini didelegasikan penuh kepada Anda!', 'info');
    }
  }
}

window.toggleDelegation = function() {
  const checkbox = document.getElementById('delegation-toggle-checkbox');
  const isActive = checkbox.checked;
  
  localStorage.setItem('eproc_delegation_active', String(isActive));
  updateDelegationLabel(isActive);
  
  const user = getLoggedInUser();
  
  if (isActive) {
    addNotification('pakpa', `${user.name} (PPK) telah mendelegasikan wewenang persetujuan Purchase Order kepada Anda.`);
    showToast('Wewenang approval sukses didelegasikan ke PA/KPA!', 'success');
  } else {
    showToast('Delegasi dinonaktifkan. Wewenang approval dikembalikan ke PPK.', 'warning');
  }

  // Reload approvals list to update action button permissions
  loadApprovals();
};

function updateDelegationLabel(isActive) {
  const label = document.getElementById('delegation-status-label');
  if (label) {
    if (isActive) {
      label.innerText = 'AKTIF (PA/KPA Diberikan Wewenang)';
      label.style.color = 'var(--success)';
    } else {
      label.innerText = 'TIDAK AKTIF (Hanya PPK Utama)';
      label.style.color = 'var(--text-muted)';
    }
  }
}

// ==========================================
// 2. LOADING & RENDERING APPROVALS (FR-19)
// ==========================================
function loadApprovals() {
  const orders = JSON.parse(localStorage.getItem('eproc_orders') || '[]');
  
  // Filter for orders waiting for approval
  submittedPOs = orders.filter(o => o.status === 'Menunggu Persetujuan');

  renderApprovalsList();
}

function renderApprovalsList() {
  const stack = document.getElementById('approvals-cards-stack');
  if (!stack) return;

  if (submittedPOs.length === 0) {
    stack.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px;">Tidak ada pengajuan Purchase Order baru saat ini.</div>`;
    document.getElementById('empty-review-state').style.display = 'flex';
    document.getElementById('active-review-state').style.display = 'none';
    return;
  }

  stack.innerHTML = submittedPOs.map(o => `
    <div class="mini-po-card ${selectedPO && selectedPO.id === o.id ? 'selected' : ''}" onclick="selectPOForReview('${o.id}')">
      <div class="mini-info">
        <h4>${o.id}</h4>
        <p>Tanggal: ${o.createdDate} | Oleh: ${o.creator}</p>
      </div>
      <div class="mini-total">${formatRupiah(o.total)}</div>
    </div>
  `).join('');
}

window.selectPOForReview = function(id) {
  selectedPO = submittedPOs.find(o => o.id === id);
  if (!selectedPO) return;

  // Re-render list to show active selection border highlight
  renderApprovalsList();

  // Reveal review panel
  document.getElementById('empty-review-state').style.display = 'none';
  const activePanel = document.getElementById('active-review-state');
  activePanel.style.display = 'flex';

  // Fill review panel fields
  document.getElementById('review-po-id').innerText = selectedPO.id;
  document.getElementById('review-po-creator').innerText = selectedPO.creator;
  document.getElementById('review-po-date').innerText = selectedPO.createdDate;
  document.getElementById('review-po-total').innerText = formatRupiah(selectedPO.total);

  // Render specifications checklist side-by-side (FR-10)
  const itemsContainer = document.getElementById('review-items-list-container');
  itemsContainer.innerHTML = selectedPO.items.map(item => `
    <div class="review-item-row">
      <div style="display: flex; justify-content: space-between; font-weight: 600;">
        <span>${item.name} (${item.qty} unit)</span>
        <span>${formatRupiah(item.price * item.qty)}</span>
      </div>
      <p><strong>Spesifikasi e-Katalog:</strong> Dilengkapi verifikasi spesifikasi LKPP Nasional. Nilai SKP: ⭐️ ${item.skp}/5.0</p>
    </div>
  `).join('');

  // Handle SKP Low justificaton details (FR-16)
  const skpBlock = document.getElementById('review-skp-warning');
  if (selectedPO.justifikasiSKP) {
    skpBlock.style.display = 'block';
    document.getElementById('review-skp-justification-text').innerText = `"${selectedPO.justifikasiSKP}"`;
  } else {
    skpBlock.style.display = 'none';
  }

  // Authorization Check: PPK and PA/KPA permission check (FR-21)
  const user = getLoggedInUser();
  const delegationActive = localStorage.getItem('eproc_delegation_active') === 'true';
  const approveBtn = document.getElementById('btn-approve');

  if (user.role === 'PA/KPA' && !delegationActive) {
    // PA/KPA viewing but delegation is NOT active (Disabled button)
    approveBtn.disabled = true;
    approveBtn.innerText = 'Approval Ditutup (Menunggu Delegasi PPK)';
    approveBtn.style.opacity = '0.5';
  } else {
    approveBtn.disabled = false;
    approveBtn.innerText = 'Setujui & Tanda Tangan TTE';
    approveBtn.style.opacity = '1';
  }
}

// ==========================================
// 3. APPROVAL WORKFLOW WITH BSRE SIGNATURE (FR-22)
// ==========================================
window.openBSrEModal = function() {
  if (!selectedPO) return;
  document.getElementById('bsre-passphrase').value = '';
  document.getElementById('bsre-error').style.display = 'none';
  document.getElementById('bsre-loading-view').style.display = 'none';
  
  const modal = document.getElementById('bsre-modal');
  modal.classList.add('open');
};

window.closeBSrEModal = function() {
  document.getElementById('bsre-modal').classList.remove('open');
};

window.processBSrESignature = function() {
  const pinInput = document.getElementById('bsre-passphrase').value;
  const errorAlert = document.getElementById('bsre-error');
  const user = getLoggedInUser();

  errorAlert.style.display = 'none';

  // Demo passphrases standard: username + 123 (e.g. ppk123, pa123)
  const expectedPin = user.username + '123';

  if (pinInput !== expectedPin) {
    errorAlert.innerText = 'Passphrase / PIN TTE Anda tidak valid! Silakan gunakan PIN Demo Anda.';
    errorAlert.style.display = 'block';
    return;
  }

  // PIN Valid, trigger BSrE connecting animation steps (FR-22 details)
  const loader = document.getElementById('bsre-loading-view');
  const loaderText = document.getElementById('bsre-loading-text');
  const progressFill = document.getElementById('bsre-progress-bar');

  loader.style.display = 'flex';
  
  const steps = [
    { percent: 10, text: 'Menghubungkan Server Otoritas BSrE LKPP...' },
    { percent: 35, text: 'Melakukan Kriptografi Handshake...' },
    { percent: 60, text: 'Menghitung SHA-256 Hash Dokumen Purchase Order...' },
    { percent: 85, text: 'Menyematkan Sertifikat QR TTE dan Stempel Digital...' },
    { percent: 100, text: 'Sertifikasi Sukses! Mengunci Dokumen PO...' }
  ];

  let currentStep = 0;
  
  const interval = setInterval(() => {
    if (currentStep < steps.length) {
      const step = steps[currentStep];
      loaderText.innerText = step.text;
      progressFill.style.width = `${step.percent}%`;
      currentStep++;
    } else {
      clearInterval(interval);
      executeApprovalSuccess();
    }
  }, 600);
}

function executeApprovalSuccess() {
  const user = getLoggedInUser();
  const orders = JSON.parse(localStorage.getItem('eproc_orders') || '[]');
  const index = orders.findIndex(o => o.id === selectedPO.id);

  if (index > -1) {
    const now = new Date();
    const formatTime = now.getFullYear() + '-' + 
                       String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(now.getDate()).padStart(2, '0');

    // Generate SHA-256 mockup TTE
    const hash = 'SHA-256:' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9) + 'e883fc5148';

    // 1. Update PO details
    orders[index].status = 'Disetujui';
    orders[index].approvedDate = formatTime;
    orders[index].tteHash = hash;
    orders[index].tteUser = user.username;
    orders[index].history.push({
      status: 'Disetujui',
      date: formatTime,
      note: `Disetujui resmi oleh PPK ${user.name} menggunakan Tanda Tangan Elektronik terverifikasi BSrE.`
    });

    window.saveToKV('eproc_orders', orders);

    // 2. Realize Budget sum subtraction (FR-26)
    const budgetObj = JSON.parse(localStorage.getItem('eproc_budget') || '{}');
    const totalPagu = budgetObj.totalPagu || 5000000000;
    
    // Sum all approved/completed orders to derive correct realization
    const approvedStatusList = ['Disetujui', 'Diproses', 'Dikirim', 'Selesai'];
    const approvedSum = orders
      .filter(o => approvedStatusList.includes(o.status))
      .reduce((sum, o) => sum + o.total, 0);

    const updatedBudget = {
      totalPagu: totalPagu,
      realisasi: approvedSum,
      sisa: totalPagu - approvedSum
    };
    window.saveToKV('eproc_budget', updatedBudget);

    // 3. Emit trigger email notifications (FR-28, FR-29)
    addNotification(selectedPO.creator, `Purchase Order (${selectedPO.id}) Anda senilai ${formatRupiah(selectedPO.total)} telah DISETUJUI oleh PPK Ahmad Subarjo S.T. dengan stempel TTE resmi.`);

    showToast(`Purchase Order ${selectedPO.id} sukses disetujui dan ditandatangani!`, 'success');
    
    closeBSrEModal();
    selectedPO = null;
    loadApprovals();
  }
}

// ==========================================
// 4. REJECTION WORKFLOW NOTES (FR-20)
// ==========================================
window.openRejectModal = function() {
  if (!selectedPO) return;
  document.getElementById('reject-notes').value = '';
  document.getElementById('reject-modal').classList.add('open');
};

window.closeRejectModal = function() {
  document.getElementById('reject-modal').classList.remove('open');
};

window.submitRejection = function() {
  const notes = document.getElementById('reject-notes').value.trim();
  if (notes === '') {
    showToast('Harap isi alasan penolakan!', 'warning');
    return;
  }

  const user = getLoggedInUser();
  const orders = JSON.parse(localStorage.getItem('eproc_orders') || '[]');
  const index = orders.findIndex(o => o.id === selectedPO.id);

  if (index > -1) {
    const now = new Date();
    const formatTime = now.getFullYear() + '-' + 
                       String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(now.getDate()).padStart(2, '0');

    // Update PO details
    orders[index].status = 'Ditolak';
    orders[index].catatanPenolakan = notes;
    orders[index].history.push({
      status: 'Ditolak',
      date: formatTime,
      note: `Pengajuan ditolak oleh PPK Ahmad Subarjo S.T. Alasan: "${notes}"`
    });

    window.saveToKV('eproc_orders', orders);

    // Emit notification to creator (FR-29)
    addNotification(selectedPO.creator, `❌ Purchase Order (${selectedPO.id}) Anda DITOLAK oleh PPK. Alasan: "${notes}"`);
    showToast(`Purchase Order ${selectedPO.id} telah ditolak.`, 'danger');

    closeRejectModal();
    selectedPO = null;
    loadApprovals();
  }
}
