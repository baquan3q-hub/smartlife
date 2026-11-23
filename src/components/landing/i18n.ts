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

export type ProblemApp = 'notes' | 'timetable' | 'sheet' | 'todo' | 'music' | 'timer' | 'diary' | 'gpa';
export type LandingRelationship = 'friend' | 'study_buddy' | 'senior' | 'mentor';

interface TitledItem {
    title: string;
    desc: string;
}

export interface LandingCopy {
    nav: { home: string; overview: string; google: string; ai: string; features: string; pricing: string; contact: string };
    heroLines: string[];
    heroSecondary: string;
    heroMeta: string[];
    heroBubbleName: string;
    heroBubble: string;
    problem: {
        eyebrow: string;
        before: string;
        after: string;
        desc: string;
        beforeLabel: string;
        afterLabel: string;
        apps: Record<ProblemApp, string>;
    };
    day: {
        eyebrow: string;
        title: string;
        chapters: Record<StoryKey, { time: string; label: string }>;
        calcLabel: string;
        calcHint: string;
        calcInvalid: string;
    };
    companion: {
        eyebrow: string;
        title: string;
        desc: string;
        pickAvatar: string;
        pickRelation: string;
        online: string;
        typing: string;
        cta: string;
        caps: string[];
        relationships: Record<LandingRelationship, { label: string; hint: string; chat: { user: string; ai: string }[] }>;
    };
    how: { eyebrow: string; title: string; steps: TitledItem[] };
    platforms: { eyebrow: string; title: string; desc: string; items: TitledItem[]; privacyTitle: string; privacy: TitledItem[] };
    pricingTeaser: {
        eyebrow: string;
        title: string;
        freeName: string;
        freeDesc: string;
        freeItems: string[];
        freeCta: string;
        proName: string;
        proFrom: string;
        perMonth: string;
        proItems: string[];
        trial: string;
        cta: string;
    };
    faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
    ui: {
        detail: string;
        stageHint: string;
        stagePlaceholder: string;
        stageMatched: string;
        sheetsDesc: string;
        pinLocked: string;
        pinOpen: string;
    };
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
    syncStage: {
        eyebrow: string;
        title: string;
        desc: string;
        statusLive: string;
        cleanBadge: string;
        colDoing: string;
        colDone: string;
        taskTitle: string;
        taskSub: string;
        tasksSynced: string;
        calendarSynced: string;
    };
    ecosystem: {
        eyebrow: string;
        title: string;
        desc: string;
        items: Record<
            'gpa' | 'career' | 'cv' | 'finance' | 'google' | 'kanban' | 'journal' | 'pomodoro' | 'habits' | 'storage',
            { tag: string; title: string; desc: string }
        >;
    };
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
        nav: { home: 'Trang chủ', overview: 'Một ngày', google: 'Google Hub', ai: 'Bạn AI', features: 'Tính năng', pricing: 'Bảng giá', contact: 'Liên hệ' },
        heroLines: ['Cả cuộc sống sinh viên,', 'gọn trong một app.'],
        heroSecondary: 'Xem một ngày với SmartLife',
        heroMeta: ['Miễn phí để bắt đầu', '7 ngày dùng thử Pro', 'Tiếng Việt · English · 한국어'],
        heroBubbleName: 'Bạn đồng hành',
        heroBubble: 'Mai 8h có kiểm tra Giải tích nha. Tối nay ôn chương 3 trước, 20h mình nhắc nhé?',
        problem: {
            eyebrow: '01 — Vấn đề',
            before: 'Một ngày, tám app, tám lần chuyển tab.',
            after: 'Hoặc chỉ một SmartLife.',
            desc: 'Lịch học ở một nơi, chi tiêu trong file Excel, deadline nằm trong ghi chú, nhật ký thì trên giấy. SmartLife gom tất cả về một chỗ để bạn nhìn thấy trọn một ngày của mình.',
            beforeLabel: 'Trước',
            afterLabel: 'Với SmartLife',
            apps: { notes: 'Ghi chú', timetable: 'Lịch học', sheet: 'Excel chi tiêu', todo: 'Todo list', music: 'App nhạc', timer: 'Hẹn giờ học', diary: 'Sổ nhật ký', gpa: 'Máy tính GPA' }
        },
        day: {
            eyebrow: '02 — Một ngày với SmartLife',
            title: 'Từ 7 giờ sáng đến 10 giờ tối, một app đi cùng bạn.',
            chapters: {
                kanban: { time: '07:00', label: 'Sáng · Lên kế hoạch' },
                google: { time: '12:30', label: 'Trưa · Đồng bộ' },
                finance: { time: '17:30', label: 'Chiều · Tiền bạc' },
                ai: { time: '22:00', label: 'Tối · Trò chuyện & định hướng' }
            },
            calcLabel: 'Thử gõ chi tiêu như nói chuyện',
            calcHint: 'k = nghìn · tr = triệu',
            calcInvalid: 'Chưa hiểu biểu thức này'
        },
        companion: {
            eyebrow: '03 — Bạn đồng hành AI',
            title: 'Không chỉ là chatbot. Là một người bạn nói chuyện đúng kiểu của bạn.',
            desc: 'Chọn nhân vật, kiểu quan hệ và cách xưng hô. Bạn đồng hành trò chuyện tự nhiên bằng tiếng Việt, và khi cần thì chuyển sang chế độ chuyên gia để đọc tài liệu, phân tích chi tiêu hay tư vấn nghề nghiệp.',
            pickAvatar: 'Chọn nhân vật',
            pickRelation: 'Kiểu quan hệ',
            online: 'Đang online',
            typing: 'đang soạn tin nhắn…',
            cta: 'Tạo bạn đồng hành',
            caps: ['Trò chuyện tự nhiên bằng tiếng Việt', 'Đọc file, ảnh hoá đơn và ghi âm', 'Tư vấn nghề nghiệp từ GPA và MBTI/DISC', '3 tốc độ: Nhanh, Nghĩ vừa, Nghĩ sâu'],
            relationships: {
                friend: {
                    label: 'Bạn thân',
                    hint: 'Thoải mái, trêu đùa, lắng nghe',
                    chat: [
                        { user: 't đặt báo thức 6h để dậy sớm', ai: 'Rồi mấy giờ dậy?' },
                        { user: '8h17 🥲', ai: 'Nhớ tới từng phút luôn =))' }
                    ]
                },
                study_buddy: {
                    label: 'Bạn cùng học',
                    hint: 'Ôn bài, nhắc deadline, giữ động lực',
                    chat: [
                        { user: 'mai thi Giải tích mà chưa ôn gì hết', ai: 'Còn tối nay nè. Chia 3 chương, mỗi chương 40 phút nha?' },
                        { user: 'ok, nhắc mình nghỉ giữa giờ nhé', ai: 'Chốt. 25 phút học, 5 phút nghỉ, mình bật Pomodoro luôn.' }
                    ]
                },
                senior: {
                    label: 'Anh/chị khoá trên',
                    hint: 'Từng trải, chia sẻ kinh nghiệm',
                    chat: [
                        { user: 'năm 2 có nên đi làm thêm không anh?', ai: 'Nên thử, nhưng giữ GPA trước đã. Em đang 3.2, làm tầm 15 giờ mỗi tuần là vừa.' }
                    ]
                },
                mentor: {
                    label: 'Người cố vấn',
                    hint: 'Điềm tĩnh, gợi mở hướng đi',
                    chat: [
                        { user: 'em phân vân giữa Data và Marketing', ai: 'Thử nhìn lại: môn nào em điểm cao mà vẫn thấy vui khi học? Mình bắt đầu từ đó nhé.' }
                    ]
                }
            }
        },
        how: {
            eyebrow: '04 — Bắt đầu',
            title: 'Bắt đầu trong ba bước.',
            steps: [
                { title: 'Đăng nhập bằng Google', desc: 'Dùng tài khoản Google bạn đang có, không cần nhớ thêm mật khẩu.' },
                { title: 'Kết nối Tasks & Calendar', desc: 'Việc và lịch trên Google hiện ngay trong Kanban, thay đổi ở đâu cũng khớp hai chiều.' },
                { title: 'Chọn bạn đồng hành', desc: 'Đặt tên, chọn tính cách, rồi để AI cùng bạn lên kế hoạch cho ngày mai.' }
            ]
        },
        platforms: {
            eyebrow: '05 — Mọi màn hình',
            title: 'Một tài khoản, đi theo bạn khắp nơi.',
            desc: 'Mở trên trình duyệt hoặc cài như app lên điện thoại và máy tính. Dữ liệu đồng bộ theo tài khoản của bạn.',
            items: [
                { title: 'Điện thoại', desc: 'Cài lên màn hình chính, có thông báo nhắc việc.' },
                { title: 'Máy tính', desc: 'Kanban, thời khoá biểu và báo cáo trên màn hình lớn.' },
                { title: '3 ngôn ngữ', desc: 'Tiếng Việt, English và 한국어.' }
            ],
            privacyTitle: 'Riêng tư theo mặc định',
            privacy: [
                { title: 'Nhật ký khoá PIN', desc: 'Những dòng viết cho riêng bạn được khoá bằng mã PIN.' },
                { title: 'Ví tài liệu', desc: 'CCCD, thẻ sinh viên, mã QR thanh toán xem nhanh trong khung bảo mật.' },
                { title: 'Quyền Google tối thiểu', desc: 'Chỉ Tasks, Calendar, Sheets và các tệp do chính SmartLife tạo trên Drive.' }
            ]
        },
        pricingTeaser: {
            eyebrow: '06 — Bảng giá',
            title: 'Bắt đầu miễn phí. Nâng cấp khi bạn cần.',
            freeName: 'Free',
            freeDesc: 'Đủ cho việc quản lý hằng ngày.',
            freeItems: ['Tài chính, ví và lịch trình', 'Kanban và Todo', 'Nhật ký và My Spotify', 'AI 10 tin nhắn mỗi ngày'],
            freeCta: 'Bắt đầu miễn phí',
            proName: 'Pro',
            proFrom: 'chỉ từ',
            perMonth: '/tháng',
            proItems: ['AI 600.000 token mỗi tháng, đọc file, ảnh, audio', 'GPA nâng cao và AI Career Analyzer', 'Visual Board, Cashflow và Sổ nợ', 'Thói quen và đếm ngược không giới hạn'],
            trial: '7 ngày dùng thử Pro cho tài khoản mới',
            cta: 'Xem đầy đủ bảng giá'
        },
        faq: {
            eyebrow: '07 — Câu hỏi thường gặp',
            title: 'Những điều bạn hay hỏi.',
            items: [
                { q: 'SmartLife có miễn phí không?', a: 'Có. Các tính năng quản lý cơ bản dùng miễn phí. Tài khoản mới còn được 7 ngày dùng thử đầy đủ tính năng Pro.' },
                { q: 'Kết nối Google có an toàn không?', a: 'SmartLife chỉ xin quyền Google Tasks, Google Calendar, Google Sheets và các tệp do chính app tạo trên Drive. Bạn có thể gỡ quyền bất cứ lúc nào trong cài đặt tài khoản Google.' },
                { q: 'Cài SmartLife lên điện thoại thế nào?', a: 'Bấm "Cài App" trên thanh menu để xem hướng dẫn cho iPhone, Android và máy tính. Sau khi cài, SmartLife mở từ màn hình chính như một app bình thường.' },
                { q: 'AI dùng được bao nhiêu?', a: 'Gói Free có 10 tin nhắn mỗi ngày. Gói Pro có 600.000 token mỗi tháng, kèm đọc file, ảnh và ghi âm.' },
                { q: 'Đang là Pro mà mua thêm gói thì sao?', a: 'Thời hạn mới được cộng dồn từ ngày hết hạn hiện tại, không mất ngày nào.' },
                { q: 'SmartLife có những ngôn ngữ nào?', a: 'Tiếng Việt, English và 한국어. Đổi bằng nút quả địa cầu trên thanh menu.' }
            ]
        },
        ui: {
            detail: 'Chi tiết',
            stageHint: 'Cuộn để xem thẻ di chuyển',
            stagePlaceholder: 'Thẻ đang chuyển sang Done',
            stageMatched: 'Khớp 4 danh sách',
            sheetsDesc: 'Sao lưu và xuất báo cáo tài chính tự động',
            pinLocked: 'Mã PIN bảo mật',
            pinOpen: 'Đã mở khoá nhật ký'
        },
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
        syncStage: {
            eyebrow: 'Bản lĩnh công nghệ • The Realtime Core',
            title: 'Đồng bộ 2 chiều tức thì với Google',
            desc: 'Kéo thả thẻ trên Kanban, toàn bộ Google Tasks và Google Calendar khớp lệnh ngay lập tức mà không cần bấm lưu.',
            statusLive: 'Đang đồng bộ trực tiếp',
            cleanBadge: 'Deep Clean Engine: 0 task trùng lặp • Tối ưu 95% re-render',
            colDoing: 'Đang làm (Doing)',
            colDone: 'Đã xong (Done)',
            taskTitle: 'Chuẩn bị đồ án tốt nghiệp VNU',
            taskSub: 'Subtasks phân cấp: 3 việc con',
            tasksSynced: 'Google Tasks: Danh sách "Doing" ➔ "Done"',
            calendarSynced: 'Google Calendar: Khớp slot 14:00 - 16:30'
        },
        ecosystem: {
            eyebrow: 'Hệ sinh thái All-in-One',
            title: '10 Phân hệ chuyên sâu cho sinh viên & tự học',
            desc: 'Cuộn ngang để khám phá cách SmartLife liên kết học vụ, tài chính, sự nghiệp và cảm xúc thành một thể thống nhất.',
            items: {
                gpa: { tag: '01 / Academic', title: 'GPA VNU & Mô phỏng điểm', desc: 'Quy đổi hệ 4 và 10 chuẩn ĐHQGHN. Tính điểm kỳ tới để đạt bằng Giỏi/Xuất sắc.' },
                career: { tag: '02 / AI Advisor', title: 'Cố vấn nghề nghiệp AI', desc: 'Kết hợp điểm GPA với trắc nghiệm MBTI/DISC để gợi ý 3 vị trí việc làm tối ưu.' },
                cv: { tag: '03 / Career Builder', title: 'Tự tạo CV chuẩn ATS', desc: 'Đồng bộ kết quả học tập và mục tiêu vào template CV chuyên nghiệp, xuất PDF 1-click.' },
                finance: { tag: '04 / Finance', title: 'Bàn phím toán học & Ví quỹ', desc: 'Gõ biểu thức "50k + 1.5tr" trực tiếp. Quản lý ví, quỹ mục đích và sổ ghi nợ liên kết.' },
                google: { tag: '05 / Google Sync', title: 'Google Tasks & Calendar 2 chiều', desc: 'Ánh xạ 4 cột Kanban sang Google Tasks, hỗ trợ native child tasks và dọn dẹp Deep Clean.' },
                kanban: { tag: '06 / Schedule', title: 'Bảng Kanban & Thời khóa biểu', desc: 'Kéo thả siêu tốc tối ưu 95% re-render. Xuất thời khóa biểu thành hình nền điện thoại.' },
                journal: { tag: '07 / Emotional Health', title: 'Nhật ký chữa lành có mã PIN', desc: 'Chấm điểm tâm trạng, ghi lời biết ơn, bảo vệ riêng tư tuyệt đối bằng mã PIN cục bộ.' },
                pomodoro: { tag: '08 / Focus Space', title: 'Pomodoro & Nhạc Lo-Fi', desc: 'Đồng hồ đếm ngược học tập tích hợp tiếng mưa rơi, sóng biển và My Spotify tự do.' },
                habits: { tag: '09 / Habit Streak', title: 'Rèn luyện thói quen & StarBrain', desc: 'Duy trì chuỗi ngày streak liên tục, tích lũy điểm thưởng đổi phần quà động lực.' },
                storage: { tag: '10 / Security Vault', title: 'Ví tài liệu số cá nhân', desc: 'Lưu trữ CCCD, thẻ sinh viên, QR thanh toán xem nhanh với Lightbox zoom bảo mật.' }
            }
        },
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
            built: 'Phát triển bởi Bùi Anh Quân',
            backToTop: 'Lên đầu trang'
        }
    },
    en: {
        nav: { home: 'Home', overview: 'A day', google: 'Google Hub', ai: 'AI Companion', features: 'Features', pricing: 'Pricing', contact: 'Contact' },
        heroLines: ['Your whole student life,', 'in one calm app.'],
        heroSecondary: 'See a day with SmartLife',
        heroMeta: ['Free to start', '7-day Pro trial', 'Tiếng Việt · English · 한국어'],
        heroBubbleName: 'Companion',
        heroBubble: 'Calculus quiz tomorrow at 8. Review chapter 3 tonight first? I’ll ping you at 8 pm.',
        problem: {
            eyebrow: '01 — The problem',
            before: 'One day, eight apps, eight tab switches.',
            after: 'Or just one SmartLife.',
            desc: 'Your timetable lives in one place, spending in a spreadsheet, deadlines in notes and your journal on paper. SmartLife brings them together so you can see your whole day at once.',
            beforeLabel: 'Before',
            afterLabel: 'With SmartLife',
            apps: { notes: 'Notes', timetable: 'Timetable', sheet: 'Expense sheet', todo: 'Todo list', music: 'Music app', timer: 'Study timer', diary: 'Paper journal', gpa: 'GPA calculator' }
        },
        day: {
            eyebrow: '02 — A day with SmartLife',
            title: 'From 7 am to 10 pm, one app by your side.',
            chapters: {
                kanban: { time: '07:00', label: 'Morning · Plan' },
                google: { time: '12:30', label: 'Noon · Sync' },
                finance: { time: '17:30', label: 'Afternoon · Money' },
                ai: { time: '22:00', label: 'Night · Talk & direction' }
            },
            calcLabel: 'Type spending the way you say it',
            calcHint: 'k = thousand · tr = million (VND)',
            calcInvalid: 'Can’t read that expression yet'
        },
        companion: {
            eyebrow: '03 — AI Companion',
            title: 'Not just a chatbot. A friend who talks the way you do.',
            desc: 'Pick a character, a relationship and how you address each other. Your companion chats naturally, and switches to expert mode when you need it to read documents, analyze spending or give career advice.',
            pickAvatar: 'Pick a character',
            pickRelation: 'Relationship',
            online: 'Online',
            typing: 'is typing…',
            cta: 'Create your companion',
            caps: ['Natural conversation in Vietnamese', 'Reads files, receipts and voice notes', 'Career advice from GPA and MBTI/DISC', '3 speeds: Fast, Balanced, Deep'],
            relationships: {
                friend: {
                    label: 'Best friend',
                    hint: 'Relaxed, teasing, a good listener',
                    chat: [
                        { user: 'set my alarm for 6 to wake up early', ai: 'And what time did you get up?' },
                        { user: '8:17 🥲', ai: 'You even remember the exact minute =))' }
                    ]
                },
                study_buddy: {
                    label: 'Study buddy',
                    hint: 'Revision, deadlines, motivation',
                    chat: [
                        { user: 'calculus exam tomorrow and I haven’t started', ai: 'You still have tonight. Three chapters, 40 minutes each?' },
                        { user: 'ok, remind me to take breaks', ai: 'Deal. 25 minutes on, 5 off. Starting the Pomodoro now.' }
                    ]
                },
                senior: {
                    label: 'Senior student',
                    hint: 'Been there, shares experience',
                    chat: [
                        { user: 'should I get a part-time job in year 2?', ai: 'Worth trying, but protect your GPA first. At 3.2, around 15 hours a week is plenty.' }
                    ]
                },
                mentor: {
                    label: 'Mentor',
                    hint: 'Calm, helps you find your direction',
                    chat: [
                        { user: 'I can’t decide between Data and Marketing', ai: 'Look back: which classes did you score well in and still enjoy? Let’s start there.' }
                    ]
                }
            }
        },
        how: {
            eyebrow: '04 — Get started',
            title: 'Up and running in three steps.',
            steps: [
                { title: 'Sign in with Google', desc: 'Use the Google account you already have. No new password to remember.' },
                { title: 'Connect Tasks & Calendar', desc: 'Your Google tasks and events show up in Kanban, and changes stay in sync both ways.' },
                { title: 'Pick a companion', desc: 'Give it a name and a personality, then plan tomorrow together.' }
            ]
        },
        platforms: {
            eyebrow: '05 — Every screen',
            title: 'One account that goes where you go.',
            desc: 'Open it in the browser or install it like an app on your phone and computer. Your data syncs with your account.',
            items: [
                { title: 'Phone', desc: 'Install to your home screen, with task reminders.' },
                { title: 'Computer', desc: 'Kanban, timetables and reports on a big screen.' },
                { title: '3 languages', desc: 'Tiếng Việt, English and 한국어.' }
            ],
            privacyTitle: 'Private by default',
            privacy: [
                { title: 'PIN-locked journal', desc: 'The words you write for yourself stay behind a PIN.' },
                { title: 'Document vault', desc: 'ID cards, student cards and payment QR codes in a secure viewer.' },
                { title: 'Minimal Google access', desc: 'Only Tasks, Calendar, Sheets and the Drive files SmartLife itself creates.' }
            ]
        },
        pricingTeaser: {
            eyebrow: '06 — Pricing',
            title: 'Start free. Upgrade when you need more.',
            freeName: 'Free',
            freeDesc: 'Everything for day-to-day management.',
            freeItems: ['Finance, wallets and schedules', 'Kanban and todos', 'Journal and My Spotify', 'AI: 10 messages a day'],
            freeCta: 'Start for free',
            proName: 'Pro',
            proFrom: 'from',
            perMonth: '/month',
            proItems: ['AI: 600,000 tokens a month, files, images, audio', 'Advanced GPA and AI Career Analyzer', 'Visual Board, Cashflow and debt ledger', 'Unlimited habits and countdowns'],
            trial: '7-day Pro trial for new accounts',
            cta: 'See full pricing'
        },
        faq: {
            eyebrow: '07 — FAQ',
            title: 'Questions people ask.',
            items: [
                { q: 'Is SmartLife free?', a: 'Yes. The core management features are free. New accounts also get a 7-day trial of every Pro feature.' },
                { q: 'Is connecting Google safe?', a: 'SmartLife only asks for Google Tasks, Google Calendar, Google Sheets and the Drive files the app itself creates. You can revoke access at any time in your Google account settings.' },
                { q: 'How do I install it on my phone?', a: 'Tap "Install App" in the menu for steps on iPhone, Android and desktop. Once installed, SmartLife opens from your home screen like any other app.' },
                { q: 'How much can I use the AI?', a: 'Free includes 10 messages a day. Pro includes 600,000 tokens a month, plus reading files, images and audio.' },
                { q: 'I’m already Pro. What happens if I buy another plan?', a: 'The new time is added on top of your current expiry date, so you lose no days.' },
                { q: 'Which languages does SmartLife support?', a: 'Tiếng Việt, English and 한국어. Switch with the globe button in the menu.' }
            ]
        },
        ui: {
            detail: 'Details',
            stageHint: 'Scroll to watch the card move',
            stagePlaceholder: 'Card moving to Done',
            stageMatched: '4 lists matched',
            sheetsDesc: 'Automatic backup and financial reports',
            pinLocked: 'PIN protected',
            pinOpen: 'Journal unlocked'
        },
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
        syncStage: {
            eyebrow: 'Engineered Precision • The Realtime Core',
            title: 'Two-Way Instant Sync with Google Ecosystem',
            desc: 'Drag a card across Kanban, and Google Tasks & Calendar instantly reflect the shift without touching a save button.',
            statusLive: 'Realtime Live Syncing',
            cleanBadge: 'Deep Clean Engine: 0 orphan duplicates • 95% re-render reduction',
            colDoing: 'In Progress (Doing)',
            colDone: 'Completed (Done)',
            taskTitle: 'Prepare VNU Graduation Thesis',
            taskSub: 'Hierarchical subtasks: 3 child items',
            tasksSynced: 'Google Tasks: "Doing" ➔ "Done" matched',
            calendarSynced: 'Google Calendar: Synced to slot 14:00 - 16:30'
        },
        ecosystem: {
            eyebrow: 'All-in-One Life OS',
            title: '10 Tailored Modules for Academic & Personal Mastery',
            desc: 'Scroll horizontally to see how SmartLife weaves academics, personal finances, career development and mental wellbeing into one calm canvas.',
            items: {
                gpa: { tag: '01 / Academic', title: 'GPA VNU & Grade Projection', desc: 'Accurate 4.0 / 10.0 scale conversion. Simulates remaining semesters for graduation honors.' },
                career: { tag: '02 / AI Advisor', title: 'AI Career Coach', desc: 'Synthesizes GPA trends with MBTI/DISC assessments to identify 3 top career pathways.' },
                cv: { tag: '03 / Career Builder', title: 'Auto ATS-Optimized CV', desc: 'Syncs GPA and milestone achievements directly into professional templates, export PDF in 1 click.' },
                finance: { tag: '04 / Finance', title: 'Math Expressions & Wallet Mesh', desc: 'Type "50k + 1.5tr" arithmetic directly. Oversee accounts, goal funds, and linked debts.' },
                google: { tag: '05 / Google Sync', title: 'Google Tasks & Calendar 2-Way', desc: 'Direct 4-column Kanban mapping, native hierarchical child tasks, and Deep Clean sweep.' },
                kanban: { tag: '06 / Schedule', title: 'Fluid Kanban & Timetable', desc: 'Fluid drag-and-drop with 95% re-render optimization. Export high-res phone lockscreen wallpapers.' },
                journal: { tag: '07 / Emotional Health', title: 'Healing Journal with PIN Lock', desc: 'Track moods, gratitude prompts, and biometric/local 4-digit PIN security.' },
                pomodoro: { tag: '08 / Focus Space', title: 'Pomodoro & Ambient Lo-Fi', desc: 'Focus timer backed with gentle rain, ocean waves, and standalone Spotify integration.' },
                habits: { tag: '09 / Habit Streak', title: 'Habit Streaks & StarBrain', desc: 'Build unbroken routines, earn motivational reward tokens, and celebrate progress.' },
                storage: { tag: '10 / Security Vault', title: 'Personal Digital Vault', desc: 'Store student IDs, citizen cards, and instant payment QR codes with secured lightbox preview.' }
            }
        },
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
            built: 'Built by Bùi Anh Quân',
            backToTop: 'Back to top'
        }
    },
    ko: {
        nav: { home: '홈', overview: '하루', google: '구글 연동', ai: 'AI 친구', features: '기능', pricing: '요금제', contact: '문의' },
        heroLines: ['대학 생활의 모든 것,', '하나의 앱으로.'],
        heroSecondary: 'SmartLife와 함께하는 하루 보기',
        heroMeta: ['무료로 시작', '7일 Pro 체험', 'Tiếng Việt · English · 한국어'],
        heroBubbleName: 'AI 친구',
        heroBubble: '내일 8시에 미적분 퀴즈 있어. 오늘 밤엔 3장부터 복습할까? 8시에 알려줄게.',
        problem: {
            eyebrow: '01 — 문제',
            before: '하루에 앱 여덟 개, 탭 전환 여덟 번.',
            after: '이제는 SmartLife 하나로.',
            desc: '시간표는 여기, 지출은 엑셀, 마감일은 메모, 일기는 종이에. SmartLife는 이 모든 것을 한곳에 모아 하루 전체를 한눈에 보여줍니다.',
            beforeLabel: '이전',
            afterLabel: 'SmartLife와 함께',
            apps: { notes: '메모', timetable: '시간표', sheet: '지출 엑셀', todo: '할 일 목록', music: '음악 앱', timer: '공부 타이머', diary: '종이 일기', gpa: 'GPA 계산기' }
        },
        day: {
            eyebrow: '02 — SmartLife와 함께하는 하루',
            title: '아침 7시부터 밤 10시까지, 늘 곁에 있는 앱.',
            chapters: {
                kanban: { time: '07:00', label: '아침 · 계획' },
                google: { time: '12:30', label: '점심 · 동기화' },
                finance: { time: '17:30', label: '오후 · 자산' },
                ai: { time: '22:00', label: '밤 · 대화와 진로' }
            },
            calcLabel: '말하듯이 지출을 입력해 보세요',
            calcHint: 'k = 천 · tr = 백만 (VND)',
            calcInvalid: '아직 이해할 수 없는 식이에요'
        },
        companion: {
            eyebrow: '03 — AI 친구',
            title: '단순한 챗봇이 아니라, 나와 같은 말투로 이야기하는 친구.',
            desc: '캐릭터, 관계, 호칭을 고르세요. AI 친구는 자연스럽게 대화하고, 필요할 때는 전문가 모드로 바꿔 문서를 읽거나 지출을 분석하고 진로를 조언합니다.',
            pickAvatar: '캐릭터 선택',
            pickRelation: '관계',
            online: '온라인',
            typing: '입력 중…',
            cta: 'AI 친구 만들기',
            caps: ['베트남어로 자연스러운 대화', '파일, 영수증, 음성 메모 분석', 'GPA와 MBTI/DISC 기반 진로 상담', '3가지 속도: 빠름, 보통, 깊게'],
            relationships: {
                friend: {
                    label: '절친',
                    hint: '편하게, 장난도 치고, 잘 들어줌',
                    chat: [
                        { user: '일찍 일어나려고 6시에 알람 맞췄어', ai: '그래서 몇 시에 일어났는데?' },
                        { user: '8시 17분 🥲', ai: '분 단위까지 기억하네 =))' }
                    ]
                },
                study_buddy: {
                    label: '공부 친구',
                    hint: '복습, 마감 알림, 동기 부여',
                    chat: [
                        { user: '내일 미적분 시험인데 하나도 안 했어', ai: '아직 오늘 밤이 있어. 3단원, 단원당 40분 어때?' },
                        { user: '좋아, 쉬는 시간 알려줘', ai: '오케이. 25분 공부, 5분 휴식. 뽀모도로 바로 켤게.' }
                    ]
                },
                senior: {
                    label: '선배',
                    hint: '경험을 나눠주는 선배',
                    chat: [
                        { user: '2학년 때 알바 해도 될까요?', ai: '해볼 만해. 다만 학점부터 지켜. 지금 3.2면 주 15시간 정도가 적당해.' }
                    ]
                },
                mentor: {
                    label: '멘토',
                    hint: '차분하게 방향을 찾아줌',
                    chat: [
                        { user: '데이터랑 마케팅 중에 고민돼요', ai: '돌아보자. 점수도 좋고 즐거웠던 과목이 뭐였지? 거기서 시작해 보자.' }
                    ]
                }
            }
        },
        how: {
            eyebrow: '04 — 시작하기',
            title: '세 단계면 시작할 수 있어요.',
            steps: [
                { title: '구글로 로그인', desc: '이미 쓰는 구글 계정으로. 새 비밀번호는 필요 없어요.' },
                { title: 'Tasks & Calendar 연결', desc: '구글의 할 일과 일정이 칸반에 바로 나타나고, 양방향으로 동기화됩니다.' },
                { title: 'AI 친구 선택', desc: '이름과 성격을 정하고, 함께 내일 계획을 세워 보세요.' }
            ]
        },
        platforms: {
            eyebrow: '05 — 모든 화면',
            title: '하나의 계정, 어디서나 함께.',
            desc: '브라우저에서 열거나 휴대폰과 컴퓨터에 앱처럼 설치하세요. 데이터는 계정으로 동기화됩니다.',
            items: [
                { title: '휴대폰', desc: '홈 화면에 설치, 할 일 알림 지원.' },
                { title: '컴퓨터', desc: '칸반, 시간표, 리포트를 큰 화면으로.' },
                { title: '3개 언어', desc: 'Tiếng Việt, English, 한국어.' }
            ],
            privacyTitle: '기본값은 프라이버시',
            privacy: [
                { title: 'PIN 잠금 일기', desc: '나만을 위한 기록은 PIN으로 잠깁니다.' },
                { title: '문서 보관함', desc: '신분증, 학생증, 결제 QR을 보안 뷰어로 빠르게.' },
                { title: '최소한의 구글 권한', desc: 'Tasks, Calendar, Sheets, 그리고 SmartLife가 만든 Drive 파일만.' }
            ]
        },
        pricingTeaser: {
            eyebrow: '06 — 요금제',
            title: '무료로 시작하고, 필요할 때 업그레이드.',
            freeName: 'Free',
            freeDesc: '일상 관리에 필요한 모든 것.',
            freeItems: ['자산, 지갑, 일정 관리', '칸반과 할 일', '일기와 My Spotify', 'AI 하루 10건'],
            freeCta: '무료로 시작하기',
            proName: 'Pro',
            proFrom: '최저',
            perMonth: '/월',
            proItems: ['AI 월 600,000 토큰, 파일·이미지·오디오 분석', '고급 GPA와 AI 커리어 분석', 'Visual Board, Cashflow, 채무 장부', '습관과 카운트다운 무제한'],
            trial: '신규 계정 7일 Pro 체험',
            cta: '전체 요금제 보기'
        },
        faq: {
            eyebrow: '07 — 자주 묻는 질문',
            title: '자주 받는 질문들.',
            items: [
                { q: 'SmartLife는 무료인가요?', a: '네. 기본 관리 기능은 무료입니다. 신규 계정은 모든 Pro 기능을 7일간 체험할 수 있습니다.' },
                { q: '구글 연결은 안전한가요?', a: 'SmartLife는 Google Tasks, Google Calendar, Google Sheets, 그리고 앱이 직접 만든 Drive 파일에 대한 권한만 요청합니다. 구글 계정 설정에서 언제든 권한을 해제할 수 있습니다.' },
                { q: '휴대폰에 어떻게 설치하나요?', a: '메뉴의 "앱 설치"를 눌러 iPhone, Android, PC용 안내를 확인하세요. 설치 후에는 홈 화면에서 일반 앱처럼 열립니다.' },
                { q: 'AI는 얼마나 쓸 수 있나요?', a: 'Free는 하루 10건, Pro는 월 600,000 토큰과 파일·이미지·오디오 분석을 제공합니다.' },
                { q: '이미 Pro인데 다른 플랜을 사면요?', a: '새 기간이 현재 만료일부터 더해지므로 손해 보는 날이 없습니다.' },
                { q: '어떤 언어를 지원하나요?', a: 'Tiếng Việt, English, 한국어. 메뉴의 지구본 버튼으로 바꿀 수 있습니다.' }
            ]
        },
        ui: {
            detail: '자세히',
            stageHint: '스크롤하면 카드가 움직여요',
            stagePlaceholder: '카드가 완료로 이동 중',
            stageMatched: '4개 목록 일치',
            sheetsDesc: '자동 백업과 재무 리포트',
            pinLocked: 'PIN 보안',
            pinOpen: '일기 잠금 해제됨'
        },
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
        syncStage: {
            eyebrow: '실시간 코어 엔진 • The Realtime Core',
            title: '구글과 완벽한 양방향 실시간 동기화',
            desc: '칸반 카드를 이동하면 구글 태스크와 캘린더가 저장 버튼 없이도 즉시 자동 반영됩니다.',
            statusLive: '실시간 라이브 동기화 중',
            cleanBadge: '딥클린 엔진: 중복 태스크 0건 • 95% 렌더링 최적화',
            colDoing: '진행 중 (Doing)',
            colDone: '완료 (Done)',
            taskTitle: 'VNU 졸업 논문 최종 준비',
            taskSub: '계층형 하위 작업: 3개 세부 태스크',
            tasksSynced: '구글 태스크: "진행 중" ➔ "완료" 동기화됨',
            calendarSynced: '구글 캘린더: 14:00 - 16:30 일정 연동 완료'
        },
        ecosystem: {
            eyebrow: '올인원 라이프 OS 생태계',
            title: '학습과 일상을 위한 10가지 맞춤 모듈',
            desc: '가로 스크롤을 통해 스마트라이프가 학업, 재정, 커리어, 감정 관리를 어떻게 하나로 연결하는지 살펴보세요.',
            items: {
                gpa: { tag: '01 / Academic', title: 'GPA VNU & 학점 시뮬레이션', desc: '4.0/10.0 스케일 완벽 변환. 졸업 우등 학점을 위한 남은 학기 목표 계산.' },
                career: { tag: '02 / AI Advisor', title: 'AI 커리어 코칭', desc: 'GPA 추이와 MBTI/DISC 성격 분석을 결합하여 최적의 3가지 진로 추천.' },
                cv: { tag: '03 / Career Builder', title: 'ATS 최적화 자동 이력서', desc: '학업 결과와 프로젝트 성과를 전문 템플릿에 자동 반영, 원클릭 PDF 출력.' },
                finance: { tag: '04 / Finance', title: '수식 계산기 & 다중 지갑 관리', desc: '"50k + 1.5tr" 등 복합 수식 직접 입력. 목적별 자금과 연동된 채무 관리.' },
                google: { tag: '05 / Google Sync', title: '구글 태스크 & 캘린더 2-Way', desc: '칸반 4열 직관 매핑, 네이티브 계층 하위 작업 및 딥클린 중복 제거.' },
                kanban: { tag: '06 / Schedule', title: '부드러운 칸반 & 시간표', desc: '95% 리렌더링 최적화된 드래그 앤 드롭. 고화질 잠금화면 시간표 생성.' },
                journal: { tag: '07 / Emotional Health', title: 'PIN 보안 힐링 다이어리', desc: '기분 추적, 감사 일기, 4자리 PIN 코드로 보호되는 안전한 프라이버시.' },
                pomodoro: { tag: '08 / Focus Space', title: '뽀모도로 & 앰비언트 로파이', desc: '빗소리, 파도 소리 등 집중 사운드와 독립형 Spotify 음악 재생.' },
                habits: { tag: '09 / Habit Streak', title: '습관 스트릭 & StarBrain', desc: '연속 달성 스트릭 유지 및 동기부여 보상 포인트를 통한 자기개발.' },
                storage: { tag: '10 / Security Vault', title: '개인 디지털 문서 보관함', desc: '학생증, 신분증, 결제 QR 코드를 라이트박스로 안전하고 신속하게 조회.' }
            }
        },
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
            built: '개발: Bùi Anh Quân',
            backToTop: '맨 위로'
        }
    }
};
