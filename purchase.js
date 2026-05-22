/**
 * purchase.js - Purchase Order Management and Invoice sheet viewer
 * e-ProcureFlow Web Application
 */

let activeStatusFilter = 'All';
let allOrders = [];

document.addEventListener('DOMContentLoaded', () => {
  // Guard page (FR-02)
  requireAuth(['PA/KPA', 'PPK', 'Pejabat Pengadaan', 'Pokja']);

  loadPurchaseOrders();
});

function loadPurchaseOrders() {
  allOrders = JSON.parse(localStorage.getItem('eproc_orders') || '[]');
  
  // Filter based on logged-in user role
  const user = getLoggedInUser();
  if (user && !['PPK', 'PA/KPA'].includes(user.role)) {
    // Standard creators (Pejabat Pengadaan or Pokja) can only see their own POs
    allOrders = allOrders.filter(o => o.creator === user.username);
  }

  renderPOList();
}

window.filterPOStatus = function(status) {
  activeStatusFilter = status;
  
  // Update active tab visual
  const tabs = document.querySelectorAll('.status-tab');
  tabs.forEach(tab => {
    if (tab.innerText.toLowerCase().includes(status.toLowerCase()) || 
        (status === 'All' && tab.innerText.includes('Semua'))) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  renderPOList();
};

function renderPOList() {
  const container = document.getElementById('po-cards-container');
  if (!container) return;

  let filtered = [...allOrders];
  if (activeStatusFilter !== 'All') {
    filtered = filtered.filter(o => o.status === activeStatusFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="glass-card" style="text-align: center; padding: 40px; color: var(--text-muted);">Tidak ada transaksi purchase order dalam status "${activeStatusFilter}".</div>`;
    return;
  }

  // Sort newest first
  filtered.sort((a,b) => new Date(b.createdDate) - new Date(a.createdDate));

  container.innerHTML = filtered.map(o => {
    const totalQty = o.items.reduce((sum, i) => sum + i.qty, 0);
    const providers = Array.from(new Set(o.items.map(i => i.provider))).join(', ');
    
    let badgeClass = 'badge-draft';
    let poClass = 'po-draft';
    if (o.status === 'Menunggu Persetujuan') { badgeClass = 'badge-pending'; poClass = 'po-pending'; }
    else if (['Disetujui', 'Diproses', 'Dikirim', 'Selesai'].includes(o.status)) { badgeClass = 'badge-approved'; poClass = 'po-approved'; }
    else if (o.status === 'Ditolak') { badgeClass = 'badge-rejected'; poClass = 'po-rejected'; }

    return `
      <div class="glass-card po-card ${poClass}">
        <div class="po-info-block">
          <span class="po-id-text">${o.id}</span>
          <span class="po-date">Dibuat: ${o.createdDate} | Pembuat: ${o.creator}</span>
          <p class="po-items-summary" title="${providers}">${providers}</p>
        </div>

        <div class="po-sum-block">
          <span class="price-label">${totalQty} unit barang</span>
          <div class="po-price-large">${formatRupiah(o.total)}</div>
        </div>

        <div>
          <span class="badge ${badgeClass}">${o.status}</span>
        </div>

        <div class="po-actions-group">
          <button class="btn btn-secondary" onclick="openPODocumentModal('${o.id}')">Review Dokumen</button>
          <a href="tracking.html?id=${o.id}" class="btn btn-primary">Lacak</a>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// INTERACTIVE OFFICIAL INVOICE MODAL (FR-13, FR-22)
// ==========================================
window.openPODocumentModal = function(id) {
  // Find order in master list (not just filtered/scoped list)
  const masterOrders = JSON.parse(localStorage.getItem('eproc_orders') || '[]');
  const o = masterOrders.find(order => order.id === id);
  if (!o) return;

  const invoiceSheet = document.getElementById('invoice-sheet-body');
  if (!invoiceSheet) return;

  // Build items rows
  const itemsRows = o.items.map((item, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td><strong>${item.name}</strong></td>
      <td>${item.provider}</td>
      <td style="text-align: center;">${item.qty}</td>
      <td style="text-align: right;">${formatRupiah(item.price)}</td>
      <td style="text-align: right; font-weight: 600;">${formatRupiah(item.price * item.qty)}</td>
    </tr>
  `).join('');

  // BSrE signature digital seal section (FR-22)
  let tteSection = '';
  if (o.status === 'Disetujui' && o.tteHash) {
    tteSection = `
      <div class="invoice-bsre-seal">
        <div class="seal-qr">🔑</div>
        <div class="seal-info">
          <h5>TANDA TANGAN DIGITAL TERVERIFIKASI</h5>
          <p>Dokumen Purchase Order ini telah ditandatangani secara elektronik oleh <strong>Ahmad Subarjo S.T. (PPK)</strong> menggunakan sertifikat elektronik BSrE (Balai Sertifikasi Elektronik) LKPP pada tanggal ${o.approvedDate}.</p>
          <span class="seal-hash">${o.tteHash}</span>
        </div>
      </div>
    `;
  } else if (o.status === 'Ditolak') {
    tteSection = `
      <div style="background: #fef2f2; border: 1px solid #f87171; color: #b91c1c; border-radius: 6px; padding: 16px; margin-top: 16px;">
        <h5 style="font-weight: 700; font-size: 0.85rem; margin-bottom: 4px;">CATATAN PENOLAKAN PPK:</h5>
        <p style="font-size: 0.8rem; line-height: 1.5;">"${o.catatanPenolakan || 'Tidak ada catatan tertulis.'}"</p>
      </div>
    `;
  } else if (o.status === 'Menunggu Persetujuan') {
    tteSection = `
      <div style="background: #fef3c7; border: 1px dashed #f59e0b; color: #b45309; border-radius: 6px; padding: 16px; margin-top: 16px; text-align: center; font-size: 0.8rem; font-weight: 500;">
        ⏳ Menunggu verifikasi dan Tanda Tangan Digital (TTE) pejabat PPK Ahmad Subarjo S.T.
      </div>
    `;
  } else {
    tteSection = `
      <div style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; border-radius: 6px; padding: 16px; margin-top: 16px; text-align: center; font-size: 0.8rem;">
        📝 Dokumen berstatus DRAFT. Belum diajukan ke PPK untuk proses persetujuan dan TTE.
      </div>
    `;
  }

  // Justification SKP notice if present (FR-16)
  let skpJustifSection = '';
  if (o.justifikasiSKP) {
    skpJustifSection = `
      <div style="margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 4px; padding: 16px; background: #f8fafc;">
        <h5 style="font-weight: 700; font-size: 0.8rem; color: #475569; text-transform: uppercase; margin-bottom: 6px;">Justifikasi Teknis Pemilihan Penyedia Kinerja Khusus</h5>
        <p style="font-size: 0.8rem; font-style: italic; color: #334155; line-height: 1.5;">"${o.justifikasiSKP}"</p>
      </div>
    `;
  }

  // Populate whole invoice sheet
  invoiceSheet.innerHTML = `
    <!-- Header Invoice LKPP -->
    <div class="invoice-header-lkpp">
      <div class="lkpp-logo-mock">
        <div class="lkpp-icon">LK</div>
        <div class="lkpp-title-block">
          <h3>e-Purchasing LKPP Nasional</h3>
          <p>Sistem Informasi Pengadaan Barang dan Jasa Pemerintah</p>
        </div>
      </div>
      <div class="invoice-title-block">
        <h2>PURCHASE ORDER</h2>
        <p>Nomor: ${o.id}</p>
      </div>
    </div>

    <!-- Metadata Info -->
    <div class="invoice-meta-grid">
      <div class="meta-col">
        <h4>Detail Pengadaan:</h4>
        <p>Tanggal Ajuan: <strong>${o.createdDate}</strong></p>
        <p>Pejabat Pembuat Komitmen: <strong>Ahmad Subarjo S.T.</strong></p>
        <p>Unit Pembuat PO: <strong>${o.creator}</strong></p>
      </div>
      <div class="meta-col">
        <h4>Status Transaksi:</h4>
        <p>Status: <strong style="text-transform: uppercase;">${o.status}</strong></p>
        <p>Tanggal Disetujui: <strong>${o.approvedDate || '-'}</strong></p>
      </div>
    </div>

    <!-- Items Table -->
    <table class="invoice-items-table">
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">No</th>
          <th>Nama Barang</th>
          <th>Penyedia e-Katalog</th>
          <th style="width: 60px; text-align: center;">Qty</th>
          <th style="text-align: right; width: 140px;">Harga Satuan</th>
          <th style="text-align: right; width: 140px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="invoice-total-section">
      <div class="invoice-total-box">
        <div class="invoice-total-row">
          <span>Subtotal</span>
          <span>${formatRupiah(o.total)}</span>
        </div>
        <div class="invoice-total-row">
          <span>PPN (11%)</span>
          <span>Bebas PPN Pemerintah</span>
        </div>
        <div class="invoice-total-row">
          <span>Total Pengadaan</span>
          <span>${formatRupiah(o.total)}</span>
        </div>
      </div>
    </div>

    <!-- BSrE Seal -->
    ${tteSection}

    <!-- Justification -->
    ${skpJustifSection}
  `;

  // Handle Draft PO actions buttons
  const submitDraftBtn = document.getElementById('modal-btn-submit-draft');
  const user = getLoggedInUser();
  
  if (o.status === 'Draft' && user.username === o.creator) {
    submitDraftBtn.style.display = 'block';
    submitDraftBtn.onclick = () => {
      submitDraftPO(o.id);
    };
  } else {
    submitDraftBtn.style.display = 'none';
  }

  // Open overlay
  const overlay = document.getElementById('po-document-modal');
  overlay.classList.add('open');
};

window.closePODocumentModal = function() {
  const overlay = document.getElementById('po-document-modal');
  overlay.classList.remove('open');
};

// ==========================================
// SUBMIT DRAFT PO TO PPK (FR-14, FR-17)
// ==========================================
function submitDraftPO(poId) {
  const masterOrders = JSON.parse(localStorage.getItem('eproc_orders') || '[]');
  const index = masterOrders.findIndex(o => o.id === poId);
  
  if (index > -1) {
    const now = new Date();
    const formatTime = now.getFullYear() + '-' + 
                       String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(now.getDate()).padStart(2, '0');

    // Update PO details
    masterOrders[index].status = 'Menunggu Persetujuan';
    masterOrders[index].history.push({
      status: 'Menunggu Persetujuan',
      date: formatTime,
      note: 'Draft purchase order diajukan ke PPK oleh pembuat.'
    });

    window.saveToKV('eproc_orders', masterOrders);

    // Send notifications to PPK
    addNotification('ppk', `Terdapat Purchase Order (${poId}) baru diajukan oleh pembuat menunggu approval Anda.`);
    showToast(`Purchase Order ${poId} berhasil diajukan ke PPK!`, 'success');
    
    closePODocumentModal();
    loadPurchaseOrders(); // Refresh table
  }
}

// ==========================================
// SIMULATE DOWLOAD PDF & PRINT (FR-13)
// ==========================================
window.simulatePrintPO = function() {
  showToast('Mempersiapkan dokumen cetak e-Procurement...', 'info');
  
  setTimeout(() => {
    // Open standard browser window.print dialog for PO preview sheet
    const printContents = document.getElementById('po-document-print-area').innerHTML;
    const originalContents = document.body.innerHTML;

    // Create a beautifully styled window popup to trigger print simulation cleanly
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Purchase Order</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; background: white; color: #1e293b; }
            .official-invoice-sheet { border: none; padding: 0; box-shadow: none; }
            .invoice-header-lkpp { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
            .lkpp-logo-mock { display: flex; align-items: center; gap: 12px; }
            .lkpp-icon { width: 40px; height: 40px; background: #1e3a8a; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-family: sans-serif; font-weight: 800; font-size: 1.2rem; }
            .lkpp-title-block h3 { margin: 0; font-size: 1rem; color: #1e3a8a; }
            .lkpp-title-block p { margin: 0; font-size: 0.65rem; color: #64748b; }
            .invoice-title-block h2 { margin: 0; font-size: 1.3rem; }
            .invoice-title-block p { margin: 0; font-size: 0.75rem; }
            .invoice-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .meta-col h4 { font-size: 0.75rem; text-transform: uppercase; color: #64748b; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; }
            .meta-col p { margin: 2px 0; font-size: 0.8rem; }
            .invoice-items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.78rem; }
            .invoice-items-table th { background: #f8fafc; border-bottom: 2px solid #cbd5e1; padding: 8px; text-align: left; }
            .invoice-items-table td { border-bottom: 1px solid #e2e8f0; padding: 8px; }
            .invoice-total-section { display: flex; justify-content: flex-end; }
            .invoice-total-box { width: 220px; border: 1px solid #cbd5e1; padding: 12px; }
            .invoice-total-row { display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 6px; }
            .invoice-total-row:last-child { border-top: 1px solid #cbd5e1; padding-top: 6px; font-weight: 700; }
            .invoice-bsre-seal { display: flex; align-items: center; gap: 12px; border: 1px dashed #22c55e; border-radius: 4px; padding: 12px; font-size: 0.78rem; margin-top: 16px; color: #15803d; background: #f0fdf4; }
            .seal-qr { font-size: 1.5rem; }
            .seal-hash { font-family: monospace; font-size: 0.6rem; }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="official-invoice-sheet">
            ${printContents}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    showToast('Download PO.pdf Terverifikasi Berhasil!', 'success');
  }, 1000);
};
