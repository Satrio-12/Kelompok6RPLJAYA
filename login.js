/**
 * login.js - Authentication & Role Redirection Logic
 * e-ProcureFlow Web Application
 */

document.addEventListener('DOMContentLoaded', () => {
  // If user is already logged in, redirect to dashboard
  const user = getLoggedInUser();
  if (user) {
    redirectToUserDashboard(user);
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

function handleLogin(e) {
  e.preventDefault();
  
  const usernameInput = document.getElementById('username').value.trim();
  const passwordInput = document.getElementById('password').value;
  const errorAlert = document.getElementById('login-error');

  errorAlert.style.display = 'none';

  // Retrieve users from database
  const users = JSON.parse(localStorage.getItem('eproc_users') || '[]');
  const foundUser = users.find(u => u.username.toLowerCase() === usernameInput.toLowerCase());

  // Password validation: simple simulation (password is username + "123")
  const expectedPassword = usernameInput.toLowerCase() + '123';

  if (foundUser && passwordInput === expectedPassword) {
    // Check if account is active (FR-07)
    if (!foundUser.active) {
      errorAlert.innerText = 'Akun Anda telah dinonaktifkan oleh Administrator.';
      errorAlert.style.display = 'block';
      return;
    }

    // Set secure mock session (FR-03)
    const sessionData = {
      username: foundUser.username,
      name: foundUser.name,
      role: foundUser.role,
      loginTime: new Date().toISOString()
    };
    
    localStorage.setItem('eproc_session', JSON.stringify(sessionData));
    
    // Toast notification
    showToast(`Selamat datang kembali, ${foundUser.name}!`, 'success');

    // Redirect based on role (FR-02)
    setTimeout(() => {
      redirectToUserDashboard(foundUser);
    }, 800);

  } else {
    // Authentication failed (FR-01)
    errorAlert.innerText = 'Username atau password salah!';
    errorAlert.style.display = 'block';
    
    // Add dynamic shake effect to card
    const card = document.querySelector('.login-card');
    card.style.animation = 'shake 0.4s ease-in-out';
    setTimeout(() => {
      card.style.animation = '';
    }, 400);
  }
}

// Fill credentials instantly for easy demo/testing
window.fillCredentials = function(username, password) {
  const usernameField = document.getElementById('username');
  const passwordField = document.getElementById('password');
  
  if (usernameField && passwordField) {
    usernameField.value = username;
    passwordField.value = password;
    showToast(`Form diisi dengan akun: ${username}`, 'info');
  }
};

function redirectToUserDashboard(user) {
  if (user.role === 'Admin') {
    window.location.href = 'manajemen-pengguna.html';
  } else {
    window.location.href = 'dashboard.html';
  }
}

// Add CSS keyframe shake dynamically for login failure
const style = document.createElement('style');
style.innerHTML = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }
`;
document.head.appendChild(style);
