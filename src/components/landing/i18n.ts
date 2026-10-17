import { Lang } from '../../i18n/i18n';

export type StoryKey = 'google' | 'ai' | 'kanban' | 'finance';
export type BentoKey = 'journal' | 'habit' | 'focus' | 'gpa' | 'goals' | 'spotify' | 'storage' | 'visual';
export type MarqueeKey = 'google' | 'kanban' | 'ai' | 'career' | 'cv' | 'journal' | 'gpa' | 'finance' | 'spotify' | 'habit' | 'focus' | 'storage';

interface Story {
    eyebrow: string;
    title: string;
    desc: string;
    points: string[];
}

interface BentoCopy {
    title: string;
    desc: string;
}

export interface LandingCopy {
    nav: { home: string; overview: string; google: string; features: string; pricing: string; contact: string };
    install: string;
    login: string;
    langName: string;
    heroEyebrow: string;
    heroTitle1: string;
    heroTitle2: string;
    heroDesc: string;
    startNow: string;
    learnMore: string;
    previewBadge: string;
    syncWith: string;
    syncStatus: string;
    stories: Record<StoryKey, Story>;
    bentoEyebrow: string;
    bentoTitle: string;
    bentoDesc: string;
    bento: Record<BentoKey, BentoCopy>;
    focusCta: string;
    storageCta: string;
    marquee: Record<MarqueeKey, string>;
    ctaTitle: string;
    ctaDesc: string;
    footer: {
        tagline: string;
        col1: string;
        col2: string;
        col3: string;
        dev: string;
        email: string;
        profile: string;
        built: string;
        backToTop: string;
    };
}

export const copy: Record<Lang, LandingCopy> = {
    vi: {
        nav: { home: 'Trang chủ', overview: 'Tổng quan', google: 'Google Hub', features: 'Tính năng', pricing: 'Bảng giá', contact: 'Liên hệ' },
        install: 'Cài App',
        login: 'Đăng nhập',
        langName: 'Tiếng Việt',
        heroEyebrow: 'Life OS dành cho sinh viên',
        heroTitle1: 'Quản lý cuộc sống,',
        heroTitle2: 'gọn trong một app.',
        heroDesc: 'Tài chính, lịch trình, mục tiêu, thói quen và nhật ký — đồng bộ với Google và được AI cá nhân hóa cho riêng bạn.',
        startNow: 'Bắt đầu miễn phí',
        learnMore: 'Xem tổng quan',
        previewBadge: 'Life OS 2026',
        syncWith: 'Đồng bộ 2 chiều với',
        syncStatus: 'Đang đồng bộ realtime',
        stories: {
            google: {
                eyebrow: 'Google Ecosystem',
                title: 'Đồng bộ 2 chiều với Google, không độ trễ.',
                desc: 'Kết nối tài khoản Google để Tasks, Calendar và Sheets luôn khớp với SmartLife — thay đổi ở đâu cũng cập nhật ở mọi nơi.',
                points: [
                    '4 cột Kanban ánh xạ thẳng sang Google Tasks',
                    'Subtask phân cấp đồng bộ dạng Native Child Tasks',
                    'Xem và tạo sự kiện Google Calendar ngay trong app',
                    'Deep Clean tự khử trùng lặp toàn cục'
                ]
            },
            ai: {
                eyebrow: 'AI Your Own',
                title: 'Trợ lý AI hiểu dữ liệu của chính bạn.',
                desc: 'Đọc file, ảnh hóa đơn và ghi âm; kết hợp GPA với MBTI/DISC để tư vấn nghề nghiệp và tự tạo CV chuẩn PDF.',
                points: [
                    'Phân tích chi tiêu và thêm giao dịch bằng câu lệnh tự nhiên',
                    'Đọc hiểu tài liệu, hình ảnh và giọng nói',
                    'Cố vấn sự nghiệp dựa trên GPA & tính cách',
                    'CV tự động điền từ GPA và Mục tiêu'
                ]
            },
            kanban: {
                eyebrow: 'Lịch trình & Kanban',
                title: 'Làm chủ thời gian, từng việc một.',
                desc: 'Bảng Kanban kéo thả mượt, thời khóa biểu trực quan, Pomodoro và ghi chú nhanh — tất cả trên một màn hình.',
                points: [
                    'Kanban 4 cột kéo thả, tối ưu 95% re-render',
                    'Thời khóa biểu tuần/ngày nối với Google Calendar',
                    'Pomodoro, ghi chú nhanh có đính kèm file',
                    'Bookmark và widget thói quen'
                ]
            },
            finance: {
                eyebrow: 'Tài chính',
                title: 'Tiền bạc minh bạch, ví và sổ nợ rõ ràng.',
                desc: 'Theo dõi thu chi, quản lý nhiều ví và quỹ mục đích, ghi nợ tự trừ vào dòng tiền thực tế.',
                points: [
                    'Báo cáo thu chi theo tuần / tháng / năm',
                    'Số dư Ví & Quỹ trên mọi thiết bị',
                    'Sổ nợ mini liên kết dòng tiền',
                    'Gợi ý ngân sách từ AI'
                ]
            }
        },
        bentoEyebrow: 'Và mọi thứ khác',
        bentoTitle: 'Mọi công cụ bạn cần, không cần thêm app nào.',
        bentoDesc: 'Từ nhật ký chữa lành đến GPA, nhạc tập trung và kho lưu trữ bảo mật.',
        bento: {
            journal: { title: 'Nhật ký chữa lành', desc: 'Trình soạn thảo như Word, theo dõi cảm xúc và câu hỏi gợi ý mỗi ngày.' },
            habit: { title: 'Thói quen & Countdown', desc: 'Chuỗi streak có sao thưởng, đếm ngược sự kiện và đếm tiến kỷ niệm.' },
            focus: { title: 'Tập trung & Nhạc Lofi', desc: 'Pomodoro, nhạc từ thiết bị và Todo — dùng ngay không cần đăng nhập.' },
            gpa: { title: 'GPA Tracker', desc: 'Đặt mục tiêu tín chỉ, theo dõi từng kỳ, tính GPA chính xác.' },
            goals: { title: 'Mục tiêu 5 năm', desc: 'Lộ trình kỹ năng, dự án và mục tiêu dài hạn có AI hỗ trợ.' },
            spotify: { title: 'My Spotify', desc: 'Nghe nhạc không cần tài khoản Spotify, lặp mượt, tạo playlist.' },
            storage: { title: 'My Storage', desc: 'Ghi chú, tệp tin và media riêng tư trong một nơi bảo mật.' },
            visual: { title: 'Visualboard', desc: 'Toàn cảnh lịch trình, mục tiêu, tài chính và ngày lễ sắp tới.' }
        },
        focusCta: 'Học thử không cần đăng nhập',
        storageCta: 'Trải nghiệm',
        marquee: {
            google: 'Đồng bộ Google 2 chiều', kanban: 'Kanban & Subtasks', ai: 'AI Your Own', career: 'Cố vấn sự nghiệp', cv: 'CV tự động',
            journal: 'Nhật ký', gpa: 'GPA Tracker', finance: 'Tài chính', spotify: 'My Spotify', habit: 'Thói quen', focus: 'Pomodoro', storage: 'Lưu trữ bảo mật'
        },
        ctaTitle: 'Sẵn sàng sống SMART hơn?',
        ctaDesc: 'Miễn phí để bắt đầu. Cài như app trên điện thoại và máy tính.',
        footer: {
            tagline: 'Hệ sinh thái học tập và quản lý cuộc sống thông minh dành cho sinh viên.',
            col1: 'Tính năng chính',
            col2: 'Tiện ích',
            col3: 'Liên hệ',
            dev: 'Người phát triển',
            email: 'Email hỗ trợ',
            profile: 'Profile',
            built: 'By QuanBa',
            backToTop: 'Lên đầu trang'
        }
    },
    en: {
        nav: { home: 'Home', overview: 'Overview', google: 'Google Hub', features: 'Features', pricing: 'Pricing', contact: 'Contact' },
        install: 'Install App',
        login: 'Login',
        langName: 'English',
        heroEyebrow: 'The Life OS for students',
        heroTitle1: 'Your whole life,',
        heroTitle2: 'in one calm app.',
        heroDesc: 'Finances, schedules, goals, habits and journaling — synced with Google and personalized by your own AI.',
        startNow: 'Start for free',
        learnMore: 'See overview',
        previewBadge: 'Life OS 2026',
        syncWith: 'Two-way sync with',
        syncStatus: 'Syncing in realtime',
        stories: {
            google: {
                eyebrow: 'Google Ecosystem',
                title: 'Two-way Google sync, zero lag.',
                desc: 'Connect your Google account and Tasks, Calendar and Sheets stay in lockstep with SmartLife — change it anywhere, see it everywhere.',
                points: [
                    '4 Kanban columns mapped straight to Google Tasks',
                    'Hierarchical subtasks as native child tasks',
                    'View and create Google Calendar events in-app',
                    'Deep Clean removes duplicates globally'
                ]
            },
            ai: {
                eyebrow: 'AI Your Own',
                title: 'An assistant that knows your data.',
                desc: 'Reads documents, receipts and voice notes; blends GPA with MBTI/DISC to guide your career and auto-build a PDF CV.',
                points: [
                    'Analyze spending and add transactions in plain language',
                    'Understands documents, images and audio',
                    'Career guidance from GPA & personality',
                    'CV autofilled from GPA and Goals'
                ]
            },
            kanban: {
                eyebrow: 'Schedule & Kanban',
                title: 'Own your time, one task at a time.',
                desc: 'A buttery drag-and-drop Kanban, visual timetables, Pomodoro and quick notes — all on one screen.',
                points: [
                    '4-column Kanban with 95% fewer re-renders',
                    'Daily/weekly timetables linked to Google Calendar',
                    'Pomodoro and quick notes with attachments',
                    'Bookmarks and a habit widget'
                ]
            },
            finance: {
                eyebrow: 'Finance',
                title: 'Clear money, wallets and debts.',
                desc: 'Track cash flow, manage multiple wallets and purpose funds, and log debts that settle against real balances.',
                points: [
                    'Income & expense reports by week / month / year',
                    'Wallet & fund balances on every device',
                    'Mini debt ledger linked to cash flow',
                    'AI budget suggestions'
                ]
            }
        },
        bentoEyebrow: 'And everything else',
        bentoTitle: 'Every tool you need. No extra apps.',
        bentoDesc: 'From a healing journal to GPA, focus music and secure storage.',
        bento: {
            journal: { title: 'Healing Journal', desc: 'A Word-like editor, mood tracking and daily writing prompts.' },
            habit: { title: 'Habits & Countdown', desc: 'Rewarded streaks, event countdowns and milestone count-ups.' },
            focus: { title: 'Focus & Lofi', desc: 'Pomodoro, your own music and todos — no login required.' },
            gpa: { title: 'GPA Tracker', desc: 'Set credit targets, track every semester, compute GPA precisely.' },
            goals: { title: '5-Year Goals', desc: 'Skill roadmaps, projects and long-term goals, AI-assisted.' },
            spotify: { title: 'My Spotify', desc: 'Listen without a Spotify account, seamless repeat, playlists.' },
            storage: { title: 'My Storage', desc: 'Private notes, files and media in one secure place.' },
            visual: { title: 'Visualboard', desc: 'Schedule, goals, finances and upcoming holidays at a glance.' }
        },
        focusCta: 'Try it without login',
        storageCta: 'Try it',
        marquee: {
            google: 'Google 2-way sync', kanban: 'Kanban & Subtasks', ai: 'AI Your Own', career: 'Career advisor', cv: 'Auto CV',
            journal: 'Journal', gpa: 'GPA Tracker', finance: 'Finance', spotify: 'My Spotify', habit: 'Habits', focus: 'Pomodoro', storage: 'Secure storage'
        },
        ctaTitle: 'Ready to live a little smarter?',
        ctaDesc: 'Free to start. Install it like an app on phone and desktop.',
        footer: {
            tagline: 'A smart learning ecosystem and life management tool designed for students.',
            col1: 'Core features',
            col2: 'Utilities',
            col3: 'Contact',
            dev: 'Developer',
            email: 'Support email',
            profile: 'Profile',
            built: 'Built with care and AI.',
            backToTop: 'Back to top'
        }
    },
    ko: {
        nav: { home: '홈', overview: '미리보기', google: '구글 연동', features: '기능', pricing: '요금제', contact: '문의' },
        install: '앱 설치',
        login: '로그인',
        langName: '한국어',
        heroEyebrow: '대학생을 위한 Life OS',
        heroTitle1: '나의 모든 일상,',
        heroTitle2: '하나의 앱으로.',
        heroDesc: '자산, 일정, 목표, 습관, 일기까지 — 구글과 동기화되고 나만의 AI로 맞춤화됩니다.',
        startNow: '무료로 시작하기',
        learnMore: '미리보기',
        previewBadge: 'Life OS 2026',
        syncWith: '양방향 동기화',
        syncStatus: '실시간 동기화 중',
        stories: {
            google: {
                eyebrow: 'Google Ecosystem',
                title: '지연 없는 구글 양방향 동기화.',
                desc: '구글 계정을 연결하면 Tasks, Calendar, Sheets가 SmartLife와 항상 일치합니다.',
                points: [
                    'Kanban 4개 컬럼을 구글 Tasks에 바로 매핑',
                    '계층형 서브태스크를 Native Child Tasks로 동기화',
                    '앱 안에서 구글 캘린더 일정 확인 및 생성',
                    'Deep Clean 전역 중복 제거'
                ]
            },
            ai: {
                eyebrow: 'AI Your Own',
                title: '내 데이터를 이해하는 AI 비서.',
                desc: '문서, 영수증, 음성을 분석하고 GPA와 MBTI/DISC를 결합해 진로를 안내하며 PDF 이력서를 자동 생성합니다.',
                points: [
                    '자연어로 지출 분석 및 거래 추가',
                    '문서, 이미지, 오디오 이해',
                    'GPA와 성격 기반 진로 상담',
                    'GPA와 목표로 이력서 자동 입력'
                ]
            },
            kanban: {
                eyebrow: '일정 & Kanban',
                title: '시간을 지배하세요, 한 번에 하나씩.',
                desc: '부드러운 드래그 앤 드롭 Kanban, 시간표, 뽀모도로, 퀵 메모를 한 화면에.',
                points: [
                    '리렌더링 95% 감소한 4열 Kanban',
                    '구글 캘린더와 연결된 일간/주간 시간표',
                    '뽀모도로와 첨부 가능한 퀵 메모',
                    '북마크와 습관 위젯'
                ]
            },
            finance: {
                eyebrow: '자산 관리',
                title: '투명한 자산, 명확한 지갑과 채무.',
                desc: '현금 흐름을 추적하고 여러 지갑과 목적별 예산을 관리하며 채무를 실제 잔액과 연동합니다.',
                points: [
                    '주/월/년 단위 수입·지출 보고서',
                    '모든 기기에서 지갑·예산 잔액 확인',
                    '현금 흐름과 연동된 미니 채무 대장',
                    'AI 예산 추천'
                ]
            }
        },
        bentoEyebrow: '그리고 그 밖의 모든 것',
        bentoTitle: '필요한 모든 도구, 추가 앱 없이.',
        bentoDesc: '힐링 다이어리부터 GPA, 집중 음악, 보안 저장소까지.',
        bento: {
            journal: { title: '힐링 다이어리', desc: '워드 같은 에디터, 감정 추적, 매일의 글쓰기 질문.' },
            habit: { title: '습관 & D-Day', desc: '보상형 스트릭, 이벤트 카운트다운과 기념일 카운트업.' },
            focus: { title: '집중 & 로파이', desc: '뽀모도로, 내 음악, 할 일 — 로그인 없이 바로.' },
            gpa: { title: 'GPA 트래커', desc: '목표 학점 설정, 학기별 추적, 정확한 GPA 계산.' },
            goals: { title: '5개년 목표', desc: 'AI가 돕는 기술 로드맵, 프로젝트, 장기 목표.' },
            spotify: { title: 'My Spotify', desc: '스포티파이 계정 없이 감상, 반복 재생, 플레이리스트.' },
            storage: { title: 'My Storage', desc: '메모, 파일, 미디어를 안전한 한 곳에.' },
            visual: { title: '비주얼보드', desc: '일정, 목표, 자산, 다가오는 공휴일을 한눈에.' }
        },
        focusCta: '로그인 없이 체험하기',
        storageCta: '체험하기',
        marquee: {
            google: '구글 양방향 동기화', kanban: 'Kanban & 서브태스크', ai: 'AI Your Own', career: 'AI 진로 상담', cv: '자동 이력서',
            journal: '다이어리', gpa: 'GPA 트래커', finance: '자산 관리', spotify: 'My Spotify', habit: '습관', focus: '뽀모도로', storage: '보안 저장소'
        },
        ctaTitle: '더 스마트하게 살 준비 되셨나요?',
        ctaDesc: '무료로 시작하세요. 휴대폰과 PC에 앱처럼 설치할 수 있습니다.',
        footer: {
            tagline: '학생들을 위해 디자인된 스마트 학업 생태계 및 라이프 관리 시스템.',
            col1: '주요 기능',
            col2: '확장 도구',
            col3: '연락처',
            dev: '개발자',
            email: '고객 지원 이메일',
            profile: '프로필',
            built: '❤️와 AI로 제작되었습니다.',
            backToTop: '맨 위로'
        }
    }
};
