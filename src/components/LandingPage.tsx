import React, { useState } from 'react';
import { LayoutDashboard, Wallet, CalendarDays, Rocket, ArrowRight, ShieldCheck, Zap, Download, Globe, Mail, User, Archive, LockKeyhole, Headphones, Sparkles, Brain, GraduationCap, Music, PlayCircle, Flame, BookOpen, Target, CheckCircle2, Star, Facebook, FileText, Image, AudioLines, Users, ChevronUp } from 'lucide-react';
import InstallGuideModal from './InstallGuideModal';
import { Lang } from '../i18n/i18n';

interface LandingPageProps {
    onLogin: () => void;
    lang: Lang;
    setLang: (lang: Lang) => void;
}

const translations = {
    vi: {
        install: 'Cài App',
        login: 'Đăng nhập',
        heroTag: 'Trợ lý cá nhân All-in-One',
        heroTitle1: 'Quản lý cuộc sống',
        heroTitle2: 'Thông minh & Hiệu quả',
        heroDesc: 'SmartLife giúp bạn làm chủ tài chính, sắp xếp thời gian biểu và chinh phục mục tiêu cá nhân. Tất cả trong một ứng dụng duy nhất.',
        startNow: 'Bắt đầu miễn phí',
        learnMore: 'Tìm hiểu ngay',

        featVisualTitle: 'Visualboard - Góc nhìn toàn cảnh,\nKiểm soát mọi thứ.',
        featVisualDesc: 'Theo dõi tổng quan lịch trình, mục tiêu và đếm ngược ngày lễ sắp tới. Nắm bắt bức tranh tài chính toàn diện với số liệu thu chi tổng hợp.',
        featVisualItems: ['Tổng quan lịch trình & Mục tiêu một cách trực quan hóa', 'Đếm ngược ngày lễ VN', 'Tổng quan tất cả mọi thứ trong app'],

        featAiTitle: 'AI Your Own,\nTrợ lý AI cá nhân hóa.',
        featAiDesc: 'Trợ lý AI đa năng phân tích dữ liệu cá nhân, đọc hiểu file/ảnh/audio, cá nhân hóa dựa trên tính cách MBTI & DISC và đưa ra lời khuyên thông minh.',
        featAiItems: ['Phân tích chi tiêu chi tiết theo yêu cầu', 'Truy xuất toàn bộ dữ liệu để phản hồi cá nhân hóa', 'AI đọc và phân tích được file tài liệu đa định dạng', 'AI phân tích hình ảnh và nhận diện nội dung trực quan', 'AI xử lý và phân tích audio, ghi chú giọng nói', 'Cá nhân hóa dựa trên tính cách MBTI & DISC của người dùng', 'Thêm nhanh nhiều giao dịch thu chi cùng lúc bằng câu lệnh tự nhiên', 'Thêm và cập nhật lịch trình bằng ngôn ngữ đơn giản'],

        featFinanceTitle: 'Tài chính minh bạch,\nTiết kiệm tối đa.',
        featFinanceDesc: 'Theo dõi thu chi chi tiết, xem báo cáo trực quan và nhận phân tích thông minh từ AI để tối ưu hóa ngân sách của bạn.',
        featFinanceItems: ['Báo cáo thu chi hàng tháng/quý/năm', 'Quản lý và theo dõi thu chi chi tiết minh bạch', 'Đặt mục tiêu tiết kiệm'],

        featScheduleTitle: 'Làm chủ thời gian,\nNâng cao hiệu suất.',
        featScheduleDesc: 'Thời khóa biểu trực quan, To-do list ưu tiên thông minh và chế độ Focus mode giúp bạn tập trung hoàn thành mọi công việc.',
        featScheduleItems: ['Thời khóa biểu tuần/ngày', 'Todo list theo mức độ ưu tiên', 'Focus Timer tích hợp'],

        featJournalTitle: 'Nhật ký cá nhân,\nChữa lành & Tự kiến tạo.',
        featJournalDesc: 'Không gian ghi chép an toàn, riêng tư. Giúp bạn nhìn nhận lại cảm xúc, ghi nhận lòng biết ơn hàng ngày và xây dựng thói quen viết lách lành mạnh.',
        featJournalItems: [
            'Trình soạn thảo WYSIWYG chuyên nghiệp đầy đủ định dạng như Word',
            'Theo dõi cảm xúc (Mood Tracker) trực quan với 5 emoji sinh động',
            'Nhắc nhở lòng biết ơn & Câu hỏi gợi ý viết ngẫu nhiên theo chủ đề',
            'Cơ chế tích lũy Sao thưởng StarBrain tạo động lực (Dopamine lành mạnh)',
            'Kết nối đồng bộ thông tin ngữ cảnh giúp AI Advisor tư vấn sâu sắc hơn'
        ],

        featFocusTitle: 'Tập trung cao độ,\nThư giãn tuyệt đối.',
        featFocusDesc: 'Chế độ Focus with bộ đếm giờ Pomodoro và kho nhạc Lofi chill giúp bạn duy trì sự tập trung và giảm căng thẳng khi học tập, làm việc.',
        featFocusItems: ['Bộ đếm giờ Pomodoro tùy chỉnh', 'Kho nhạc Lofi & Background Sounds', 'Thống kê thời gian tập trung'],

        featHabitTitle: 'Kỷ luật bản thân,\nHướng tới mục tiêu.',
        featHabitDesc: 'Xây dựng và duy trì thói quen tích cực với bộ đếm chuỗi (streak) theo cơ chế có sao thưởng để tăng. Đừng bỏ lỡ bất kỳ khoảnh khắc quan trọng nào với tính năng đếm ngược sự kiện và đếm tiến lưu giữ kỷ niệm.',
        featHabitItems: ['Quản lý thói quen & đo lường chuỗi (Streak)', 'Cơ chế thưởng phạt bằng huy hiệu sao giúp người dùng có động lực và dopamine lành mạnh', 'Đếm ngược các sự kiện quan trọng', 'Đếm tiến lưu giữ cột mốc kỷ niệm'],

        featGoalsTitle: 'Đặt mục tiêu,\nHiện thực hóa ước mơ.',
        featGoalsDesc: 'Theo dõi từng bước tiến của bạn với tính năng quản lý mục tiêu dài hạn và ngắn hạn. Đừng chỉ mơ ước, hãy thực hiện.',
        featGoalsItems: ['Theo dõi tiến độ trực quan', 'Nhắc nhở hạn chót', 'Giao diện lịch vạn niên'],

        featGpaTitle: 'GPA Tracker,\nLàm chủ điểm số.',
        featGpaDesc: 'Công cụ tính toán GPA cá nhân hóa. Đặt mục tiêu tín chỉ, theo dõi tiến độ học tập từng kỳ và tự động tính toán tổng kết điểm chính xác.',
        featGpaItems: ['Mục tiêu tín chỉ linh hoạt', 'Quản lý lộ trình học tập', 'Giao diện trực quan, dễ dùng'],

        featCareerTitle: 'Cố vấn sự nghiệp AI,\nĐịnh hình tương lai.',
        featCareerDesc: 'Phân tích kết quả học tập từ GPA Tracker, tính cách MBTI/DISC và sở thích cá nhân để định hướng lĩnh vực nghề nghiệp phù hợp, vạch ra lộ trình thăng tiến chi tiết.',
        featCareerItems: [
            'Phân tích GPA & thế mạnh học thuật chuyên ngành',
            'Đối chiếu tính cách MBTI & DISC với các nhóm công việc',
            'Gợi ý các lĩnh vực/ngành nghề & công nghệ cần học tập',
            'Lộ trình thăng tiến chi tiết (Career Growth Path)'
        ],

        featCVTitle: 'Xây dựng CV tự động,\nỨng tuyển chuyên nghiệp.',
        featCVDesc: 'Tự động trích xuất thông tin học thuật từ GPA Tracker, các kỹ năng, dự án cá nhân và chứng chỉ từ Goals để hoàn thiện CV chuẩn mực trong vài giây. Hỗ trợ xuất file PDF in ấn sắc nét.',
        featCVItems: [
            'Tự động điền (Autofill) từ kết quả học tập & mục tiêu',
            'Trình soạn thảo trực quan, sắp xếp bố cục chuẩn mực',
            'Xuất file PDF & xem trước A4 trực tiếp trên trình duyệt',
            'Chính sách Pro vĩnh viễn và Free trải nghiệm gia hạn 7 ngày'
        ],

        featSpotifyTitle: 'My Spotify,\nÂm nhạc không giới hạn.',
        featSpotifyDesc: 'Nghe nhạc mọi lúc mọi nơi mà không cần đăng ký mua tài khoản Spotify. Trải nghiệm âm nhạc tuyệt đỉnh ngay trên ứng dụng, vô tư nghe khi đi đường.',
        featSpotifyItems: ['Nghe nhạc không cần tài khoản Spotify', 'Chế độ nghe lặp lại siêu mượt', 'Tạo và chia playlist theo sở thích cá nhân'],

        promoTag: 'Tính năng mới',
        promoTitle: 'Khám phá My Storage',
        promoDesc: 'Không gian lưu trữ cá nhân bảo mật. Ghi chú, tệp tin, hình ảnh & đa phương tiện - tất cả trong một nơi duy nhất.',
        promoBtn: 'Trải nghiệm ngay',
        featStorageItems: ['Ghi chú đa phương tiện (Rich Text)', 'Lưu trữ & Xem trước Tệp tin/Media', 'Bảo mật tuyệt đối & Riêng tư'],

        footerBuilt: 'Được xây dựng với ❤️ và công nghệ AI tiên tiến.',
        langName: 'Tiếng Việt',
        footerLogoText: 'Hệ sinh thái học tập và quản lý cuộc sống thông minh dành cho sinh viên.',
        footerCol1Title: 'TÍNH NĂNG CHÍNH',
        footerCol2Title: 'TIỆN ÍCH MỞ RỘNG',
        footerCol3Title: 'LIÊN KẾT HỮU ÍCH',
        footerDev: 'Người phát triển',
        footerSupportEmail: 'Email hỗ trợ',
        footerPersonalPage: 'Trang cá nhân',
        footerAIAdvisor: 'AI Your Own',
        footerCareer: 'Lộ trình sự nghiệp AI',
        footerFinance: 'Quản lý tài chính',
        footerJournal: 'Nhật ký chữa lành',
        footerFocus: 'Tập trung & Nhạc Lofi',
        footerSchedule: 'Thời khóa biểu trực quan',
        footerHabit: 'Thói quen & D-Day',
        footerGPATracker: 'GPA Tracker (VNU)',
        footerSpotify: 'My Spotify',
        footerStorage: 'My Storage (Bảo mật)',
        footerCVBuilder: 'Xây dựng CV tự động'
    },
    en: {
        install: 'Install App',
        login: 'Login',
        heroTag: 'All-in-One Personal Assistant',
        heroTitle1: 'Manage Your Life',
        heroTitle2: 'Smart & Efficiently',
        heroDesc: 'SmartLife helps you master your finances, organize your schedule, and conquer personal goals. All in one single app.',
        startNow: 'Start for Free',
        learnMore: 'Learn More',

        featVisualTitle: 'Holistic View,\nControl Everything.',
        featVisualDesc: 'Get an overview of schedules, goals, and upcoming holiday countdowns. Master your financial picture with comprehensive income and expense data.',
        featVisualItems: ['Schedule & Goals Overview', 'Holiday Countdown', 'Comprehensive Financial Report'],

        featAiTitle: 'AI Your Own,\nYour Personalized AI.',
        featAiDesc: 'A versatile AI assistant that analyzes personal data, reads files/images/audio, personalizes advice based on your MBTI & DISC personality, and provides smart recommendations.',
        featAiItems: ['Detailed expense analysis on demand', 'Full data retrieval for personalized feedback', 'AI reads & analyzes documents in multiple formats', 'AI analyzes images and recognizes visual content', 'AI processes and analyzes audio & voice notes', 'Personalized based on your MBTI & DISC personality type', 'Batch add multiple transactions via natural language', 'Manage schedule using simple language'],

        featFinanceTitle: 'Transparent Finance,\nMaximize Savings.',
        featFinanceDesc: 'Track expenses in detail, view visual reports, and get smart AI analysis to optimize your budget.',
        featFinanceItems: ['Monthly expense reports', 'Smart AI Analysis', 'Set savings goals'],

        featScheduleTitle: 'Master Your Time,\nBoost Productivity.',
        featScheduleDesc: 'Visual timetable, smart prioritized To-do list, and Focus mode to help you concentrate on getting things done.',
        featScheduleItems: ['Weekly/Daily timetable', 'Priority-based Todo list', 'Integrated Focus Timer'],

        featJournalTitle: 'Personal Digital Journal,\nHeal & Grow.',
        featJournalDesc: 'Capture every moment, mood, and 3 gratitudes daily. An intuitive Word-like editor and StarBrain rewards help you maintain your writing habits.',
        featJournalItems: [
            'Professional Word-like WYSIWYG editor with full formatting options',
            'Visual Mood Tracker with 5 interactive and colorful emojis',
            'Daily gratitude prompts & randomized inspiration-driven writing prompts',
            'StarBrain reward mechanism (Earn up to 10+ stars per entry for motivation)',
            'Context synchronization with AI Advisor for deeply personalized guidance'
        ],

        featFocusTitle: 'Deep Focus,\nAbsolute Relaxation.',
        featFocusDesc: 'Focus mode with Pomodoro timer and chill Lofi music library helps you maintain concentration and reduce stress while studying or working.',
        featFocusItems: ['Customizable Pomodoro Timer', 'Lofi Music & Background Sounds', 'Focus Time Statistics'],

        featHabitTitle: 'Self-Discipline,\nGoal Oriented.',
        featHabitDesc: 'Build and maintain positive habits with streak tracking. Never miss an important moment with event countdowns and milestone count-ups for your memories.',
        featHabitItems: ['Habit tracking & Streak measurement', 'Countdown to important events', 'Count-up for milestone memories'],

        featGoalsTitle: 'Set Goals,\nRealize Dreams.',
        featGoalsDesc: 'Track your every step with long-term and short-term goal management. Don\'t just dream, make it happen.',
        featGoalsItems: ['Visual progress tracking', 'Deadline reminders', 'Perpetual calendar interface'],

        featGpaTitle: 'GPA Tracker,\nMaster Your Grades.',
        featGpaDesc: 'Personalized GPA calculation tool. Set credit goals, track your academic progress every semester, and accurately calculate your overall score.',
        featGpaItems: ['Flexible credit targets', 'Academic roadmap management', 'Intuitive and easy-to-use interface'],

        featCareerTitle: 'AI Career Advisor,\nShape Your Future.',
        featCareerDesc: 'Analyzes GPA academic records, MBTI/DISC personality types, and personal interests to recommend matching career domains and build a detailed path.',
        featCareerItems: [
            'Analyze GPA & academic strengths in specific courses',
            'Match MBTI & DISC personality with job categories',
            'Recommend career domains & technologies to learn',
            'Detailed career roadmap (Career Growth Path)'
        ],

        featCVTitle: 'Auto CV Builder,\nLand Your Dream Job.',
        featCVDesc: 'Automatically extract credentials, skills, certificates, and projects from GPA and Goals to compile a professional resume in seconds. Print to crisp PDF formats.',
        featCVItems: [
            'Autofill credentials directly from GPA and Goals trackers',
            'Interactive editor with standard professional resume format',
            'Print to PDF and live A4 preview inside the browser',
            'Permanent access for Pro users, 7-day renewal policy for Free users'
        ],

        featSpotifyTitle: 'My Spotify,\nUnlimited Music.',
        featSpotifyDesc: 'Listen to music anywhere without buying a premium Spotify account. Experience ultimate music streaming right in the app, perfect for on-the-go.',
        featSpotifyItems: ['Listen without Spotify account', 'Seamless repeat playback mode', 'Create and share custom playlists'],

        promoTag: 'New Feature',
        promoTitle: 'Discover My Storage',
        promoDesc: 'Secure personal storage space. Notes, files, images & media - all in one single place.',
        promoBtn: 'Experience Now',
        featStorageItems: ['Rich Text Multimedia Notes', 'Store & Preview Files/Media', 'Absolute Security & Privacy'],

        footerBuilt: 'Built with ❤️ and advanced AI technology.',
        langName: 'English',
        footerLogoText: 'A smart learning ecosystem and life management tool designed for students.',
        footerCol1Title: 'CORE FEATURES',
        footerCol2Title: 'EXPANDED UTILITIES',
        footerCol3Title: 'USEFUL LINKS',
        footerDev: 'Developer',
        footerSupportEmail: 'Support Email',
        footerPersonalPage: 'Personal Profile',
        footerAIAdvisor: 'AI Your Own',
        footerCareer: 'AI Career Guidance',
        footerFinance: 'Personal Finance',
        footerJournal: 'Healing Journal',
        footerFocus: 'Focus & Lofi Music',
        footerSchedule: 'Visual Timetable',
        footerHabit: 'Habits & D-Day',
        footerGPATracker: 'GPA Tracker (VNU)',
        footerSpotify: 'My Spotify',
        footerStorage: 'My Storage (Secure)',
        footerCVBuilder: 'Auto CV Builder'
    },
    ko: {
        install: '앱 설치',
        login: '로그인',
        heroTag: '올인원 개인 비서',
        heroTitle1: '라이프 매니지먼트',
        heroTitle2: '스마트하고 효율적으로',
        heroDesc: 'SmartLife는 자산 관리, 일정 조율 및 개인 목표 달성을 도와줍니다. 하나의 통합 앱으로 해결하세요.',
        startNow: '무료로 시작하기',
        learnMore: '자세히 알아보기',

        featVisualTitle: '비주얼보드 - 한눈에 보기,\n모든 것을 통제하세요.',
        featVisualDesc: '전체 일정, 목표 및 다가오는 휴일 카운트다운을 모니터링합니다. 수입 및 지출 종합 데이터로 완벽한 재정 상태를 파악하세요.',
        featVisualItems: ['직관적으로 시각화된 일정 및 목표 요약', '공휴일 카운트다운', '앱 내 모든 기능 통합 개요'],

        featAiTitle: 'AI Your Own,\n개인화된 AI 비서.',
        featAiDesc: '사용자의 개인 데이터를 분석하고 파일/이미지/오디오를 이해하며, MBTI & DISC 성격을 바탕으로 스마트하고 맞춤화된 조언을 주는 다재다능한 AI 비서입니다.',
        featAiItems: [
            '요청 시 상세 지출 및 자산 분석',
            '맞춤형 피드백을 위한 전반적인 데이터 검색',
            '다양한 포맷의 문서 파일 읽기 및 분석',
            '이미지 분석 및 시각적 콘텐츠 인식',
            '오디오 및 음성 메모 처리와 분석',
            '사용자의 MBTI & DISC 성격 유형 기반 개인화',
            '자연어로 여러 입출금 거래 내역 동시에 빠른 추가',
            '간단한 대화로 일정 및 To-do 추가/업데이트'
        ],

        featFinanceTitle: '투명한 자산 관리,\n최대 저축 실현.',
        featFinanceDesc: '상세 입출금 내역을 추적하고 직관적인 보고서를 보며, AI 분석을 통해 예산을 최적화하세요.',
        featFinanceItems: ['월/분기/연간 입출금 보고서', '투명한 자산 흐름 기록 및 모니터링', '저축 목표 설정'],

        featScheduleTitle: '시간 지배하기,\n생산성 향상.',
        featScheduleDesc: '직관적인 일정표, 스마트 우선순위 할일 목록 및 집중 타스크 완수를 위한 뽀모도로 타이머.',
        featScheduleItems: ['주간/일간 시간표', '우선순위별 할일 목록', '통합 집중 타이머'],

        featJournalTitle: '개인 일기장,\n치유와 성장.',
        featJournalDesc: '안전하고 프라이빗한 기록 공간. 감정을 돌아보고 감사 일기를 쓰며 꾸준한 기록 습관을 기릅니다.',
        featJournalItems: [
            '워드처럼 강력하고 전문적인 WYSIWYG 에디터',
            '5가지 이모지로 기록하는 직관적인 감정 추적기 (Mood Tracker)',
            '일일 감사 알림 및 다양한 영감 주제 무작위 제시',
            'StarBrain 스타 포인트 보상으로 동기부여 제공 (도파민 생성)',
            'AI 비서와 콘텍스트를 동기화하여 더욱 깊이 있는 맞춤 상담 지원'
        ],

        featFocusTitle: '깊은 집중,\n완벽한 휴식.',
        featFocusDesc: '시간 맞춤형 뽀모도로 타이머와 힐링 로파이(Lofi) 음악 라이브러리로 학업 및 업무 집중도를 높입니다.',
        featFocusItems: ['사용자 맞춤형 뽀모도로 타이머', '로파이 음악 및 배경 자연음 사운드', '집중 시간 통계 보고'],

        featHabitTitle: '스스로의 룰,\n목표를 향해 나아가다.',
        featHabitDesc: '보상형 별점(Streak) 기반 습관 형성을 시각화합니다. 디데이 카운트다운과 추억 기념일을 놓치지 마세요.',
        featHabitItems: ['습관 관리 및 연속 일수(Streak) 분석', '별점 및 배지 시스템으로 건강한 동기부여 유도', '중요 일정 디데이(D-Day) 카운트다운', '추억과 이정표의 기념일 세기'],

        featGoalsTitle: '목표 설정,\n꿈을 현실로.',
        featGoalsDesc: '장기 및 단기 목표 진행률을 단계별로 파악하세요. 생각에 그치지 않고 행동으로 실현합니다.',
        featGoalsItems: ['직관적인 진행률 대시보드', '데드라인 리마인더', '퍼페추얼 만년 달력 지원'],

        featGpaTitle: 'GPA 트래커,\n학점 완벽 관리.',
        featGpaDesc: '맞춤형 학점 관리 도구. 학기별 이수 목표를 설정하고 평점을 자동 정밀 산출합니다.',
        featGpaItems: ['유연한 목표 학점 설정', '학업 로드맵 이력 관리', '쉽고 단순한 성적 대시보드'],

        featCareerTitle: 'AI 진로 상담사,\n미래를 설계하다.',
        featCareerDesc: 'GPA 성적, MBTI/DISC 성격 유형 및 취미를 AI로 정밀 분석하여 나에게 가장 적합한 경력 분야와 상세한 커리어 로드맵을 제안합니다.',
        featCareerItems: [
            'GPA 성적 및 학업적 강점 분석',
            'MBTI & DISC 성격 기반 직무 매칭',
            '추천 커리어 도메인 및 학습 필요 기술 제안',
            '단계별 커리어 로드맵 (Career Growth Path)'
        ],

        featCVTitle: '자동 이력서 작성기,\n완벽한 커리어의 시작.',
        featCVDesc: 'GPA 성적 및 Goals 대시보드의 자격증, 프로젝트, 스킬 정보를 이력서에 자동으로 연동하여 단 몇 초 만에 고품질 CV를 완성하고 PDF로 저장합니다.',
        featCVItems: [
            '학업 성적 및 활동 기록 자동 입력 (Autofill)',
            '표준 이력서 레이아웃의 실시간 직관적 에디터',
            'A4 인쇄용 PDF 즉시 인쇄 및 브라우저 미리보기',
            'Pro 요금제 영구 제공 및 Free 요금제 7일 연장 정책'
        ],

        featSpotifyTitle: 'My Spotify,\n한계 없는 음악 스트리밍.',
        featSpotifyDesc: '유료 멤버십 없이 언제 어디서나 스포티파이 음원 재생. 나만의 취향 플레이리스트로 백그라운드 재생까지 완벽.',
        featSpotifyItems: ['스포티파이 계정 없이 즉시 감상', '반복 및 셔플 무제한 스트리밍', '취향 저격 플레이리스트 빌더'],

        promoTag: '새로운 기능',
        promoTitle: 'My Storage 둘러보기',
        promoDesc: '안전하고 프라이빗한 클라우드 보관소. 텍스트 노트, 파일, 미디어 - 무엇이든 저장하세요.',
        promoBtn: '지금 체험하기',
        featStorageItems: ['서식 있는 미디어 노트 작성', '파일/이미지 업로드 및 미리보기', '최고 수준의 정보 보안'],

        contactTitle: '문의 및 제안',
        contactDesc: '앱 제휴 협력 및 발전을 위한 소중한 피드백을 기다립니다.',
        footerBuilt: '❤️와 스마트 AI 융합 기술로 제작되었습니다.',
        langName: '한국어',
        footerLogoText: '학생들을 위해 디자인된 스마트 학업 생태계 및 라이프 관리 시스템.',
        footerCol1Title: '주요 기능',
        footerCol2Title: '확장 도구',
        footerCol3Title: '연락처 정보',
        footerDev: '개발자',
        footerSupportEmail: '고객 지원 이메일',
        footerPersonalPage: '개인 프로필',
        footerAIAdvisor: 'AI Your Own',
        footerCareer: 'AI 진로 설계',
        footerFinance: '자산 관리',
        footerJournal: '힐링 다이어리',
        footerFocus: '집중 & 로파이 음악',
        footerSchedule: '일정표 개요',
        footerHabit: '습관 및 D-Day',
        footerGPATracker: 'GPA 트래커 (VNU)',
        footerSpotify: 'My Spotify 재생',
        footerStorage: 'My Storage (보안)',
        footerCVBuilder: '자동 이력서 빌더'
    }
};

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, lang, setLang }) => {
    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
    const [isDescExpanded, setIsDescExpanded] = useState(false);

    const t = translations[lang];

    const marqueeFeatures = lang === 'vi' ? [
        { name: 'AI Your Own 🧠', icon: '🤖', color: 'from-blue-500/10 to-indigo-500/10 text-indigo-700 border-indigo-200', targetId: 'ai-advisor' },
        { name: 'Cố vấn sự nghiệp AI 💼', icon: '💼', color: 'from-indigo-500/10 to-cyan-500/10 text-cyan-700 border-cyan-200', targetId: 'ai-career-advisor' },
        { name: 'Xây dựng CV tự động 📄', icon: '📝', color: 'from-purple-500/10 to-pink-500/10 text-purple-700 border-purple-200', targetId: 'cv-builder' },
        { name: 'Nhật ký chữa lành 📖', icon: '📔', color: 'from-emerald-500/10 to-teal-500/10 text-teal-700 border-teal-200', targetId: 'journal' },
        { name: 'GPA Tracker VNU 🎯', icon: '🎓', color: 'from-cyan-500/10 to-blue-500/10 text-cyan-700 border-cyan-200', targetId: 'gpa-tracker' },
        { name: 'Nghe nhạc Spotify 🎧', icon: '🎵', color: 'from-purple-500/10 to-pink-500/10 text-purple-700 border-purple-200', targetId: 'spotify' },
        { name: 'Kỷ luật Thói quen 🔥', icon: '🌟', color: 'from-orange-500/10 to-amber-500/10 text-orange-700 border-orange-200', targetId: 'habit-tracker' },
        { name: 'Tập trung Pomodoro ⏳', icon: '⏱️', color: 'from-rose-500/10 to-red-500/10 text-rose-700 border-rose-200', targetId: 'focus-music' },
        { name: 'Quản lý Tài chính 📈', icon: '💰', color: 'from-emerald-500/10 to-green-500/10 text-emerald-700 border-emerald-250', targetId: 'finance' },
        { name: 'Thời khóa biểu 📆', icon: '📅', color: 'from-blue-500/10 to-sky-500/10 text-blue-700 border-blue-200', targetId: 'schedule' },
        { name: 'Lưu trữ Bảo mật 🛡️', icon: '🔒', color: 'from-zinc-500/10 to-slate-500/10 text-zinc-700 border-zinc-300', targetId: 'secure-storage' },
        { name: 'Đếm ngược Sự kiện 🔔', icon: '⏳', color: 'from-amber-500/10 to-yellow-500/10 text-amber-700 border-amber-200', targetId: 'habit-tracker' }
    ] : lang === 'ko' ? [
        { name: 'AI Your Own 🧠', icon: '🤖', color: 'from-blue-500/10 to-indigo-500/10 text-indigo-700 border-indigo-200', targetId: 'ai-advisor' },
        { name: 'AI 커리어 상담사 💼', icon: '💼', color: 'from-indigo-500/10 to-cyan-500/10 text-cyan-700 border-cyan-200', targetId: 'ai-career-advisor' },
        { name: '자동 이력서 빌더 📄', icon: '📝', color: 'from-purple-500/10 to-pink-500/10 text-purple-700 border-purple-200', targetId: 'cv-builder' },
        { name: '힐링 다이어리 📖', icon: '📔', color: 'from-emerald-500/10 to-teal-500/10 text-teal-700 border-teal-200', targetId: 'journal' },
        { name: 'GPA 트래커 🎯', icon: '🎓', color: 'from-cyan-500/10 to-blue-500/10 text-cyan-700 border-cyan-200', targetId: 'gpa-tracker' },
        { name: '스포티파이 음악 🎧', icon: '🎵', color: 'from-purple-500/10 to-pink-500/10 text-purple-700 border-purple-200', targetId: 'spotify' },
        { name: '습관 관리 🔥', icon: '🌟', color: 'from-orange-500/10 to-amber-500/10 text-orange-700 border-orange-200', targetId: 'habit-tracker' },
        { name: '뽀모도로 타이머 ⏳', icon: '⏱️', color: 'from-rose-500/10 to-red-500/10 text-rose-700 border-rose-200', targetId: 'focus-music' },
        { name: '자산 관리 📈', icon: '💰', color: 'from-emerald-500/10 to-green-500/10 text-emerald-700 border-emerald-255', targetId: 'finance' },
        { name: '시각적 일정표 📆', icon: '📅', color: 'from-blue-500/10 to-sky-500/10 text-blue-700 border-blue-200', targetId: 'schedule' },
        { name: '안전한 보관소 🛡️', icon: '🔒', color: 'from-zinc-500/10 to-slate-500/10 text-zinc-700 border-zinc-300', targetId: 'secure-storage' },
        { name: '이벤트 카운트다운 🔔', icon: '⏳', color: 'from-amber-500/10 to-yellow-500/10 text-amber-700 border-amber-200', targetId: 'habit-tracker' }
    ] : [
        { name: 'AI Your Own 🧠', icon: '🤖', color: 'from-blue-500/10 to-indigo-500/10 text-indigo-700 border-indigo-200', targetId: 'ai-advisor' },
        { name: 'AI Career Guidance 💼', icon: '💼', color: 'from-indigo-500/10 to-cyan-500/10 text-cyan-700 border-cyan-200', targetId: 'ai-career-advisor' },
        { name: 'Auto CV Builder 📄', icon: '📝', color: 'from-purple-500/10 to-pink-500/10 text-purple-700 border-purple-200', targetId: 'cv-builder' },
        { name: 'Healing Journal 📖', icon: '📔', color: 'from-emerald-500/10 to-teal-500/10 text-teal-700 border-teal-200', targetId: 'journal' },
        { name: 'GPA Tracker 🎯', icon: '🎓', color: 'from-cyan-500/10 to-blue-500/10 text-cyan-700 border-cyan-200', targetId: 'gpa-tracker' },
        { name: 'Spotify Music Player 🎧', icon: '🎵', color: 'from-purple-500/10 to-pink-500/10 text-purple-700 border-purple-200', targetId: 'spotify' },
        { name: 'Habit & Streaks 🔥', icon: '🌟', color: 'from-orange-500/10 to-amber-500/10 text-orange-700 border-orange-200', targetId: 'habit-tracker' },
        { name: 'Pomodoro Focus ⏳', icon: '⏱️', color: 'from-rose-500/10 to-red-500/10 text-rose-700 border-rose-200', targetId: 'focus-music' },
        { name: 'Finance Manager 📈', icon: '💰', color: 'from-emerald-500/10 to-green-500/10 text-emerald-700 border-emerald-255', targetId: 'finance' },
        { name: 'Visual Schedule 📆', icon: '📅', color: 'from-blue-500/10 to-sky-500/10 text-blue-700 border-blue-200', targetId: 'schedule' },
        { name: 'Secure Storage 🛡️', icon: '🔒', color: 'from-zinc-500/10 to-slate-500/10 text-zinc-700 border-zinc-300', targetId: 'secure-storage' },
        { name: 'Event Countdown 🔔', icon: '⏳', color: 'from-amber-500/10 to-yellow-500/10 text-amber-700 border-amber-200', targetId: 'habit-tracker' }
    ];

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            const headerOffset = 80;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    const toggleLang = () => {
        setLang(lang === 'vi' ? 'en' : lang === 'en' ? 'ko' : 'vi');
    };

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900 overflow-x-hidden">
            <InstallGuideModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} />

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100/80 transition-all duration-300">
                <div className="w-full px-4 xs:px-6 sm:px-8 lg:px-12 h-16 sm:h-[72px] flex items-center justify-between">
                    <div className="flex items-center gap-2.5 sm:gap-3 hover:opacity-90 transition-opacity cursor-pointer animate-fade-in" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-md shadow-indigo-100 border border-gray-100 shrink-0">
                            <img src="/pwa-192x192.png" alt="SmartLife" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-extrabold text-base xs:text-lg sm:text-xl tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">SmartLife</span>
                    </div>
                    <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                        {/* Language Toggle */}
                        <button
                            onClick={toggleLang}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 xs:px-3 xs:py-2 text-gray-600 hover:bg-gray-100/80 rounded-full transition-all font-semibold text-xs sm:text-sm"
                            title="Switch Language"
                        >
                            <Globe size={16} className="sm:w-[18px] sm:h-[18px] text-gray-500" />
                            <span className="uppercase tracking-wider font-semibold">{lang}</span>
                        </button>

                        <button
                            onClick={() => setIsInstallModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 xs:px-4 xs:py-2 bg-indigo-50 text-indigo-600 rounded-full font-bold hover:bg-indigo-100 transition-all text-xs sm:text-sm border border-indigo-100/50 shadow-sm"
                            title={t.install}
                        >
                            <Download size={16} className="sm:w-[18px] sm:h-[18px]" />
                            <span className="hidden sm:inline">{t.install}</span>
                        </button>
                        <button
                            onClick={onLogin}
                            className="px-4 py-2 xs:px-5 xs:py-2.5 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition-all text-xs sm:text-sm shadow-md shadow-gray-200/50"
                        >
                            {t.login}
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-[76px] pb-6 sm:pt-[92px] sm:pb-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex flex-col justify-center">
                {/* Background Animated Glows */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-purple-300/30 rounded-full blur-[80px] sm:blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '4s' }}></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-indigo-300/30 rounded-full blur-[80px] sm:blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] sm:w-[800px] sm:h-[400px] bg-pink-200/20 rounded-full blur-[100px] sm:blur-[150px] pointer-events-none"></div>

                {/* Floating Elements (Hidden on very small screens) */}
                <div className="hidden md:block absolute inset-0 pointer-events-none z-0">
                    {/* Floating Wallet */}
                    <div className="absolute top-[20%] left-[15%] w-16 h-16 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white flex items-center justify-center animate-bounce" style={{ animationDuration: '4s' }}>
                        <Wallet className="text-emerald-500" size={32} />
                    </div>
                    {/* Floating Calendar */}
                    <div className="absolute top-[15%] right-[15%] w-14 h-14 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white flex items-center justify-center animate-bounce" style={{ animationDuration: '5s', animationDelay: '0.5s' }}>
                        <CalendarDays className="text-blue-500" size={28} />
                    </div>
                    {/* Floating Music */}
                    <div className="absolute bottom-[20%] left-[20%] w-14 h-14 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white flex items-center justify-center animate-bounce" style={{ animationDuration: '4.5s', animationDelay: '1s' }}>
                        <Music className="text-purple-500" size={28} />
                    </div>
                    {/* Floating AI */}
                    <div className="absolute bottom-[25%] right-[20%] w-16 h-16 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white flex items-center justify-center animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.2s' }}>
                        <Brain className="text-indigo-500" size={32} />
                    </div>
                </div>

                <div className="max-w-5xl mx-auto text-center relative z-10 w-full overflow-hidden">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white border border-indigo-100 shadow-sm text-indigo-600 text-xs font-bold uppercase tracking-wider mb-3 sm:mb-4 animate-fade-in-up hover:scale-105 transition-transform cursor-default">
                        <Zap size={14} className="text-yellow-500" /> {t.heroTag}
                    </div>
                    <h1 className="text-2xl xs:text-4xl sm:text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-3 sm:mb-4 leading-[1.15] md:leading-[1.1] animate-fade-in-up delay-100" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                        {t.heroTitle1} <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-[length:200%_auto] animate-pulse">
                            {t.heroTitle2}
                        </span>
                    </h1>

                    {/* Infinite Scrolling Ticker of Features */}
                    <div className="w-full max-w-full py-1 mb-3 sm:mb-4 select-none relative overflow-hidden animate-fade-in-up delay-150">
                        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
                        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />

                        <div className="animate-marquee flex items-center gap-3 py-1">
                            {[...marqueeFeatures, ...marqueeFeatures].map((item, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => scrollToSection(item.targetId)}
                                    className={`flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r ${item.color} border border-white/45 rounded-full font-bold text-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] whitespace-nowrap hover:scale-105 hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-300 cursor-pointer`}
                                >
                                    <span className="text-xl">{item.icon}</span>
                                    <span>{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="text-gray-600 mb-5 sm:mb-6 max-w-full sm:max-w-3xl mx-auto leading-relaxed animate-fade-in-up delay-200 px-1">
                        {lang === 'vi' ? (
                            <div className="text-sm sm:text-base md:text-xl text-center">
                                SmartLife <strong>super tool</strong> dành cho sinh viên. It helps them về <strong>tài chính</strong>, <strong>lịch trình</strong>, <strong>todolist mục tiêu cá nhân, mục tiêu nghề nghiệp dài hạn</strong>, <strong>thói quen</strong>, <strong>countdown/up</strong> và cả <strong>Viết nhật kí</strong>.
                                {isDescExpanded ? (
                                    <span>
                                        {' '}Ngoài ra còn có <strong>GPA tracker</strong> cho sinh viên VNU, <strong>My spotify</strong> nghe nhạc và podcast mình tự thêm, <strong>Pomodoro</strong> và các phương pháp bấm giờ học tập, <strong>Không gian học</strong>, <strong>Kho lưu trữ tập trung</strong>. Đặc biệt là <strong>Own AI Advisor</strong> nó truy cập toàn bộ dữ liệu và action theo yêu cầu của người dùng một cách thông minh và cá nhân hóa. Tất cả các tính năng sinh viên cần đều trong Smartlife. Mọi thứ mượt và chi tiết thông minh + tối giản.
                                        <button onClick={() => setIsDescExpanded(false)} className="text-indigo-600 font-semibold hover:underline ml-2 text-sm md:text-base whitespace-nowrap">Ẩn bớt</button>
                                    </span>
                                ) : (
                                    <span>
                                        ... <button onClick={() => setIsDescExpanded(true)} className="text-indigo-600 font-semibold hover:underline ml-1 text-sm md:text-base whitespace-nowrap">Xem thêm</button>
                                    </span>
                                )}
                            </div>
                        ) : lang === 'ko' ? (
                            <div className="text-sm sm:text-base md:text-xl text-center">
                                SmartLife는 대학생을 위한 <strong>슈퍼 툴(Super Tool)</strong>입니다. <strong>자산 관리</strong>, <strong>일정 계획</strong>, <strong>목표 달성</strong>, <strong>습관 관리</strong>, <strong>카운트다운/업</strong>, 그리고 <strong>일기 기록</strong>까지 하나로 해결하세요.
                                {isDescExpanded ? (
                                    <span>
                                        {' '}추가로 VNU 학생들을 위한 <strong>GPA 트래커</strong>, 자유롭게 감상하는 <strong>My Spotify</strong> 음악 플레이어, <strong>뽀모도로 집중 타이머</strong>, <strong>학습 공간</strong> 및 <strong>프라이빗 저장소</strong>를 제공합니다. 특히 사용자의 데이터를 안전하게 연동하여 스마트하고 맞춤화된 조언을 주는 <strong>나만의 AI 어드바이저</strong> 기능이 탑재되어 있습니다. 대학 생활에 필요한 모든 도구를 스마트하고 심플한 디자인으로 만나보세요.
                                        <button onClick={() => setIsDescExpanded(false)} className="text-indigo-600 font-semibold hover:underline ml-2 text-sm md:text-base whitespace-nowrap">접기</button>
                                    </span>
                                ) : (
                                    <span>
                                        ... <button onClick={() => setIsDescExpanded(true)} className="text-indigo-600 font-semibold hover:underline ml-1 text-sm md:text-base whitespace-nowrap">더 보기</button>
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm sm:text-base md:text-xl text-center">
                                SmartLife is a <strong>super tool</strong> designed for students. It helps them manage <strong>finances</strong>, <strong>schedules</strong>, <strong>personal goals</strong>, <strong>habits</strong>, <strong>countdowns/ups</strong>, and <strong>healing journals</strong>.
                                {isDescExpanded ? (
                                    <span>
                                        {' '}It also features a VNU-specific <strong>GPA tracker</strong>, a custom <strong>My Spotify</strong> client, <strong>Pomodoro</strong> focus modes, <strong>learning spaces</strong>, and <strong>secure storage</strong>. Most importantly, your <strong>own AI Advisor</strong> analyzes your data to take smart, personalized actions. Every single tool you need is wrapped in a fluid, beautiful, and minimal interface.
                                        <button onClick={() => setIsDescExpanded(false)} className="text-indigo-600 font-semibold hover:underline ml-2 text-sm md:text-base whitespace-nowrap">Show less</button>
                                    </span>
                                ) : (
                                    <span>
                                        ... <button onClick={() => setIsDescExpanded(true)} className="text-indigo-600 font-semibold hover:underline ml-1 text-sm md:text-base whitespace-nowrap">Read more</button>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col xs:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-in-up delay-300 w-full max-w-md sm:max-w-none mx-auto pb-2">
                        <div className="relative group w-full xs:w-auto">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-500"></div>
                            <button
                                onClick={onLogin}
                                className="relative w-full xs:w-auto px-5 py-3 xs:px-8 xs:py-4 bg-gray-900 text-white rounded-full font-bold text-sm xs:text-base sm:text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                {t.startNow} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                        <button onClick={() => scrollToSection('site-footer')} className="w-full xs:w-auto px-5 py-3 xs:px-8 xs:py-4 bg-white text-gray-700 border border-gray-200 shadow-sm rounded-full font-bold text-sm xs:text-base sm:text-lg hover:bg-gray-50 hover:shadow-md transition-all flex items-center justify-center group">
                            {t.learnMore}
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <div id="features" className="space-y-16 sm:space-y-24 py-12 sm:py-20 pb-0">
                {/* Feature NEW: AI Advisor */}
                <section id="ai-advisor" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 py-12 sm:py-20 rounded-3xl border border-indigo-100">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="order-2 md:order-1 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-300 to-purple-300 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
                            {/* Image Composition: Main + Sub overlay */}
                            <div className="relative">
                                {/* Ảnh chính (lớn) - trung tâm */}
                                <img
                                    src="/ai-feature-main.png"
                                    alt="AI Financial Advisor"
                                    className="relative rounded-2xl shadow-2xl border border-white/50 w-full transform group-hover:scale-[1.02] transition-transform duration-500 z-10"
                                />
                                {/* Ảnh phụ (nhỏ) - góc dưới bên phải */}
                                <img
                                    src="/ai-feature-sub.png"
                                    alt="AI Charts"
                                    className="absolute -bottom-3 -right-2 sm:-bottom-6 sm:-right-4 w-2/5 rounded-2xl shadow-2xl border-2 border-white transform rotate-3 group-hover:rotate-6 group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 z-20 cursor-pointer hover:shadow-indigo-200/50"
                                />
                            </div>
                        </div>
                        <div className="order-1 md:order-2 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
                                <Sparkles size={14} className="animate-pulse" /> {lang === 'vi' ? 'AI Cá Nhân Hóa' : lang === 'ko' ? '맞춤형 AI' : 'Personalized AI'}
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 whitespace-pre-line leading-tight">{t.featAiTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featAiDesc}
                            </p>
                            <ul className="space-y-4 pt-2">
                                {t.featAiItems.map((item, i) => {
                                    const aiIcons = [
                                        <Wallet className="text-emerald-600" size={18} />,
                                        <Brain className="text-indigo-600" size={18} />,
                                        <FileText className="text-blue-600" size={18} />,
                                        <Image className="text-pink-600" size={18} />,
                                        <AudioLines className="text-violet-600" size={18} />,
                                        <Users className="text-amber-600" size={18} />,
                                        <Zap className="text-orange-600" size={18} />,
                                        <CalendarDays className="text-cyan-600" size={18} />
                                    ];
                                    const aiIconBgs = [
                                        'bg-emerald-100', 'bg-indigo-100', 'bg-blue-100', 'bg-pink-100',
                                        'bg-violet-100', 'bg-amber-100', 'bg-orange-100', 'bg-cyan-100'
                                    ];
                                    return (
                                        <li key={i} className="flex items-start gap-3 text-gray-800 font-semibold bg-white/60 p-3 rounded-xl border border-indigo-50 shadow-sm">
                                            <div className={`${aiIconBgs[i] || 'bg-indigo-100'} p-1.5 rounded-lg shrink-0 mt-0.5`}>
                                                {aiIcons[i] || <Brain className="text-indigo-600" size={18} />}
                                            </div>
                                            <span>{item}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Feature 4.25: AI Career Counselor (NEW) */}
                <section id="ai-career-advisor" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-gradient-to-br from-indigo-50/20 via-cyan-50/15 to-purple-50/20 py-12 sm:py-20 rounded-3xl border border-indigo-100/50 mb-16 sm:mb-20">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="order-2 md:order-1 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-300/30 to-cyan-300/30 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <img
                                src="/career_advisor_mockup.png"
                                alt="AI Career Counselor"
                                className="relative rounded-2xl shadow-2xl border border-white/50 w-full transform group-hover:scale-[1.02] transition-transform duration-500 z-10"
                            />
                        </div>
                        <div className="order-1 md:order-2 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
                                <Sparkles size={14} className="animate-pulse" /> {lang === 'vi' ? 'Định Hướng Sự Nghiệp Pro' : lang === 'ko' ? 'AI 진로 네비게이터' : 'AI Career Path Finder'}
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 whitespace-pre-line leading-tight">{t.featCareerTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featCareerDesc}
                            </p>
                            <ul className="space-y-3 pt-2">
                                {t.featCareerItems && t.featCareerItems.map((item: string, i: number) => {
                                    const careerIcons = [
                                        <GraduationCap className="text-indigo-600" size={18} />,
                                        <Users className="text-purple-600" size={18} />,
                                        <Brain className="text-cyan-600" size={18} />,
                                        <Target className="text-pink-600" size={18} />
                                    ];
                                    const careerIconBgs = [
                                        'bg-indigo-100', 'bg-purple-100', 'bg-cyan-100', 'bg-pink-100'
                                    ];
                                    return (
                                        <li key={i} className="flex items-start gap-3 text-gray-800 font-semibold bg-white/60 p-3 rounded-xl border border-indigo-50/50 shadow-sm">
                                            <div className={`${careerIconBgs[i] || 'bg-indigo-100'} p-1.5 rounded-lg shrink-0 mt-0.5`}>
                                                {careerIcons[i] || <Target className="text-indigo-600" size={18} />}
                                            </div>
                                            <span>{item}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Feature 4.5: Auto CV Builder (NEW) */}
                <section id="cv-builder" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-gradient-to-br from-purple-50/20 via-pink-50/15 to-rose-50/20 py-12 sm:py-20 rounded-3xl border border-purple-150/50 mb-16 sm:mb-20">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
                                <Sparkles size={14} className="animate-pulse" /> {lang === 'vi' ? 'Xây Dựng CV Chuyên Nghiệp' : lang === 'ko' ? '프로페셔널 이력서 빌더' : 'Professional CV Builder'}
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 whitespace-pre-line leading-tight">{t.featCVTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featCVDesc}
                            </p>
                            <ul className="space-y-3 pt-2">
                                {t.featCVItems && t.featCVItems.map((item: string, i: number) => {
                                    const cvIcons = [
                                        <Zap className="text-purple-600" size={18} />,
                                        <FileText className="text-blue-600" size={18} />,
                                        <Download className="text-emerald-600" size={18} />,
                                        <ShieldCheck className="text-amber-600" size={18} />
                                    ];
                                    const cvIconBgs = [
                                        'bg-purple-100', 'bg-blue-100', 'bg-emerald-100', 'bg-amber-100'
                                    ];
                                    return (
                                        <li key={i} className="flex items-start gap-3 text-gray-800 font-semibold bg-white/60 p-3 rounded-xl border border-purple-50/50 shadow-sm">
                                            <div className={`${cvIconBgs[i] || 'bg-purple-100'} p-1.5 rounded-lg shrink-0 mt-0.5`}>
                                                {cvIcons[i] || <CheckCircle2 className="text-purple-600" size={18} />}
                                            </div>
                                            <span>{item}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-purple-300/30 to-pink-300/30 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <img
                                src="/cv_builder_mockup.png"
                                alt="Auto CV Builder"
                                className="relative rounded-2xl shadow-2xl border border-white/50 w-full transform group-hover:scale-[1.02] transition-transform duration-500 z-10"
                            />
                        </div>
                    </div>
                </section>

                {/* Feature NEW: Career & Life Goals AI */}
                <section id="career-life-goals" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-gradient-to-br from-purple-50/50 via-indigo-50/50 to-pink-50/30 py-12 sm:py-20 rounded-3xl border border-purple-100/80 shadow-sm relative overflow-hidden">
                    <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-pink-400/5 blur-3xl pointer-events-none" />
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="order-2 md:order-2 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-purple-300 via-indigo-300 to-pink-300 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
                            {/* Image Composition: Main + Sub overlay */}
                            <div className="relative">
                                {/* Ảnh chính (lớn) - trung tâm */}
                                <img
                                    src="/goalscareer1.png"
                                    alt="Mục tiêu nghề nghiệp & Lộ trình kỹ năng"
                                    className="relative rounded-2xl shadow-2xl border border-white/50 w-full transform group-hover:scale-[1.02] transition-transform duration-500 z-10"
                                />
                                {/* Ảnh phụ (nhỏ) - góc dưới bên trái */}
                                <img
                                    src="/goalscareer2.png"
                                    alt="Mục tiêu dài hạn 5 năm"
                                    className="absolute -bottom-3 -left-2 sm:-bottom-6 sm:-left-4 w-2/5 rounded-2xl shadow-2xl border-2 border-white transform -rotate-3 group-hover:-rotate-6 group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 z-20 cursor-pointer hover:shadow-purple-200/50"
                                />
                            </div>
                        </div>
                        <div className="order-1 md:order-1 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
                                <Sparkles size={14} className="animate-pulse" /> {lang === 'vi' ? 'Đột Phá Kỹ Năng' : lang === 'ko' ? '경력 개발 혁신' : 'Career Goal Breakthrough'}
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight">
                                {lang === 'vi' ? (
                                    <>Lập Lộ Trình Sự Nghiệp & <br />Mục Tiêu Tầm Nhìn 5 Năm</>
                                ) : lang === 'ko' ? (
                                    <>경력 로드맵 구축 및 <br />5개년 장기 비전 목표 관리</>
                                ) : (
                                    <>Build Career Roadmap & <br />5-Year Long-Term Vision Goals</>
                                )}
                            </h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {lang === 'vi'
                                    ? 'Định hình tương lai với bộ công cụ quản lý kỹ năng và mục tiêu dài hạn. Được chắp cánh bởi AI để phân tích bảng điểm GPA học tập, thiết kế lộ trình cá nhân hóa và đồng bộ liền mạch với lịch trình của bạn.'
                                    : lang === 'ko'
                                        ? '기술 관리 및 장기 목표 설정 도구로 미래를 정의하세요. 학업 성적 GPA와 연동하여 학습 격차를 분석하고 AI 기반 맞춤 로드맵을 자동으로 구축합니다.'
                                        : 'Shape your future with comprehensive skill management and long-term targets. Powered by AI to analyze your GPA academic records, design personalized roadmaps, and sync flawlessly with your lifestyle.'
                                }
                            </p>
                            <ul className="space-y-4 pt-2">
                                <li className="flex items-start gap-3 text-gray-800 font-semibold bg-white/60 p-3 rounded-xl border border-purple-50 shadow-sm">
                                    <div className="bg-purple-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                                        <Sparkles className="text-purple-600" size={18} />
                                    </div>
                                    <span>
                                        {lang === 'vi'
                                            ? 'AI phân tích dữ liệu và hỗ trợ lộ trình nghề nghiệp cá nhân'
                                            : lang === 'ko'
                                                ? 'AI 데이터 분석 및 맞춤형 경력 개발 로드맵 지원'
                                                : 'AI analyzes data & customizes personal career roadmap'
                                        }
                                    </span>
                                </li>
                                <li className="flex items-start gap-3 text-gray-800 font-semibold bg-white/60 p-3 rounded-xl border border-indigo-50 shadow-sm">
                                    <div className="bg-indigo-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                                        <Target className="text-indigo-600" size={18} />
                                    </div>
                                    <span>
                                        {lang === 'vi'
                                            ? 'Đặt ra mục tiêu nghề nghiệp các kiến thức kỹ năng và dự án'
                                            : lang === 'ko'
                                                ? '직무별 지식, 기술 습득 및 개인 포트폴리오 프로젝트 관리'
                                                : 'Set career goals for domain knowledge, skills & projects'
                                        }
                                    </span>
                                </li>
                                <li className="flex items-start gap-3 text-gray-800 font-semibold bg-white/60 p-3 rounded-xl border border-pink-50 shadow-sm">
                                    <div className="bg-pink-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                                        <Star className="text-pink-600" size={18} />
                                    </div>
                                    <span>
                                        {lang === 'vi'
                                            ? 'Đặt ra mục tiêu dài hạn 5 năm'
                                            : lang === 'ko'
                                                ? '5개년 장기 인생 비전 목표 및 마일스톤 설정'
                                                : 'Define 5-year long-term life vision and major milestones'
                                        }
                                    </span>
                                </li>
                                <li className="flex items-start gap-3 text-gray-800 font-semibold bg-white/60 p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="bg-slate-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                                        <CheckCircle2 className="text-slate-600" size={18} />
                                    </div>
                                    <span>
                                        {lang === 'vi'
                                            ? 'Theo dõi tổng thể đồng nhất với hệ sinh thái Smartlife'
                                            : lang === 'ko'
                                                ? 'SmartLife 스마트 셀프 매니지먼트 생태계와의 완벽한 통합'
                                                : 'Holistic progress tracking synced with SmartLife ecosystem'
                                        }
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Feature 0: Visual Board */}
                <section className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-indigo-50/30 py-12 sm:py-20 rounded-3xl border border-indigo-50">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="space-y-6">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-indigo-100 border border-indigo-50 shrink-0">
                                <img src="/pwa-192x192.png" alt="Visual Board" className="w-full h-full object-cover" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 whitespace-pre-line">{t.featVisualTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featVisualDesc}
                            </p>
                            <ul className="space-y-3">
                                {t.featVisualItems.map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 text-gray-700 font-medium">
                                        <ShieldCheck className="text-indigo-500 shrink-0 mt-1" size={20} />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-200 to-purple-200 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                            <img
                                src="/assets/visual-board-preview.png"
                                alt="Visual Board Overview"
                                className="relative rounded-2xl shadow-2xl border border-gray-100 transform group-hover:-translate-y-2 transition-transform duration-500"
                            />
                        </div>
                    </div>
                </section>

                {/* Feature 1: Finance */}
                <section id="finance" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-16">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="order-2 md:order-1 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative">
                                <img
                                    src="/assets/finance_preview.png"
                                    alt="Quản lý Tài chính"
                                    className="relative rounded-2xl shadow-2xl border border-white/50 transform group-hover:scale-[1.02] transition-transform duration-500 z-10 w-full"
                                />
                                <img
                                    src="/finance_preview2.png"
                                    alt="Chi tiết Tài chính"
                                    className="absolute -bottom-3 -left-2 sm:-bottom-6 sm:-left-4 w-2/5 rounded-2xl shadow-2xl border-2 border-white transform -rotate-3 group-hover:-rotate-6 group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 z-20 cursor-pointer hover:shadow-emerald-200/50"
                                />
                            </div>
                        </div>
                        <div className="order-1 md:order-2 space-y-6">
                            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                <Wallet size={28} />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 whitespace-pre-line">{t.featFinanceTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featFinanceDesc}
                            </p>
                            <ul className="space-y-3">
                                {t.featFinanceItems.map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 text-gray-700 font-medium">
                                        <ShieldCheck className="text-emerald-500 shrink-0 mt-1" size={20} />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Feature 2: Schedule */}
                <section id="schedule" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-gray-50/50 py-12 sm:py-20 rounded-3xl">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="space-y-6">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                                <CalendarDays size={28} />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 whitespace-pre-line">{t.featScheduleTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featScheduleDesc}
                            </p>
                            <ul className="space-y-3">
                                {t.featScheduleItems.map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 text-gray-700 font-medium">
                                        <ShieldCheck className="text-blue-500 shrink-0 mt-1" size={20} />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                            <img
                                src="/assets/schedule_preview.png"
                                alt="Quản lý Lịch trình"
                                className="relative rounded-2xl shadow-2xl border border-gray-100 transform group-hover:-translate-y-2 transition-transform duration-500"
                            />
                        </div>
                    </div>
                </section>

                {/* Feature 2.25: Personal Journal (NEW) */}
                <section id="journal" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-emerald-50/30 py-12 sm:py-20 rounded-3xl border border-emerald-50">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
                                <Sparkles size={14} className="animate-pulse" /> {lang === 'vi' ? 'Tính năng mới nổi bật' : lang === 'ko' ? '주요 신기능' : 'Key New Feature'}
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 whitespace-pre-line leading-tight">{t.featJournalTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featJournalDesc}
                            </p>
                            <ul className="space-y-3 pt-2">
                                {t.featJournalItems && t.featJournalItems.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3 text-gray-800 font-semibold bg-white/60 p-3 rounded-xl border border-emerald-50 shadow-sm">
                                        <div className="bg-emerald-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                                            <BookOpen className="text-emerald-600" size={18} />
                                        </div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-emerald-250 to-teal-200 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
                            {/* Image Composition: Main + 2 Overlapping cards */}
                            <div className="relative pt-6 pb-8 px-4 sm:px-6">
                                {/* Main Image: journey1.png */}
                                <img
                                    src="/journey1.png"
                                    alt="SmartLife Journal Main"
                                    className="relative rounded-2xl shadow-2xl border border-white/50 transform group-hover:scale-[1.02] transition-transform duration-500 z-10 w-full"
                                />
                                {/* Overlap Image 2: journey2.png (bottom right) */}
                                <img
                                    src="/journey2.png"
                                    alt="SmartLife Journal Moods & Calendar"
                                    className="absolute -bottom-3 -right-1 sm:-bottom-6 sm:-right-2 w-[42%] rounded-2xl shadow-2xl border border-white transform rotate-3 group-hover:rotate-6 group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 z-20 cursor-pointer hover:shadow-emerald-200/50"
                                />
                                {/* Overlap Image 3: journey3.png (top left / floating) */}
                                <img
                                    src="/journey3.png"
                                    alt="SmartLife Journal Prompts & Stats"
                                    className="absolute -top-2 -left-2 sm:-top-4 sm:-left-4 w-[38%] rounded-2xl shadow-2xl border border-white transform -rotate-6 group-hover:-rotate-12 group-hover:scale-110 group-hover:translate-y-1 transition-all duration-500 z-20 cursor-pointer hover:shadow-teal-200/50"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Feature 2.5: Focus & Music (NEW) */}
                <section id="focus-music" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-purple-50/30 py-12 sm:py-20 rounded-3xl border border-purple-50">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="order-2 md:order-1 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-purple-200 to-pink-200 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                            {/* Image Composition */}
                            <div className="relative">
                                <img
                                    src="/assets/focus_feature_2.png"
                                    alt="Focus Timer"
                                    className="relative rounded-2xl shadow-2xl border border-gray-100 transform group-hover:scale-105 transition-transform duration-500 z-10"
                                />
                                <img
                                    src="/assets/focus_feature_1.png"
                                    alt="Music Player"
                                    className="absolute -bottom-3 -right-2 sm:-bottom-8 sm:-right-4 w-2/5 rounded-2xl shadow-2xl border border-gray-100 transform rotate-3 group-hover:rotate-6 transition-transform duration-500 z-20"
                                />
                            </div>
                        </div>
                        <div className="order-1 md:order-2 space-y-6">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                                <Headphones size={28} />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 whitespace-pre-line">{t.featFocusTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featFocusDesc}
                            </p>
                            <ul className="space-y-3">
                                {t.featFocusItems && t.featFocusItems.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3 text-gray-700 font-medium">
                                        <Zap className="text-purple-500 shrink-0 mt-1" size={20} />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Feature 2.75: Habit Tracker & Countdown (NEW) */}
                <section id="habit-tracker" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-orange-50/30 py-12 sm:py-20 rounded-3xl border border-orange-50">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
                                <Sparkles size={14} className="animate-pulse" /> {lang === 'vi' ? 'Tính năng Mới' : lang === 'ko' ? '새로운 기능' : 'New Feature'}
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 whitespace-pre-line leading-tight">{t.featHabitTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featHabitDesc}
                            </p>
                            <ul className="space-y-3 pt-2">
                                {t.featHabitItems && t.featHabitItems.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3 text-gray-800 font-semibold bg-white/60 p-3 rounded-xl border border-orange-50 shadow-sm">
                                        <div className="bg-orange-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                                            <Flame className="text-orange-600" size={18} />
                                        </div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-orange-200 to-amber-200 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
                            {/* Image Composition */}
                            <div className="relative">
                                <img
                                    src="/habitprimary.png"
                                    alt="Habit Tracker Main"
                                    className="relative rounded-2xl shadow-2xl border border-white/50 transform scale-105 group-hover:scale-[1.07] transition-transform duration-500 z-10 w-full"
                                />
                                <img
                                    src="/habitsecond.png"
                                    alt="Countdown & Count-up"
                                    className="absolute -bottom-4 -right-3 sm:-bottom-10 sm:-right-8 w-[35%] rounded-2xl shadow-2xl border-2 border-white transform rotate-3 group-hover:rotate-6 group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 z-20 cursor-pointer hover:shadow-orange-200/50"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Feature 3: Goals */}
                <section className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-16">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="order-2 md:order-1 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-orange-100 to-amber-100 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
                            <img
                                src="/assets/goals_preview.png"
                                alt="Quản lý Mục tiêu"
                                className="relative rounded-2xl shadow-2xl border border-gray-100 transform group-hover:-translate-y-2 transition-transform duration-500"
                            />
                        </div>
                        <div className="order-1 md:order-2 space-y-6">
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
                                <Rocket size={28} />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 whitespace-pre-line">{t.featGoalsTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featGoalsDesc}
                            </p>
                            <ul className="space-y-3">
                                {t.featGoalsItems.map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 text-gray-700 font-medium">
                                        <ShieldCheck className="text-orange-500 shrink-0 mt-1" size={20} />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Feature 4: GPA Tracker (NEW) */}
                <section id="gpa-tracker" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-cyan-50/30 py-12 sm:py-20 rounded-3xl border border-cyan-50 mb-16 sm:mb-20">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold uppercase tracking-wider mb-2 shadow-sm">
                                <Sparkles size={14} className="animate-pulse" /> {lang === 'vi' ? 'Tính năng Mới' : lang === 'ko' ? '새로운 기능' : 'New Feature'}
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 whitespace-pre-line leading-tight">{t.featGpaTitle}</h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                {t.featGpaDesc}
                            </p>
                            <ul className="space-y-3 pt-2">
                                {t.featGpaItems && t.featGpaItems.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3 text-gray-800 font-semibold bg-white/60 p-3 rounded-xl border border-cyan-50 shadow-sm">
                                        <div className="bg-cyan-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                                            <GraduationCap className="text-cyan-600" size={18} />
                                        </div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-200 to-sky-200 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
                            {/* Image Composition */}
                            <div className="relative">
                                <img
                                    src="/GPA1.png"
                                    alt="GPA Tracker Main"
                                    className="relative rounded-2xl shadow-2xl border border-white/50 transform group-hover:scale-[1.02] transition-transform duration-500 z-10 w-full"
                                />
                                <img
                                    src="/GPA2.png"
                                    alt="GPA Tracker Details"
                                    className="absolute -bottom-3 -left-2 sm:-bottom-8 sm:-left-6 w-1/2 rounded-2xl shadow-2xl border-2 border-white transform -rotate-3 group-hover:-rotate-6 group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 z-20 cursor-pointer hover:shadow-cyan-200/50"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Feature 5: My Spotify (NEW) */}
                <section id="spotify" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto px-4 sm:px-8 lg:px-12 bg-zinc-900 py-12 sm:py-20 rounded-3xl border border-zinc-800 mb-16 sm:mb-20 shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 -mr-40 -mt-40 w-96 h-96 bg-indigo-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-96 h-96 bg-purple-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>

                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center relative z-10">
                        <div className="order-2 md:order-1 relative group">
                            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
                            {/* Image Composition */}
                            <div className="relative">
                                <img
                                    src="/assets/spotify_preview_2.png"
                                    alt="My Spotify Player"
                                    className="relative rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 transform group-hover:scale-[1.02] transition-transform duration-500 z-10 w-full"
                                />
                                <img
                                    src="/assets/spotify_preview_1.png"
                                    alt="My Spotify Playlist"
                                    className="absolute -bottom-3 -right-2 sm:-bottom-6 sm:-right-4 w-1/3 max-w-[160px] md:max-w-[180px] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-2 border-zinc-800 transform rotate-3 group-hover:rotate-6 group-hover:scale-110 group-hover:-translate-y-3 transition-all duration-500 z-20 cursor-pointer hover:shadow-indigo-500/50"
                                />
                            </div>
                        </div>
                        <div className="order-1 md:order-2 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-indigo-400 border border-white/10 text-xs font-bold uppercase tracking-wider mb-2 shadow-sm backdrop-blur-md">
                                <Sparkles size={14} className="animate-pulse text-purple-400" /> {lang === 'vi' ? 'Cập nhật Mới Nhất' : lang === 'ko' ? '최신 업데이트' : 'Latest Update'}
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white whitespace-pre-line leading-tight">{t.featSpotifyTitle}</h2>
                            <p className="text-gray-400 text-lg leading-relaxed">
                                {t.featSpotifyDesc}
                            </p>
                            <ul className="space-y-3 pt-2">
                                {t.featSpotifyItems && t.featSpotifyItems.map((item: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3 text-gray-200 font-semibold bg-white/5 p-3 rounded-xl border border-white/10 shadow-sm backdrop-blur-sm">
                                        <div className="bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-500/30 shrink-0 mt-0.5">
                                            <PlayCircle className="text-indigo-400" size={18} />
                                        </div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Promo Banner: My Storage */}
                <section id="secure-storage" className="max-w-7xl mx-4 sm:mx-6 lg:mx-8 xl:mx-auto pb-16 sm:pb-20">
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl group cursor-pointer bg-gradient-to-r from-blue-900 to-indigo-900" onClick={onLogin}>
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay group-hover:scale-105 transition-transform duration-700" />

                        <div className="relative z-10 p-6 sm:p-8 md:p-12 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                            {/* Content */}
                            <div className="text-center md:text-left">
                                <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-bold uppercase tracking-wider mb-6">
                                    {t.promoTag}
                                </div>
                                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-4 sm:mb-6 leading-tight">
                                    {t.promoTitle}
                                </h2>
                                <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                                    {t.promoDesc}
                                </p>

                                {/* Feature List */}
                                <ul className="space-y-3 mb-8 text-left inline-block">
                                    {t.featStorageItems && t.featStorageItems.map((item: string, i: number) => (
                                        <li key={i} className="flex items-start gap-3 text-blue-50 font-medium">
                                            <div className="p-1 rounded-full bg-blue-500/20 text-blue-300 shrink-0 mt-1">
                                                <ShieldCheck size={16} />
                                            </div>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>

                                <div>
                                    <button className="px-8 py-3 bg-white text-indigo-900 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto md:mx-0 group-hover:scale-105 transform duration-300">
                                        <Archive size={20} />
                                        {t.promoBtn}
                                    </button>
                                </div>
                            </div>

                            {/* Images Composition */}
                            <div className="relative h-full min-h-[220px] sm:min-h-[300px] flex items-center justify-center">
                                {/* Back Image (Files/Images) */}
                                <div className="absolute top-0 right-0 w-3/4 transform translate-x-2 -translate-y-2 sm:translate-x-4 sm:-translate-y-4 rotate-3 group-hover:rotate-6 transition-transform duration-500">
                                    <img
                                        src="/assets/storage_feature_2.png"
                                        alt="My Storage Files"
                                        className="rounded-xl shadow-2xl border border-white/20 w-full"
                                    />
                                </div>

                                {/* Front Image (Notes) */}
                                <div className="absolute bottom-0 left-0 w-3/4 transform -translate-x-2 translate-y-2 sm:-translate-x-4 sm:translate-y-4 -rotate-3 group-hover:-rotate-6 transition-transform duration-500 z-10">
                                    <img
                                        src="/assets/storage_feature_1.png"
                                        alt="My Storage Notes"
                                        className="rounded-xl shadow-2xl border border-white/20 w-full"
                                    />
                                </div>

                                {/* Floating Decor */}
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-lg animate-bounce">
                                        <LockKeyhole size={32} className="text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Footer */}
            <footer id="site-footer" className="bg-[#030712] border-t border-gray-800/60 text-gray-400 py-16 relative overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
                        {/* Column 1: SmartLife Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-800 shadow-md">
                                    <img src="/pwa-192x192.png" alt="SmartLife" className="w-full h-full object-cover" />
                                </div>
                                <span className="font-extrabold text-xl text-white tracking-tight">SmartLife</span>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-400">
                                {t.footerLogoText}
                            </p>
                        </div>

                        {/* Column 2: TÍNH NĂNG CHÍNH */}
                        <div>
                            <h4 className="text-white font-bold text-sm tracking-wider uppercase mb-5">{t.footerCol1Title}</h4>
                            <ul className="space-y-3.5 text-sm">
                                <li>
                                    <button onClick={() => scrollToSection('ai-advisor')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <Brain size={16} className="text-blue-400 shrink-0" />
                                        <span>{t.footerAIAdvisor}</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('ai-career-advisor')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <Target size={16} className="text-purple-400 shrink-0" />
                                        <span>{t.footerCareer}</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('cv-builder')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <FileText size={16} className="text-rose-400 shrink-0" />
                                        <span>{t.footerCVBuilder}</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('finance')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <Wallet size={16} className="text-emerald-400 shrink-0" />
                                        <span>{t.footerFinance}</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('journal')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <BookOpen size={16} className="text-teal-400 shrink-0" />
                                        <span>{t.footerJournal}</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('focus-music')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <Headphones size={16} className="text-pink-400 shrink-0" />
                                        <span>{t.footerFocus}</span>
                                    </button>
                                </li>
                            </ul>
                        </div>

                        {/* Column 3: TIỆN ÍCH MỞ RỘNG */}
                        <div>
                            <h4 className="text-white font-bold text-sm tracking-wider uppercase mb-5">{t.footerCol2Title}</h4>
                            <ul className="space-y-3.5 text-sm">
                                <li>
                                    <button onClick={() => scrollToSection('schedule')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <CalendarDays size={16} className="text-indigo-400 shrink-0" />
                                        <span>{t.footerSchedule}</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('habit-tracker')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <Flame size={16} className="text-orange-400 shrink-0" />
                                        <span>{t.footerHabit}</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('gpa-tracker')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <GraduationCap size={16} className="text-cyan-400 shrink-0" />
                                        <span>{t.footerGPATracker}</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('spotify')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <Music size={16} className="text-green-400 shrink-0" />
                                        <span>{t.footerSpotify}</span>
                                    </button>
                                </li>
                                <li>
                                    <button onClick={() => scrollToSection('secure-storage')} className="flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                                        <LockKeyhole size={16} className="text-zinc-400 shrink-0" />
                                        <span>{t.footerStorage}</span>
                                    </button>
                                </li>
                            </ul>
                        </div>

                        {/* Column 4: THÔNG TIN LIÊN HỆ */}
                        <div>
                            <h4 className="text-white font-bold text-sm tracking-wider uppercase mb-5">{t.footerCol3Title}</h4>
                            <ul className="space-y-4 text-sm">
                                <li className="flex items-start gap-2.5">
                                    <User size={16} className="text-indigo-400 shrink-0 mt-1" />
                                    <div>
                                        <div className="text-xs text-gray-500 font-bold uppercase">{t.footerDev}</div>
                                        <div className="text-white font-medium">Bùi Anh Quân (baquan3q)</div>
                                    </div>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <Facebook size={16} className="text-blue-400 shrink-0 mt-1" />
                                    <div>
                                        <div className="text-xs text-gray-500 font-bold uppercase">Facebook</div>
                                        <a href="https://facebook.com/buianhquan06" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors font-medium break-all">
                                            facebook.com/buianhquan06
                                        </a>
                                    </div>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <Mail size={16} className="text-pink-400 shrink-0 mt-1" />
                                    <div>
                                        <div className="text-xs text-gray-500 font-bold uppercase">{t.footerSupportEmail}</div>
                                        <a href="mailto:baquan3q@gmail.com" className="text-gray-400 hover:text-white transition-colors font-medium break-all">
                                            baquan3q@gmail.com
                                        </a>
                                    </div>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <Globe size={16} className="text-teal-400 shrink-0 mt-1" />
                                    <div>
                                        <div className="text-xs text-gray-500 font-bold uppercase">{t.footerPersonalPage}</div>
                                        <a href="https://beacons.ai/baquan3q" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors font-medium break-all">
                                            beacons.ai/baquan3q
                                        </a>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-gray-800/80 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-left">
                            <p className="text-sm font-semibold text-gray-300">SmartLife Application © 2026</p>
                            <p className="text-xs text-gray-500 mt-0.5">All rights reserved.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-xs text-gray-500 text-center md:text-right">
                                {t.footerBuilt}
                            </div>
                            <button
                                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-gray-400 hover:text-white transition-all hover:scale-110 hover:-translate-y-1"
                                title="Back to top"
                            >
                                <ChevronUp size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
