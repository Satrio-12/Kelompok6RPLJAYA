/**
 * dashboard.js - Executive Dashboard Business Logic
 * e-ProcureFlow Web Application
 */

document.addEventListener('DOMContentLoaded', () => {
  // Guard this page (FR-02)
  requireAuth(['PA/KPA', 'PPK', 'Pejabat Pengadaan', 'Pokja']);
  
  renderDashboardData();
});

function renderDashboardData() {
  // Retrieve DB
  const orders = JSON.parse(localStorage.getItem('eproc_orders') || '[]');
  const budget = JSON.parse(localStorage.getItem('eproc_budget') || '{}');

  // --- 1. COMPUTE KEY METRICS (FR-23) ---
  const draftCount = orders.filter(o => o.status === 'Draft').length;
  const pendingCount = orders.filter(o => o.status === 'Menunggu Persetujuan').length;
  
  // Real count of approved (Disetujui, Diproses, Dikirim, Selesai are all functionally approved)
  const approvedStatusList = ['Disetujui', 'Diproses', 'Dikirim', 'Selesai'];
  const approvedCount = orders.filter(o => approvedStatusList.includes(o.status)).length;
  const totalCount = orders.length;

  // Insert into UI
  document.getElementById('count-draft').innerText = draftCount;
  document.getElementById('count-pending').innerText = pendingCount;
  document.getElementById('count-approved').innerText = approvedCount;
  document.getElementById('count-total').innerText = totalCount;

  // --- 2. BUDGET REAL-TIME MONITORING (FR-26) ---
  // Recalculate realized budget based on Approved orders in local database
  const approvedOrdersSum = orders
    .filter(o => approvedStatusList.includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);

  const totalPagu = budget.totalPagu || 5000000000;
  const realisasi = approvedOrdersSum;
  const sisa = totalPagu - realisasi;

  // Update localStorage with updated calculations for consistency
  const updatedBudget = { totalPagu, realisasi, sisa };
  window.saveToKV('eproc_budget', updatedBudget);

  // Display values
  document.getElementById('budget-total').innerText = formatRupiah(totalPagu);
  document.getElementById('budget-realized').innerText = formatRupiah(realisasi);
  document.getElementById('budget-remaining').innerText = formatRupiah(sisa);

  // Compute percentage
  const usagePercentage = totalPagu > 0 ? Math.round((realisasi / totalPagu) * 100) : 0;
  document.getElementById('budget-percentage').innerText = `${usagePercentage}% Terpakai`;
  
  // Animate progress bar fill
  const progressFill = document.getElementById('budget-progress-fill');
  if (progressFill) {
    // Timeout for smooth CSS transition trigger
    setTimeout(() => {
      progressFill.style.width = `${Math.min(usagePercentage, 100)}%`;
      
      // Warn user if budget is running low (FR-15 warning logic)
      if (usagePercentage > 90) {
        progressFill.style.background = 'var(--danger)';
      } else if (usagePercentage > 75) {
        progressFill.style.background = 'var(--warning)';
      }
    }, 150);
  }

  // --- 3. MORE STATS: AVG VALUE & PROVIDERS ---
  const avgPoVal = totalCount > 0 ? Math.round(orders.reduce((sum, o) => sum + o.total, 0) / totalCount) : 0;
  document.getElementById('stat-avg-po').innerText = formatRupiah(avgPoVal);

  // Count unique providers
  const providersSet = new Set();
  orders.forEach(o => {
    o.items.forEach(item => {
      if (item.provider) providersSet.add(item.provider);
    });
  });
  document.getElementById('stat-count-providers').innerText = `${providersSet.size} Penyedia`;

  // --- 4. DYNAMIC DONUT CHART RENDER (FR-23) ---
  const c = 251.2; // Circumference = 2 * pi * r = 2 * 3.14159 * 40
  
  const draftPercent = totalCount > 0 ? Math.round((draftCount / totalCount) * 100) : 0;
  const pendingPercent = totalCount > 0 ? Math.round((pendingCount / totalCount) * 100) : 0;
  const approvedPercent = totalCount > 0 ? (100 - draftPercent - pendingPercent) : 0; // Remainder to keep it exactly 100%

  document.getElementById('percent-draft').innerText = `${draftPercent}%`;
  document.getElementById('percent-pending').innerText = `${pendingPercent}%`;
  document.getElementById('percent-approved').innerText = `${approvedPercent}%`;

  // Center display shows the approved percentage
  document.getElementById('donut-center-val').innerText = `${approvedPercent}%`;

  // SVG dash arrays
  const strokeDraft = (draftPercent / 100) * c;
  const strokePending = (pendingPercent / 100) * c;
  const strokeApproved = (approvedPercent / 100) * c;

  const approvedRing = document.getElementById('donut-fill-approved');
  const pendingRing = document.getElementById('donut-fill-pending');
  const draftRing = document.getElementById('donut-fill-draft');

  if (approvedRing && pendingRing && draftRing) {
    // Approved slice starts at 0 offset
    approvedRing.setAttribute('stroke-dasharray', `${strokeApproved} ${c}`);
    
    // Pending slice offset is approved slice size
    pendingRing.setAttribute('stroke-dasharray', `${strokePending} ${c}`);
    pendingRing.setAttribute('stroke-dashoffset', `-${strokeApproved}`);
    
    // Draft slice offset is approved + pending size
    draftRing.setAttribute('stroke-dasharray', `${strokeDraft} ${c}`);
    draftRing.setAttribute('stroke-dashoffset', `-${strokeApproved + strokePending}`);
  }

  // --- 5. RENDER RECENT TRANSACTIONS TABLE (FR-23, FR-24) ---
  const recentTable = document.getElementById('recent-orders-table');
  if (recentTable) {
    if (orders.length === 0) {
      recentTable.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Belum ada data transaksi purchase order</td></tr>`;
      return;
    }

    // Sort by created date newest first, take 5
    const recentOrders = [...orders]
      .sort((a,b) => new Date(b.createdDate) - new Date(a.createdDate))
      .slice(0, 5);

    recentTable.innerHTML = recentOrders.map(o => {
      // Gather providers string
      const providers = Array.from(new Set(o.items.map(i => i.provider))).join(', ');
      
      let badgeClass = 'badge-draft';
      if (o.status === 'Menunggu Persetujuan') badgeClass = 'badge-pending';
      if (approvedStatusList.includes(o.status)) badgeClass = 'badge-approved';
      if (o.status === 'Ditolak') badgeClass = 'badge-rejected';

      return `
        <tr>
          <td><strong style="color: var(--primary); font-family: var(--font-heading);">${o.id}</strong></td>
          <td>${o.createdDate}</td>
          <td>${o.creator}</td>
          <td><div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${providers}">${providers}</div></td>
          <td><strong style="font-family: var(--font-heading);">${formatRupiah(o.total)}</strong></td>
          <td><span class="badge ${badgeClass}">${o.status}</span></td>
          <td>
            <a href="tracking.html?id=${o.id}" class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px;">Lacak</a>
          </td>
        </tr>
      `;
    }).join('');
  }
}
