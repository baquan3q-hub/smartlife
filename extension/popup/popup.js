// File: extension/popup/popup.js
const SUPABASE_URL = 'https://toanywkdbhfqdfvtrrzm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvYW55d2tkYmhmcWRmdnRycnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODAxNTgsImV4cCI6MjA4MzQ1NjE1OH0.Qv1CNBk3BTLC2v2YEhNEE1F8giIsifBhy4_AOzNmekQ';

let currentUser = null;
let currentToken = null;
let currentTab = null;
let selectedLabels = ['Work'];

// DOM Elements
const authStatusText = document.getElementById('authStatusText');
const btnOpenWeb = document.getElementById('btnOpenWeb');
const btnToggleAuth = document.getElementById('btnToggleAuth');
const btnLogout = document.getElementById('btnLogout');
const quickSyncBanner = document.getElementById('quickSyncBanner');
const btnAutoSyncTab = document.getElementById('btnAutoSyncTab');
const btnAutoSyncInside = document.getElementById('btnAutoSyncInside');
const loginPanel = document.getElementById('loginPanel');
const btnCloseLogin = document.getElementById('btnCloseLogin');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const currentTabTitle = document.getElementById('currentTabTitle');
const chkAttachSource = document.getElementById('chkAttachSource');
const noteContent = document.getElementById('noteContent');
const wordCount = document.getElementById('wordCount');
const labelsGrid = document.getElementById('labelsGrid');
const btnSaveNote = document.getElementById('btnSaveNote');
const btnSaveText = document.getElementById('btnSaveText');
const statusToast = document.getElementById('statusToast');

// 1. Khởi tạo khi mở Popup
document.addEventListener('DOMContentLoaded', async () => {
  // Lấy thông tin Tab hiện tại
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      currentTab = tabs[0];
      currentTabTitle.textContent = currentTab.title || currentTab.url || 'Trang web hiện tại';
      currentTabTitle.title = currentTab.url || '';
    }
  } catch {
    currentTabTitle.textContent = 'Không xác định được trang';
  }

  // Kiểm tra Auth trước, nếu chưa có thì thử tự động quét tab web đang mở
  await checkAuthStatus();
  if (!currentUser) {
    await autoDetectSessionFromSmartLifeTabs(false);
  }

  // Đếm từ khi gõ
  noteContent.addEventListener('input', () => {
    const text = noteContent.value.trim();
    const count = text ? text.split(/\s+/).length : 0;
    wordCount.textContent = `${count} từ`;
  });

  // Phím tắt Ctrl + Enter để lưu
  noteContent.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveNote();
    }
  });

  // Bắt sự kiện chọn nhãn
  labelsGrid.querySelectorAll('.label-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.dataset.label;
      if (selectedLabels.includes(label)) {
        if (selectedLabels.length > 1) {
          selectedLabels = selectedLabels.filter(l => l !== label);
          btn.classList.remove('active');
        }
      } else {
        selectedLabels.push(label);
        btn.classList.add('active');
      }
    });
  });

  // Toggle Login Panel
  btnToggleAuth.addEventListener('click', () => {
    loginPanel.classList.toggle('hidden');
    if (!loginPanel.classList.contains('hidden')) {
      loginEmail.focus();
    }
  });

  btnCloseLogin.addEventListener('click', () => {
    loginPanel.classList.add('hidden');
  });

  // Nút 1-click Auto Sync
  if (btnAutoSyncTab) {
    btnAutoSyncTab.addEventListener('click', () => autoDetectSessionFromSmartLifeTabs(true));
  }
  if (btnAutoSyncInside) {
    btnAutoSyncInside.addEventListener('click', () => autoDetectSessionFromSmartLifeTabs(true));
  }

  // Nút Đăng xuất
  btnLogout.addEventListener('click', handleLogout);

  // Form Đăng nhập Supabase thủ công
  loginForm.addEventListener('submit', handleLogin);

  // Nút Lưu ghi chú
  btnSaveNote.addEventListener('click', saveNote);

  // Mở SmartLife Web App
  btnOpenWeb.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173' });
  });
});

// 2. Tự động quét và lấy Token từ tab SmartLife Web đang mở
async function autoDetectSessionFromSmartLifeTabs(notify = true) {
  try {
    // Tìm tất cả các tab localhost, vercel hoặc có từ khóa smartlife
    const tabs = await chrome.tabs.query({});
    const smartlifeTabs = tabs.filter(t => 
      t.url && (
        t.url.includes('localhost:') || 
        t.url.includes('127.0.0.1') ||
        t.url.includes('smartlife') ||
        t.url.includes('vercel.app')
      )
    );

    if (!smartlifeTabs || smartlifeTabs.length === 0) {
      if (notify) {
        showToast('Không tìm thấy tab SmartLife nào đang mở. Hãy mở web SmartLife trước nhé!', 'error');
      }
      return false;
    }

    // Quét từng tab tìm auth token trong localStorage
    for (const tab of smartlifeTabs) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              // 1. Quét tất cả các key Supabase Auth trong localStorage
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('auth-token') || key.includes('supabase') || key.includes('smartlife') || key.includes('CapacitorStorage'))) {
                  const raw = localStorage.getItem(key);
                  if (raw) {
                    try {
                      const parsed = JSON.parse(raw);
                      if (parsed && (parsed.access_token || parsed.user)) {
                        return parsed;
                      }
                      if (parsed && parsed.currentSession) {
                        return parsed.currentSession;
                      }
                    } catch {}
                  }
                }
              }
            } catch (e) {
              return null;
            }
            return null;
          }
        });

        if (results && results[0] && results[0].result) {
          const authData = results[0].result;
          const user = authData.user || (authData.user_id ? { id: authData.user_id, email: authData.email || 'SmartLife User' } : null);
          const token = authData.access_token || authData.token;

          if (token && user) {
            await chrome.storage.local.set({
              smartlife_user: user,
              smartlife_token: token,
            });

            currentUser = user;
            currentToken = token;
            loginPanel.classList.add('hidden');
            checkAuthStatus();
            if (notify) {
              showToast(`✅ Đã đồng bộ tài khoản: ${user.email || 'SmartLife'}!`, 'success');
            }
            return true;
          }
        }
      } catch (err) {
        // Tab này không inject được, thử tab tiếp theo
      }
    }

    if (notify) {
      showToast('Chưa tìm thấy phiên đăng nhập trên tab Web. Hãy đăng nhập trên web hoặc nhập form bên dưới!', 'error');
    }
    return false;
  } catch (err) {
    console.error('Lỗi khi auto sync:', err);
    if (notify) showToast('Lỗi quét phiên đăng nhập.', 'error');
    return false;
  }
}

// 3. Kiểm tra Auth State
async function checkAuthStatus() {
  const data = await chrome.storage.local.get(['smartlife_user', 'smartlife_token']);
  if (data.smartlife_user && data.smartlife_token) {
    currentUser = data.smartlife_user;
    currentToken = data.smartlife_token;
    authStatusText.textContent = `🟢 ${currentUser.email || 'Đã kết nối'}`;
    authStatusText.style.color = '#047857';
    btnLogout.classList.remove('hidden');
    quickSyncBanner.classList.add('hidden');
    loginPanel.classList.add('hidden');
    // Sync pending notes
    syncPendingNotes();
  } else {
    currentUser = null;
    currentToken = null;
    authStatusText.textContent = '⚪ Chưa kết nối (Lưu máy)';
    authStatusText.style.color = '#64748b';
    btnLogout.classList.add('hidden');
    quickSyncBanner.classList.remove('hidden');
  }
}

// 4. Xử lý Đăng xuất khỏi Extension
async function handleLogout() {
  await chrome.storage.local.remove(['smartlife_user', 'smartlife_token']);
  currentUser = null;
  currentToken = null;
  checkAuthStatus();
  showToast('Đã đăng xuất khỏi Extension.', 'success');
}

// 5. Xử lý Đăng nhập Supabase REST API thủ công
async function handleLogin(e) {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  loginError.classList.add('hidden');
  const submitBtn = document.getElementById('btnLoginSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang xác thực...';

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || 'Sai email hoặc mật khẩu.');
    }

    await chrome.storage.local.set({
      smartlife_user: data.user,
      smartlife_token: data.access_token,
    });

    currentUser = data.user;
    currentToken = data.access_token;
    loginPanel.classList.add('hidden');
    loginForm.reset();
    showToast('Đăng nhập thành công!', 'success');
    checkAuthStatus();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Đăng nhập';
  }
}

// 6. Lưu ghi chú
async function saveNote() {
  const content = noteContent.value.trim();
  if (!content) {
    showToast('Vui lòng nhập nội dung ghi chú.', 'error');
    noteContent.focus();
    return;
  }

  // Nếu chưa đăng nhập, tự động thử đồng bộ từ tab web trước
  if (!currentUser || !currentToken) {
    const synced = await autoDetectSessionFromSmartLifeTabs(false);
    if (!synced) {
      loginPanel.classList.remove('hidden');
      showToast('⚠️ Vui lòng nhấn "Đồng bộ 1 chạm" hoặc đăng nhập để lưu trực tuyến!', 'error');
      return;
    }
  }

  btnSaveNote.disabled = true;
  btnSaveText.textContent = 'Đang lưu...';

  const destination = document.querySelector('input[name="saveDest"]:checked').value;
  let finalContent = content;
  if (chkAttachSource.checked && currentTab && currentTab.url) {
    finalContent += `\n\n---\n🌐 Nguồn: [${currentTab.title || 'Web'}](${currentTab.url})`;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const firstLine = content.split('\n')[0].replace(/^[#*-\s]+/, '').trim();
  const noteTitle = firstLine.slice(0, 45) || 'Ghi chú nhanh';

  try {
    if (destination === 'archive') {
      // Lưu vào bảng note_archives
      const res = await fetch(`${SUPABASE_URL}/rest/v1/note_archives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${currentToken}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_id: currentUser.id,
          title: noteTitle,
          content: finalContent,
          labels: selectedLabels,
          note_date: todayStr,
          metadata: {
            source_url: currentTab?.url || '',
            source_title: currentTab?.title || '',
            created_from: 'chrome_extension'
          }
        })
      });

      if (!res.ok) throw new Error('Lỗi lưu vào Supabase note_archives');
      showToast('✅ Đã lưu vào Kho Bộ nhớ SmartLife!', 'success');

    } else {
      // Lưu vào Bảng nháp widget (my_storage type='note' title='Quick Note')
      const queryRes = await fetch(`${SUPABASE_URL}/rest/v1/my_storage?user_id=eq.${currentUser.id}&type=eq.note&title=eq.Quick Note&limit=1`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${currentToken}`
        }
      });
      const existing = await queryRes.json();

      if (existing && existing.length > 0) {
        const oldText = existing[0].content || '';
        const newText = oldText ? `${oldText}\n\n---\n${finalContent}` : finalContent;
        await fetch(`${SUPABASE_URL}/rest/v1/my_storage?id=eq.${existing[0].id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify({ content: newText })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/my_storage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify({
            user_id: currentUser.id,
            type: 'note',
            title: 'Quick Note',
            content: finalContent
          })
        });
      }
      showToast('✅ Đã nạp vào Bảng nháp Ghi chú nhanh!', 'success');
    }

    // Reset textarea
    noteContent.value = '';
    wordCount.textContent = '0 từ';

    // Đóng popup sau 1.2s
    setTimeout(() => {
      window.close();
    }, 1200);

  } catch (err) {
    console.error(err);
    // Lưu local fallback nếu gặp sự cố mạng
    await queueLocalNote({ title: noteTitle, content: finalContent, labels: selectedLabels, note_date: todayStr });
    showToast('💾 Đã lưu tạm vào máy (Offline).', 'success');
  } finally {
    btnSaveNote.disabled = false;
    btnSaveText.textContent = 'Lưu ghi chú';
  }
}

// 7. Helper lưu local offline
async function queueLocalNote(note) {
  const data = await chrome.storage.local.get(['pending_notes']);
  const currentPending = data.pending_notes || [];
  currentPending.unshift({
    id: 'local_' + Date.now(),
    ...note,
    created_at: new Date().toISOString()
  });
  await chrome.storage.local.set({ pending_notes: currentPending });
}

// 8. Tự động đồng bộ các ghi chú offline khi có mạng và đã đăng nhập
async function syncPendingNotes() {
  if (!currentUser || !currentToken) return;
  const data = await chrome.storage.local.get(['pending_notes']);
  const pending = data.pending_notes || [];
  if (pending.length === 0) return;

  let successIds = [];
  for (const item of pending) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/note_archives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({
          user_id: currentUser.id,
          title: item.title,
          content: item.content,
          labels: item.labels || ['Work'],
          note_date: item.note_date || new Date().toISOString().split('T')[0]
        })
      });
      if (res.ok) successIds.push(item.id);
    } catch {
      // Continue
    }
  }

  if (successIds.length > 0) {
    const remaining = pending.filter(p => !successIds.includes(p.id));
    await chrome.storage.local.set({ pending_notes: remaining });
    showToast(`Đã đồng bộ ${successIds.length} ghi chú offline lên mây!`, 'success');
  }
}

// Helper Toast
function showToast(message, type = 'success') {
  statusToast.textContent = message;
  statusToast.className = `status-toast ${type}`;
  setTimeout(() => {
    statusToast.className = 'status-toast hidden';
  }, 3500);
}
