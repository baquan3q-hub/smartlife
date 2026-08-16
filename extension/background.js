// File: extension/background.js
// Service Worker cho SmartLife Chrome Extension (Manifest V3)

const SUPABASE_URL = 'https://toanywkdbhfqdfvtrrzm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvYW55d2tkYmhmcWRmdnRycnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODAxNTgsImV4cCI6MjA4MzQ1NjE1OH0.Qv1CNBk3BTLC2v2YEhNEE1F8giIsifBhy4_AOzNmekQ';

// Khởi tạo Context Menu khi cài đặt extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'smartlife-save-selection',
    title: '📝 Lưu đoạn văn này vào SmartLife Note',
    contexts: ['selection']
  });
});

// Xử lý khi click vào Context Menu chuột phải
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'smartlife-save-selection' && info.selectionText) {
    const selectedText = info.selectionText.trim();
    const pageTitle = tab?.title || 'Trích dẫn Web';
    const pageUrl = tab?.url || '';

    // Lấy thông tin user đăng nhập từ storage
    const storageData = await chrome.storage.local.get(['smartlife_user', 'smartlife_token']);
    const user = storageData.smartlife_user;
    const token = storageData.smartlife_token;

    const todayStr = new Date().toISOString().split('T')[0];
    const fullContent = `${selectedText}\n\n---\n🌐 Nguồn: [${pageTitle}](${pageUrl})`;
    const noteTitle = pageTitle.slice(0, 45) || 'Trích dẫn web';

    if (user && token) {
      // Đã đăng nhập -> Gửi trực tiếp lên Supabase note_archives
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/note_archives`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            user_id: user.id,
            title: noteTitle,
            content: fullContent,
            labels: ['Work'],
            note_date: todayStr,
            metadata: { source_url: pageUrl, source_title: pageTitle }
          })
        });

        if (response.ok) {
          showNotification('SmartLife Quick Note', '✅ Đã lưu trích dẫn thành công vào Bộ nhớ Ghi chú!');
        } else {
          // Fallback lưu local queue
          await queuePendingNote({ title: noteTitle, content: fullContent, labels: ['Work'], note_date: todayStr });
          showNotification('SmartLife Quick Note', '💾 Đã lưu tạm vào máy. Mở Extension để đồng bộ!');
        }
      } catch (err) {
        await queuePendingNote({ title: noteTitle, content: fullContent, labels: ['Work'], note_date: todayStr });
        showNotification('SmartLife Quick Note', '💾 Đã lưu tạm vào máy (Offline).');
      }
    } else {
      // Chưa đăng nhập -> Lưu vào pending queue và nhắc đăng nhập
      await queuePendingNote({ title: noteTitle, content: fullContent, labels: ['Work'], note_date: todayStr });
      showNotification('SmartLife Quick Note', '⚠️ Bạn chưa đăng nhập. Đoạn ghi chú đã lưu tạm, hãy mở extension để đăng nhập và đồng bộ nhé!');
    }
  }
});

// Helper lưu ghi chú chờ đồng bộ
async function queuePendingNote(noteItem) {
  const data = await chrome.storage.local.get(['pending_notes']);
  const currentPending = data.pending_notes || [];
  currentPending.unshift({
    id: 'pending_' + Date.now(),
    ...noteItem,
    created_at: new Date().toISOString()
  });
  await chrome.storage.local.set({ pending_notes: currentPending });
}

// Helper hiển thị thông báo
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}
