/**
 * keranjang.js - Shopping Cart & Procurement Validations Engine
 * e-ProcureFlow Web Application
 */

let cartItems = [];
let sisaPagu = 0;

document.addEventListener('DOMContentLoaded', () => {
  // Guard page (FR-02)
  requireAuth(['PA/KPA', 'Pejabat Pengadaan', 'Pokja']);

  loadCartData();
});

function loadCartData() {
  cartItems = JSON.parse(localStorage.getItem('eproc_cart') || '[]');
  
  const budgetObj = JSON.parse(localStorage.getItem('eproc_budget') || '{}');
  sisaPagu = budgetObj.sisa || 0;

  renderCartTable();
  validateBudget();
  validateSKP();
}

function renderCartTable() {
  const tableBody = document.getElementById('cart-table-body');
  if (!tableBody) return;

  if (cartItems.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">Keranjang belanja kosong. Silakan tambahkan barang dari <a href="katalog.html" style="color: var(--primary); font-weight: 500;">e-Katalog</a>.</td></tr>`;
    document.getElementById('summary-qty').innerText = '0 unit';
    document.getElementById('summary-total').innerText = formatRupiah(0);
    return;
  }

  tableBody.innerHTML = cartItems.map(item => `
    <tr>
      <td><strong style="color: #fff;">${item.name}</strong></td>
      <td><span style="font-size: 0.8rem; color: var(--text-muted);">${item.provider}</span></td>
      <td>${formatRupiah(item.price)}</td>
      <td style="text-align: center;">
        <div class="qty-control">
          <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
        </div>
      </td>
      <td><strong style="color: #fff; font-family: var(--font-heading);">${formatRupiah(item.price * item.qty)}</strong></td>
      <td style="text-align: center;">
        <button class="delete-item-btn" onclick="deleteCartItem('${item.id}')" title="Hapus Barang">🗑️</button>
      </td>
    </tr>
  `).join('');

  // Update summary qty & total
  const totalQty = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const totalSum = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  document.getElementById('summary-qty').innerText = `${totalQty} unit`;
  document.getElementById('summary-total').innerText = formatRupiah(totalSum);
}

// ==========================================
// QUANTITY MANAGEMENT
// ==========================================
window.updateQty = function(id, change) {
  const index = cartItems.findIndex(item => item.id === id);
  if (index > -1) {
    cartItems[index].qty += change;
    
    // Minimum quantity limit
    if (cartItems[index].qty < 1) cartItems[index].qty = 1;
    
    localStorage.setItem('eproc_cart', JSON.stringify(cartItems));
    loadCartData();
  }
};

window.deleteCartItem = function(id) {
  cartItems = cartItems.filter(item => item.id !== id);
  localStorage.setItem('eproc_cart', JSON.stringify(cartItems));
  loadCartData();
  showToast('Barang dihapus dari keranjang.', 'warning');
};

// ==========================================
// BUDGET THRESHOLD VALIDATION (FR-15)
// ==========================================
function validateBudget() {
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const projectedSisa = sisaPagu - cartTotal;

  document.getElementById('valid-budget-remaining').innerText = formatRupiah(sisaPagu);
  document.getElementById('valid-cart-total').innerText = formatRupiah(cartTotal);
  
  const projectedText = document.getElementById('valid-budget-projected');
  projectedText.innerText = formatRupiah(projectedSisa);

  const budgetFill = document.getElementById('valid-budget-fill');
  const statusMsg = document.getElementById('valid-status-message');
  const checkoutBtn = document.getElementById('btn-submit-po');

  // Calculate projected usage percentage of original Pagu
  const budgetObj = JSON.parse(localStorage.getItem('eproc_budget') || '{}');
  const totalPagu = budgetObj.totalPagu || 5000000000;
  
  const usagePercentage = Math.round((cartTotal / sisaPagu) * 100);
  
  if (budgetFill) {
    setTimeout(() => {
      budgetFill.style.width = `${Math.min(usagePercentage, 100)}%`;
    }, 100);
  }

  if (projectedSisa < 0) {
    // Exceeded Budget limit
    projectedText.style.color = 'var(--danger)';
    if (budgetFill) budgetFill.style.background = 'var(--danger)';
    
    statusMsg.className = 'budget-status-message text-danger';
    statusMsg.innerHTML = '❌ Peringatan: Total belanja melebihi sisa Pagu Anggaran unit! Silakan kurangi volume pengadaan.';
    
    if (checkoutBtn) checkoutBtn.disabled = true;
    showToast('Validasi Gagal: Anggaran pagu unit tidak mencukupi!', 'danger');
  } else {
    // Budget is sufficient
    projectedText.style.color = 'var(--success)';
    if (budgetFill) budgetFill.style.background = 'linear-gradient(to right, var(--primary), var(--secondary))';
    
    statusMsg.className = 'budget-status-message text-success';
    statusMsg.innerHTML = '✅ Validasi Sukses: Anggaran mencukupi. Pengadaan dapat dilanjutkan.';
    
    if (checkoutBtn) checkoutBtn.disabled = false;
  }
}

// ==========================================
// SUPPLIER QUALITY CROSSCHECK (FR-16)
// ==========================================
function validateSKP() {
  const skpBanner = document.getElementById('skp-warning-banner');
  if (!skpBanner) return;

  // Check if any item has SKP < 2.5
  const hasBadSupplier = cartItems.some(item => item.skp < 2.5);

  if (hasBadSupplier) {
    skpBanner.style.display = 'block';
  } else {
    skpBanner.style.display = 'none';
  }
}

// ==========================================
// PO CHECKOUT SUBMISSION (FR-13, FR-14, FR-17)
// ==========================================
window.checkoutPurchaseOrder = function(targetStatus) {
  if (cartItems.length === 0) {
    showToast('Keranjang belanja kosong! Silakan berbelanja terlebih dahulu.', 'danger');
    return;
  }

  // Double check SKP verification just-in-case (FR-16)
  const hasBadSupplier = cartItems.some(item => item.skp < 2.5);
  const justificationField = document.getElementById('skp-justification');
  
  if (hasBadSupplier && targetStatus === 'Menunggu Persetujuan') {
    if (!justificationField || justificationField.value.trim() === '') {
      showToast('Wajib menuliskan justifikasi pemilihan penyedia SKP Rendah!', 'warning');
      justificationField.focus();
      justificationField.style.borderColor = 'var(--danger)';
      return;
    }
  }

  const sessionUser = getLoggedInUser();
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Generate unique PO sequence ID
  const poIndex = Math.floor(1000 + Math.random() * 9000);
  const poId = `PO-2026-${poIndex}`;

  const now = new Date();
  const formatTime = now.getFullYear() + '-' + 
                     String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(now.getDate()).padStart(2, '0');

  // Construct history progress log (FR-18, FR-24)
  const historyLog = [
    { status: 'Draft', date: formatTime, note: 'Draft purchase order dibuat.' }
  ];

  if (targetStatus === 'Menunggu Persetujuan') {
    historyLog.push({
      status: 'Menunggu Persetujuan',
      date: formatTime,
      note: `Dikirim ke PPK oleh ${sessionUser.name} untuk proses approval.`
    });
  }

  const newPO = {
    id: poId,
    creator: sessionUser.username,
    items: [...cartItems],
    total: cartTotal,
    status: targetStatus,
    createdDate: formatTime,
    approvedDate: '',
    history: historyLog,
    tteHash: '',
    tteUser: '',
    catatanPenolakan: '',
    justifikasiSKP: hasBadSupplier ? justificationField.value.trim() : ''
  };

  // Save PO to DB
  const orders = JSON.parse(localStorage.getItem('eproc_orders') || '[]');
  orders.push(newPO);
  localStorage.setItem('eproc_orders', JSON.stringify(orders));

  // If submitted, alert PPK via system notifications (FR-17, FR-29)
  if (targetStatus === 'Menunggu Persetujuan') {
    addNotification('ppk', `Terdapat Purchase Order (${poId}) baru dari ${sessionUser.name} senilai ${formatRupiah(cartTotal)} menunggu approval Anda.`);
    showToast(`Purchase Order ${poId} berhasil dibuat dan dikirim ke PPK!`, 'success');
  } else {
    showToast(`Purchase Order ${poId} disimpan sebagai Draft.`, 'success');
  }

  // Clear checkout shopping cart
  localStorage.removeItem('eproc_cart');

  // Redirection delay
  setTimeout(() => {
    if (targetStatus === 'Menunggu Persetujuan') {
      window.location.href = `tracking.html?id=${poId}`;
    } else {
      window.location.href = 'purchase.html';
    }
  }, 1000);
};
