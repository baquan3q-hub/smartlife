import React, { useEffect } from 'react';

const ClickRippleEffect: React.FC = () => {
    useEffect(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            // Tạo phần tử ripple
            const ripple = document.createElement('div');
            ripple.className = 'click-ripple';

            // Định vị phần tử theo tọa độ click chuột (sử dụng clientX/Y kết hợp với position: fixed)
            ripple.style.left = `${e.clientX}px`;
            ripple.style.top = `${e.clientY}px`;

            // Thêm vào DOM
            document.body.appendChild(ripple);

            // Dọn dẹp DOM khi hiệu ứng kết thúc
            const cleanup = () => {
                ripple.removeEventListener('animationend', cleanup);
                if (ripple.parentNode) {
                    ripple.remove();
                }
            };
            ripple.addEventListener('animationend', cleanup);

            // Đặt thời gian fallback tự xóa phòng trường hợp animationend không kích hoạt
            const timeoutId = setTimeout(() => {
                if (ripple.parentNode) {
                    ripple.remove();
                }
            }, 800);

            // Hủy timeout nếu sự kiện animationend đã chạy thành công trước đó
            ripple.addEventListener('animationend', () => clearTimeout(timeoutId));
        };

        // Lắng nghe sự kiện click toàn cục
        document.addEventListener('click', handleGlobalClick);

        return () => {
            document.removeEventListener('click', handleGlobalClick);
        };
    }, []);

    // Component này chỉ xử lý logic và không render trực tiếp bất kỳ giao diện nào trong cây React DOM
    return null;
};

export default ClickRippleEffect;
