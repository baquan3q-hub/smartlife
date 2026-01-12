import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyDb7tdLRCKjWWWJLXGxSyLTN_ukvJ1_Wzo",
    authDomain: "lsen-defd7.firebaseapp.com",
    projectId: "lsen-defd7",
    storageBucket: "lsen-defd7.firebasestorage.app",
    messagingSenderId: "521624560522",
    appId: "1:521624560522:web:fc23845772a51dfa131e73",
    measurementId: "G-6HL258BZQ3"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo Messaging để dùng cho thông báo
export const messaging = getMessaging(app);

export default app;