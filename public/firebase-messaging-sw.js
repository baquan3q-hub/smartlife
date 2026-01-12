// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    // Dán lại bảng cấu hình (apiKey, appId...) của bạn vào đây
    apiKey: "AIzaSyDb7tdLRCKjWWWJLXGxSyLTN_ukvJ1_Wzo",
    authDomain: "lsen-defd7.firebaseapp.com",
    projectId: "lsen-defd7",
    storageBucket: "lsen-defd7.firebasestorage.app",
    messagingSenderId: "521624560522",
    appId: "1:521624560522:web:fc23845772a51dfa131e73"
});

const messaging = firebase.messaging();

// Quan trọng: Hàm này giúp hiện thông báo khi thoát app
messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification.title || "Thông báo mới";
    const notificationOptions = {
        body: payload.notification.body || "Bạn có tin nhắn từ SmartLifeApp",
        icon: '/logo192.png' // Icon này phải có trong thư mục public
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});