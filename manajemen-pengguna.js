/**
 * manajemen-pengguna.js - Administrator User Management Controls (CRUD & RBAC)
 * e-ProcureFlow Web Application
 */

let allUsers = [];

document.addEventListener('DOMContentLoaded', () => {
  // Guard page: Strictly Admin role authorization (FR-02)
  requireAuth(['Admin']);

  loadUsers();
});

function loadUsers() {
  allUsers = JSON.parse(localStorage.getItem('eproc_users') || '[]');
  renderUsersTable();
}

function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  if (allUsers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">Belum ada data pengguna sistem.</td></tr>`;
    return;
  }

  tbody.innerHTML = allUsers.map(user => {
    // Dynamic styling for active vs inactive
    const activeLabel = user.active ? 'Aktif' : 'Nonaktif';
    const activeClass = user.active ? 'text-success' : 'text-danger';

    // Disable toggling for the active logged-in admin itself to prevent lockouts
    const sessionUser = getLoggedInUser();
    const isSelf = sessionUser && sessionUser.username === user.username;
    const disabledAttr = isSelf ? 'disabled' : '';

    return `
      <tr>
        <td><strong style="color: var(--primary); font-family: var(--font-heading);">${user.username}</strong></td>
        <td>${user.name}</td>
        <td><span class="user-role-badge">${user.role}</span></td>
        
        <!-- Interactive Activation Toggle Switch (FR-07) -->
        <td style="text-align: center;">
          <div class="status-cell">
            <label class="switch" style="transform: scale(0.85);" title="${isSelf ? 'Anda tidak dapat menonaktifkan akun sendiri.' : 'Aktifkan/Nonaktifkan Akun'}">
              <input type="checkbox" ${user.active ? 'checked' : ''} ${disabledAttr} onchange="toggleUserActivation('${user.username}')">
              <span class="slider round"></span>
            </label>
          </div>
        </td>

        <!-- CRUD Actions Block (FR-05, FR-06) -->
        <td>
          <div class="user-actions">
            <button class="btn btn-secondary" onclick="openEditUserModal('${user.username}')">Edit</button>
            <button class="btn btn-danger" ${disabledAttr} onclick="deleteUser('${user.username}')" title="${isSelf ? 'Anda tidak dapat menghapus akun sendiri.' : 'Hapus Pengguna'}">Hapus</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// 1. ACTIVATION & DEACTIVATION TOGGLE (FR-07)
// ==========================================
window.toggleUserActivation = function(username) {
  const users = JSON.parse(localStorage.getItem('eproc_users') || '[]');
  const index = users.findIndex(u => u.username === username);

  if (index > -1) {
    users[index].active = !users[index].active;
    localStorage.setItem('eproc_users', JSON.stringify(users));
    
    const activeState = users[index].active;
    
    if (activeState) {
      showToast(`Akun "${username}" berhasil DIAKTIFKAN.`, 'success');
    } else {
      showToast(`Akun "${username}" berhasil DITUTUP / NONAKTIF.`, 'warning');
    }

    loadUsers();
  }
};

// ==========================================
// 2. MODAL FORM OPEN & CLOSE (FR-05)
// ==========================================
window.openAddUserModal = function() {
  document.getElementById('user-form').reset();
  document.getElementById('edit-username-key').value = '';
  document.getElementById('form-username').disabled = false;
  
  document.getElementById('modal-form-title').innerText = 'Tambah Pengguna Baru';
  
  const modal = document.getElementById('user-form-modal');
  modal.classList.add('open');
};

window.openEditUserModal = function(username) {
  const user = allUsers.find(u => u.username === username);
  if (!user) return;

  document.getElementById('edit-username-key').value = user.username;
  
  // Fill input details
  const usernameField = document.getElementById('form-username');
  usernameField.value = user.username;
  usernameField.disabled = true; // Username cannot be modified on edit

  document.getElementById('form-name').value = user.name;
  document.getElementById('form-role').value = user.role;
  document.getElementById('form-active').checked = user.active;

  document.getElementById('modal-form-title').innerText = `Edit Pengguna: ${user.username}`;
  
  const modal = document.getElementById('user-form-modal');
  modal.classList.add('open');
};

window.closeUserFormModal = function() {
  document.getElementById('user-form-modal').classList.remove('open');
};

// ==========================================
// 3. CREATE & UPDATE LOGIC (FR-05, FR-06)
// ==========================================
window.saveUserForm = function(e) {
  e.preventDefault();

  const editKey = document.getElementById('edit-username-key').value;
  const username = document.getElementById('form-username').value.trim().toLowerCase();
  const name = document.getElementById('form-name').value.trim();
  const role = document.getElementById('form-role').value;
  const active = document.getElementById('form-active').checked;

  if (username === '' || name === '') {
    showToast('Harap isi semua input form!', 'warning');
    return;
  }

  const users = JSON.parse(localStorage.getItem('eproc_users') || '[]');

  if (editKey === '') {
    // ---- ADD MODE (CREATE) ----
    const exists = users.some(u => u.username.toLowerCase() === username);
    if (exists) {
      showToast(`Username "${username}" sudah terdaftar! Gunakan username lain.`, 'danger');
      document.getElementById('form-username').focus();
      return;
    }

    const newUser = { username, name, role, active };
    users.push(newUser);
    localStorage.setItem('eproc_users', JSON.stringify(users));
    showToast(`Pengguna "${username}" sukses didaftarkan!`, 'success');

  } else {
    // ---- EDIT MODE (UPDATE) ----
    const index = users.findIndex(u => u.username === editKey);
    if (index > -1) {
      users[index].name = name;
      users[index].role = role;
      users[index].active = active;
      
      localStorage.setItem('eproc_users', JSON.stringify(users));
      showToast(`Informasi profil "${editKey}" berhasil diperbarui.`, 'success');
    }
  }

  closeUserFormModal();
  loadUsers();
};

// ==========================================
// 4. DELETE USER LOGIC (FR-05)
// ==========================================
window.deleteUser = function(username) {
  const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus akun pengguna "${username}" secara permanen? Tindakan ini tidak dapat dibatalkan.`);
  if (!confirmDelete) return;

  const users = JSON.parse(localStorage.getItem('eproc_users') || '[]');
  const filteredUsers = users.filter(u => u.username !== username);

  localStorage.setItem('eproc_users', JSON.stringify(filteredUsers));
  showToast(`Akun pengguna "${username}" berhasil dihapus dari sistem.`, 'danger');
  
  loadUsers();
};
