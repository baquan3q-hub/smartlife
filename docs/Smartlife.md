# SmartLife dưới góc nhìn nghiên cứu khoa học về hành vi và thói quen của sinh viên

## 1. Mở đầu: diễn giải lại mục tiêu nghiên cứu

Mục tiêu của tài liệu này không phải để giới thiệu SmartLife như một sản phẩm thương mại, mà để chuyển hóa SmartLife từ một codebase phần mềm thành một **nền tảng phục vụ nghiên cứu khoa học cấp trường** về **hành vi, thói quen, năng lực tự quản và tự điều chỉnh của sinh viên đại học**.

Dựa trên code hiện có, SmartLife phù hợp nhất để được nhìn nhận như một **hệ thống hỗ trợ tự quản có tích hợp AI**, nơi sinh viên có thể quản lý tài chính cá nhân, lịch học, nhiệm vụ, mục tiêu, quá trình tập trung học tập, kết quả GPA và tương tác với trợ lý AI. Từ đó, SmartLife không chỉ là công cụ hỗ trợ ra quyết định cá nhân mà còn là môi trường số có khả năng tạo dữ liệu phục vụ nghiên cứu về hành vi học tập và hành vi tự quản.

Tài liệu này bám vào **những gì thực sự có trong code** làm lớp phân tích chính, sau đó mới tách riêng phần **khả năng nghiên cứu/phát triển tiếp** để tránh nhầm lẫn giữa tính năng đang chạy và ý tưởng mở rộng.

---

## 2. Định vị học thuật của SmartLife

Từ góc độ nghiên cứu, SmartLife có thể được định vị là:

- Một **nền tảng self-management cho sinh viên đại học**.
- Một **công cụ AI hỗ trợ ra quyết định cá nhân** trong học tập, thời gian biểu, tài chính và mục tiêu.
- Một **môi trường thu thập dấu vết hành vi số** liên quan đến thói quen tự quản, mức độ kỷ luật, xu hướng trì hoãn, theo dõi mục tiêu và sử dụng hỗ trợ AI.

Nếu đặt trong khung lý thuyết giáo dục và khoa học hành vi, SmartLife hiện phù hợp nhất với các chủ đề:

- `self-regulated learning` - tự điều chỉnh học tập
- `self-management behavior` - hành vi tự quản cá nhân
- `habit formation` - hình thành thói quen
- `AI-assisted decision support` - hỗ trợ ra quyết định có AI

Kết luận ở mức khái quát: **SmartLife mạnh nhất khi được dùng để nghiên cứu hành vi tự quản và tự điều chỉnh của sinh viên**, thay vì nghiên cứu quá rộng về “mọi thói quen sinh viên”.

---

## 3. Hiện trạng đã có trong code

Phần này chỉ mô tả các module đã hiện diện rõ trong luồng chạy chính hoặc được nối trực tiếp vào giao diện người dùng.

### 3.1. Khối xác thực, PWA và thông báo

**Trạng thái:** `đang chạy trong luồng chính`

**Bài toán sinh viên gặp phải**  
Sinh viên thường sử dụng nhiều thiết bị, dễ bỏ quên nhắc việc, bỏ lỡ lịch học, deadline hoặc các sự kiện cá nhân quan trọng. Một công cụ nghiên cứu nếu không bám được vào nhịp dùng hằng ngày thì rất khó ghi nhận hành vi thật.

**SmartLife giải quyết thế nào**  
Ứng dụng dùng Supabase Auth để đăng nhập bằng Google hoặc email/password, duy trì session trên web/mobile thông qua Capacitor Preferences. Ứng dụng được cấu hình PWA và có service worker Firebase Messaging, đồng thời trong `App.tsx` có cơ chế xin quyền thông báo, đăng ký service worker và kiểm tra thông báo định kỳ cho lịch trình, mục tiêu và sự kiện cá nhân.

**Dữ liệu nào được dùng**  
`profiles`, session Supabase, `timetable`, `goals`, `calendar_events`, trạng thái thông báo lưu trong `localStorage`, token FCM và dữ liệu service worker.

**Giá trị mang lại**  
Khối này giúp SmartLife có khả năng bám sát đời sống học tập hằng ngày của sinh viên, từ đó tạo điều kiện để quan sát hành vi sử dụng công cụ trong bối cảnh thực tế thay vì môi trường mô phỏng.

---

### 3.2. VisualBoard + MyStorage

**Trạng thái:** `đang chạy trong luồng chính`

**Bài toán sinh viên gặp phải**  
Sinh viên thường thiếu một điểm nhìn tổng quan để nhìn đồng thời lịch học, việc cần làm, mục tiêu, tài chính và tài nguyên cá nhân. Điều này làm cho việc tự theo dõi bản thân bị phân mảnh.

**SmartLife giải quyết thế nào**  
`VisualBoard.tsx` đóng vai trò dashboard tổng quan, hiển thị lịch nay - mai, thống kê tài chính, mục tiêu, todo ưu tiên, GPA tích lũy và các điểm truy cập nhanh sang module khác. Từ VisualBoard có thể mở trực tiếp `MyStorage`, là không gian lưu trữ cá nhân cho ghi chú, link, file, ảnh, audio và video.

**Dữ liệu nào được dùng**  
`transactions`, `goals`, `todos`, `timetable`, `gpaSemesters`, dữ liệu người dùng từ `profiles`, và bảng `my_storage` cùng Supabase Storage cho nội dung lưu trữ.

**Giá trị mang lại**  
VisualBoard biến SmartLife thành “trung tâm điều phối” đời sống số của sinh viên. Với nghiên cứu khoa học, đây là điểm thuận lợi để khảo sát mức độ tổng hợp thông tin ảnh hưởng thế nào đến hành vi tự giám sát và tự điều chỉnh.

---

### 3.3. FinanceDashboard

**Trạng thái:** `đang chạy trong luồng chính`

**Bài toán sinh viên gặp phải**  
Sinh viên thường kiểm soát chi tiêu yếu, khó biết mình tiêu nhiều vào đâu, khó duy trì kỷ luật tài chính và khó gắn mục tiêu tiết kiệm với hành vi hằng ngày.

**SmartLife giải quyết thế nào**  
`FinanceDashboard.tsx` cho phép thêm/sửa/xóa giao dịch, phân loại thu - chi, quản lý danh mục tự tạo, đặt mục tiêu tài chính, thiết lập ngân sách theo danh mục và theo tháng, xem lịch sử chi tiêu, biểu đồ và phân tích tổng quan. Trong `App.tsx`, toàn bộ CRUD giao dịch, mục tiêu và ngân sách được nối trực tiếp với Supabase.

**Dữ liệu nào được dùng**  
`transactions`, `goals`, `budgets`, `profiles.custom_categories`.

**Giá trị mang lại**  
Module này phù hợp để nghiên cứu năng lực **tự quản tài chính** của sinh viên: mức độ nhận thức chi tiêu, tính kỷ luật trong bám ngân sách và khả năng chuyển mục tiêu dài hạn thành hành vi ngắn hạn.

---

### 3.4. ScheduleDashboard + FocusTimer + MusicSpace nhúng trong luồng học tập

**Trạng thái:** `đang chạy trong luồng chính`

**Bài toán sinh viên gặp phải**  
Sinh viên thường rơi vào tình trạng lịch học rời rạc, công việc tồn đọng, thiếu ưu tiên rõ ràng, khó duy trì thời gian tập trung liên tục và dễ bị phân tâm.

**SmartLife giải quyết thế nào**  
`ScheduleDashboard.tsx` quản lý thời khóa biểu, todo, mục tiêu cá nhân và có `CalendarWidget` cùng `FocusTimer`. `FocusTimer` dùng hook `useFocusTimer` để hỗ trợ Pomodoro, Deep Work, stopwatch học tập và có thể mở `MusicSpace` ngay trong luồng focus mode để chuyển sang môi trường học tập có nhạc. Module này cũng hỗ trợ export thời khóa biểu bằng `html2canvas`.

**Dữ liệu nào được dùng**  
`timetable`, `todos`, `goals`, state của `useFocusTimer`, một phần `localStorage` cho timer engine/status/remaining time, cùng các file nhạc/video nền trong `public/music`.

**Giá trị mang lại**  
Đây là module có giá trị nghiên cứu rất mạnh đối với chủ đề **hành vi tự quản thời gian**, **trì hoãn**, **duy trì tập trung** và **thiết kế môi trường học tập cá nhân hóa** cho sinh viên.

---

### 3.5. GPADashboard

**Trạng thái:** `đang chạy trong luồng chính`

**Bài toán sinh viên gặp phải**  
Sinh viên thường khó theo dõi GPA theo từng học kỳ, dễ nhầm giữa GPA học kỳ và GPA tích lũy, khó dự đoán mình cần bao nhiêu tín chỉ/điểm để đạt xếp loại mục tiêu.

**SmartLife giải quyết thế nào**  
`GPADashboard.tsx` kết hợp với `gpaCalculator.ts` để tính điểm học phần theo template A/B/C, quy đổi thang 10 - chữ - thang 4, tính GPA học kỳ, GPA tích lũy, cảnh báo học vụ, dự báo xếp loại tốt nghiệp và hỗ trợ import/export Excel bằng `xlsx`. Dữ liệu GPA được fetch trong `App.tsx` từ `gpa_semesters` và `gpa_courses`.

**Dữ liệu nào được dùng**  
`gpa_semesters`, `gpa_courses`, `gpaTargetCredits`, các hằng số quy chế trong `constants.ts`.

**Giá trị mang lại**  
Module này rất phù hợp cho nghiên cứu về **hành vi học tập có mục tiêu**, **khả năng tự theo dõi kết quả học tập**, và tác động của công cụ số tới việc lập kế hoạch GPA theo hướng chủ động thay vì phản ứng muộn.

---

### 3.6. AIAdvisorPage

**Trạng thái:** `đang chạy trong luồng chính`

**Bài toán sinh viên gặp phải**  
Sinh viên có dữ liệu nhưng không phải lúc nào cũng đủ khả năng phân tích dữ liệu đó để ra quyết định. Các vấn đề phổ biến là không biết nên hỏi gì, phân tích sao, cần ưu tiên gì, hay cần thay đổi hành vi nào.

**SmartLife giải quyết thế nào**  
`AIAdvisorPage.tsx` là giao diện chat AI toàn màn hình, dùng `aiEngine.ts` và `geminiService.ts` để tạo hội thoại có context từ dữ liệu thực tế của người dùng. AI không chỉ trả lời mà còn có function calling như `query_database`, `add_timetable`, `add_todo`, `add_transaction`, `calculate_needed_gpa`, `simulate_gpa`, đồng thời lưu lịch sử chat và bộ nhớ dài hạn thông qua `chatHistoryService.ts` và `memoryService.ts`.

**Dữ liệu nào được dùng**  
Toàn bộ `AppState` làm context nền, đặc biệt là `transactions`, `goals`, `budgets`, `timetable`, `todos`, `gpa_semesters`, `gpa_courses`, cộng thêm `ai_conversations`, `ai_messages`, `ai_memory`, `api_logs`.

**Giá trị mang lại**  
Đây là module trung tâm cho nghiên cứu về **hành vi sử dụng AI trong tự quản**, vì nó cho phép quan sát sinh viên hỏi AI điều gì, dựa vào AI ở bước nào, và AI có thể tác động ra sao tới quyết định về học tập, tài chính và thời gian.

---

### 3.7. AdminDashboard + subscription support

**Trạng thái:** `đang chạy trong luồng chính`

**Bài toán sinh viên gặp phải**  
Về phía người dùng cuối, đây không phải bài toán trực tiếp. Tuy nhiên ở góc độ triển khai nghiên cứu, người phát triển cần theo dõi người dùng, trạng thái gói, hoạt động gần đây và mức sử dụng AI.

**SmartLife giải quyết thế nào**  
`AdminDashboard.tsx` cho admin theo dõi danh sách user, plan, trial/pro, đơn hàng subscription và token AI trong ngày. `subscriptionService.ts` hỗ trợ tạo order, xác nhận order, trial và hoàn tác trạng thái gói.

**Dữ liệu nào được dùng**  
`profiles`, `subscription_orders`, `api_logs`, RPC `get_admin_users`.

**Giá trị mang lại**  
Khối này giúp SmartLife có nền tảng vận hành để mở rộng thành nghiên cứu có nhiều người tham gia, theo dõi cohort người dùng và kiểm soát quyền truy cập khi triển khai thực nghiệm.

---

## 4. Biến nghiên cứu có thể khai thác từ dữ liệu đang có

Phần này rất quan trọng nếu chuyển SmartLife thành công cụ phục vụ đề tài khoa học.

### 4.1. Tài chính tự quản

**Trạng thái:** `đang chạy trong luồng chính`

- Bảng/chỉ báo chính: `transactions`, `budgets`, `goals`
- Có thể đo:
  - tần suất ghi nhận giao dịch
  - mức độ bám ngân sách
  - tỷ lệ hoàn thành mục tiêu tài chính
  - thay đổi hành vi chi tiêu theo thời gian

### 4.2. Quản trị thời gian và thói quen học tập

**Trạng thái:** `đang chạy trong luồng chính`

- Bảng/chỉ báo chính: `timetable`, `todos`, state của focus timer
- Có thể đo:
  - mật độ lịch học/làm việc
  - mức độ hoàn thành todo
  - thói quen khởi động phiên tập trung
  - lựa chọn preset học tập và thời lượng tập trung

### 4.3. Kết quả học tập

**Trạng thái:** `đang chạy trong luồng chính`

- Bảng/chỉ báo chính: `gpa_semesters`, `gpa_courses`
- Có thể đo:
  - biến động GPA theo kỳ
  - tiến độ tích lũy tín chỉ
  - xu hướng học lại, môn rủi ro
  - mối liên hệ giữa hành vi lập kế hoạch và kết quả học tập

### 4.4. Tương tác AI

**Trạng thái:** `đang chạy trong luồng chính`

- Bảng/chỉ báo chính: `ai_conversations`, `ai_messages`, `ai_memory`, `api_logs`
- Có thể đo:
  - tần suất dùng AI
  - chủ đề sinh viên hỏi AI nhiều nhất
  - dạng hỗ trợ AI được tin cậy nhất
  - mức độ sử dụng AI để chuyển từ phân tích sang hành động

---

## 5. Hạn chế hiện tại của sản phẩm

Phần này cần được nhìn như **thực trạng kỹ thuật**, không phải để phủ nhận giá trị của SmartLife, mà để xác định đúng biên nghiên cứu.

### 5.1. Backend `api/` đang là khoảng trống kỹ thuật

**Trạng thái:** `có trong code nhưng chưa nối hoàn chỉnh`

Repo có `vercel.json`, `requirements.txt`, script backend và một số service cũ như `aiService.ts`, `financeService.ts`, `apiClient.ts` đều giả định tồn tại backend API. Tuy nhiên thư mục `api/` hiện đang trống, nên không nên mô tả SmartLife như một hệ thống backend AI hoàn thiện.

### 5.2. Có code legacy hoặc code chuyển tiếp

**Trạng thái:** `có trong code nhưng chưa nối hoàn chỉnh`

Các thành phần như `AIAdvisor.tsx`, `aiService.ts`, `financeService.ts`, `smartEngine.ts`, `InsightCard.tsx` cho thấy đã từng có hoặc đang hình thành một hướng triển khai khác. Tuy nhiên trong luồng UI hiện tại, phần AI đang chạy chính là `AIAdvisorPage.tsx`, còn `smartEngine`/`InsightCard` chưa được nối thực sự vào giao diện.

### 5.3. Behavioral analytics mới dừng nhiều ở mức cấu trúc và ý tưởng

**Trạng thái:** `có trong code nhưng chưa nối hoàn chỉnh`

Trong `types.ts` đã có `BehaviorLog`, `DailySnapshot`, các loại hành vi như `FOCUS_SESSION`, `TASK_COMPLETION`, `STRESS_SPIKE`. Tuy nhiên repo chưa cho thấy pipeline ghi log hành vi hoàn chỉnh, chưa có bảng SQL và chưa có luồng phân tích định lượng thực sự cho behavioral analytics ở mức production.

### 5.4. Chưa có test nội bộ ở repo

**Trạng thái:** `có trong code nhưng chưa nối hoàn chỉnh`

Khi kiểm tra dưới `src/`, `api/`, `scripts`, `sql` thì chưa có test nội bộ của dự án. Điều này không làm mất giá trị nghiên cứu, nhưng ảnh hưởng đến độ tin cậy kỹ thuật nếu sau này mở rộng sang đo lường lớn hơn hoặc công bố kết quả có phần đánh giá hệ thống.

### 5.5. `MyStorage` có điểm cần lưu ý về an toàn nội dung

**Trạng thái:** `có trong code nhưng chưa nối hoàn chỉnh`

`MyStorage.tsx` render nội dung ghi chú bằng `dangerouslySetInnerHTML`. Với nghiên cứu cấp trường hoặc quy mô nhỏ thì đây là tín hiệu cần lưu ý về bảo mật và làm sạch nội dung, đặc biệt nếu về sau cho phép nhiều dạng nhập liệu phức tạp hoặc chia sẻ dữ liệu nghiên cứu.

---

## 6. Khả năng nghiên cứu và phát triển tiếp

Phần này là lớp thứ hai: không phải “đang chạy xong”, mà là **hướng mở rộng hợp lý dựa trên nền tảng đã có**.

### 6.1. Xây dựng hồ sơ hành vi tự quản của sinh viên

**Trạng thái:** `định hướng mở rộng`

Từ dữ liệu hiện có, SmartLife đã gần đủ để phát triển một hồ sơ hành vi theo tuần/tháng cho từng sinh viên: mức độ đều đặn ghi chép tài chính, mức hoàn thành todo, độ ổn định lịch học, tần suất mở focus timer, xu hướng hỏi AI và biến động GPA. Đây là bước rất phù hợp để chuyển công cụ thành nền tảng quan sát hành vi tự quản.

### 6.2. Thiết kế smart nudges cá nhân hóa

**Trạng thái:** `định hướng mở rộng`

`smartEngine.ts` cho thấy định hướng nudges và insight đã có về mặt ý tưởng. Nếu nối thêm behavioral logs và quy tắc can thiệp đúng thời điểm, SmartLife có thể trở thành hệ thống nghiên cứu tác động của **gợi ý AI cá nhân hóa** lên hành vi học tập và hành vi tự quản của sinh viên.

### 6.3. Nghiên cứu tác động của AI lên hành vi ra quyết định

**Trạng thái:** `định hướng mở rộng`

AIAdvisorPage đã đủ mạnh để nghiên cứu không chỉ “AI trả lời đúng không”, mà còn “AI có làm sinh viên thay đổi kế hoạch và hành động không”. Đây là hướng rất đáng giá vì nó gắn trực tiếp AI với hành vi thật: thêm todo, thêm lịch, thêm giao dịch, mô phỏng GPA.

### 6.4. Xây dựng dashboard nghiên cứu cho giảng viên/nhà nghiên cứu

**Trạng thái:** `định hướng mở rộng`

Hạ tầng admin hiện tại mới thiên về quản trị vận hành. Nếu mở rộng thêm một lớp dashboard nghiên cứu ẩn danh, SmartLife có thể hỗ trợ phân tích cohort sinh viên, so sánh nhóm có AI và nhóm không dùng AI, hoặc theo dõi thay đổi hành vi trước - sau can thiệp.

---

## 7. Kết luận định hướng đề tài

Sau khi đối chiếu trực tiếp với code, có thể rút ra một kết luận quan trọng:

> **Khung nghiên cứu phù hợp nhất của SmartLife là hành vi tự quản và tự điều chỉnh của sinh viên đại học, có hỗ trợ bởi AI.**

Lý do là vì hiện tại code mạnh nhất ở các cụm sau:

- quản lý lịch trình và todo
- focus timer và môi trường hỗ trợ tập trung
- quản lý mục tiêu
- theo dõi GPA và kế hoạch học tập
- AI advisor gắn trực tiếp với dữ liệu cá nhân và hành động thực tế

Ngược lại, các hướng quá rộng như “mọi thói quen sinh viên”, “sức khỏe tinh thần tổng quát”, hay “dự báo toàn bộ hành vi sinh viên” hiện chưa phải điểm mạnh kỹ thuật của SmartLife. Nếu chọn đề tài quá rộng, phần nghiên cứu sẽ dễ bị loãng và không bám sát thế mạnh thật của công cụ.

---

## 8. Năm đề tài nghiên cứu phù hợp

### 1. Xây dựng và đánh giá ứng dụng SmartLife như công cụ AI hỗ trợ hình thành thói quen tự quản của sinh viên đại học

Đề tài này bám sát nhất với hiện trạng codebase vì SmartLife đã có đầy đủ các module phục vụ tự quản: lịch trình, todo, mục tiêu, focus timer, tài chính cá nhân và GPA. Từ góc độ nghiên cứu, anh có thể đánh giá xem việc dùng một công cụ AI hỗ trợ toàn diện có giúp sinh viên hình thành thói quen theo dõi và quản lý bản thân tốt hơn hay không.

### 2. Phân tích hành vi sử dụng AI trong quản lý học tập, thời gian và tài chính của sinh viên đại học thông qua nền tảng SmartLife

Đề tài này tận dụng trực tiếp `AIAdvisorPage`, `ai_conversations`, `ai_messages`, `ai_memory` và `api_logs`. Điểm mạnh của nó là không chỉ nghiên cứu AI như một công nghệ, mà nghiên cứu **sinh viên sử dụng AI như thế nào** trong bối cảnh ra quyết định cá nhân.

### 3. Nghiên cứu tác động của gợi ý AI cá nhân hóa đến hành vi tự điều chỉnh học tập của sinh viên đại học

Đề tài này phù hợp nếu anh muốn nhấn mạnh khía cạnh can thiệp hành vi. SmartLife hiện đã có nền cho AI tư vấn và có định hướng smart insights/nudges, nên rất hợp để phát triển nghiên cứu theo hướng AI cá nhân hóa ảnh hưởng thế nào đến việc lập kế hoạch học tập, theo dõi tiến độ và điều chỉnh hành vi học.

### 4. Khai thác dữ liệu hành vi từ ứng dụng SmartLife để nhận diện thói quen tự quản của sinh viên và đề xuất can thiệp phù hợp

Đề tài này có tính nghiên cứu dữ liệu cao hơn, phù hợp nếu anh muốn nhấn mạnh phần phân tích hành vi. Dù behavioral pipeline chưa hoàn thiện hoàn toàn, SmartLife đã có nhiều nguồn dữ liệu hành vi gián tiếp như giao dịch, todo, lịch học, GPA, thời gian tập trung và lịch sử tương tác AI, đủ để xây dựng mô hình nhận diện thói quen tự quản.

### 5. Ứng dụng AI trong hỗ trợ lập kế hoạch học tập và theo dõi GPA của sinh viên đại học trên nền tảng SmartLife

Đề tài này hẹp hơn, dễ triển khai hơn và rất phù hợp với đặc điểm sinh viên đại học. Vì `GPADashboard` và các công cụ mô phỏng GPA trong AI engine đã bám rất sát bài toán học tập, đề tài này giúp anh tập trung vào một trục rõ ràng: AI hỗ trợ sinh viên đặt mục tiêu, dự báo và điều chỉnh chiến lược học tập để cải thiện kết quả.

---

## 9. Gợi ý chốt hướng

Nếu cần cân bằng giữa **độ mạnh học thuật**, **độ bám code thật** và **khả năng triển khai trong nghiên cứu cấp trường**, ba lựa chọn tốt nhất là:

1. **Xây dựng và đánh giá ứng dụng SmartLife như công cụ AI hỗ trợ hình thành thói quen tự quản của sinh viên đại học**
2. **Phân tích hành vi sử dụng AI trong quản lý học tập, thời gian và tài chính của sinh viên đại học thông qua nền tảng SmartLife**
3. **Nghiên cứu tác động của gợi ý AI cá nhân hóa đến hành vi tự điều chỉnh học tập của sinh viên đại học**

Trong ba hướng này, nếu muốn vừa rộng vừa bám sát sản phẩm tổng thể thì nên ưu tiên hướng số 1. Nếu muốn thiên về AI và dữ liệu hành vi hơn thì hướng số 2 là lựa chọn rất mạnh. Nếu muốn đề tài có chiều sâu về mặt hành vi học tập và can thiệp cá nhân hóa thì hướng số 3 là hướng đáng đầu tư nhất.

---

## 10. Bổ sung góc nhìn nghiên cứu: sinh viên chưa từng dùng app quản lý vẫn là nhóm rất quan trọng

Một hiểu lầm thường gặp khi xây dựng đề tài là cho rằng chỉ những sinh viên đã quen dùng app quản lý thời gian hay thu chi mới là đối tượng phù hợp. Thực ra, **nhóm sinh viên chưa từng dùng công cụ quản lý mới là nhóm nghiên cứu rất có giá trị**, vì họ giúp trả lời những câu hỏi nền tảng hơn:

- Sinh viên hiện **có nhận thức** về nhu cầu tự quản bản thân hay chưa?
- Nếu chưa dùng app, họ đang **tự xoay xở bằng cách nào**?
- Họ gặp khó khăn ở khâu nào: ý thức, kỷ luật, ghi chép, theo dõi tiến độ, hay thiếu công cụ phù hợp?
- Nếu có một công cụ như SmartLife, nó giúp họ điều gì mà trước đó họ chưa làm được?
- Nếu không có công cụ như vậy, hành vi tự quản của họ đang diễn ra ra sao, rời rạc tới mức nào, và hậu quả là gì?

Vì vậy, đề tài không nên đóng khung theo hướng “đánh giá người dùng đã quen với app”, mà nên mở rộng thành:

> **nghiên cứu nhận thức của sinh viên về nhu cầu tự quản, cách họ hiện đang tìm công cụ hoặc giải pháp để hỗ trợ bản thân, và khả năng SmartLife trở thành giải pháp phù hợp cho khoảng trống đó.**

Theo hướng này, SmartLife không chỉ là sản phẩm được đánh giá sau cùng, mà còn là **giải pháp được sinh ra từ chính dữ liệu khảo sát và nhu cầu thực của sinh viên trong trường**.

---

## 11. Mô hình nghiên cứu đề xuất cho đề tài cấp trường

Nếu muốn bài nghiên cứu có “phương pháp nghiên cứu” và “kết quả thực tế”, nên chuyển đề tài sang mô hình **nghiên cứu hỗn hợp (mixed methods)** gồm 2 giai đoạn:

### Giai đoạn 1. Khảo sát thực trạng sinh viên trong trường

Mục tiêu của giai đoạn này là trả lời:

- Sinh viên đang gặp vấn đề gì trong tự quản học tập, thời gian và tài chính?
- Họ đang dùng công cụ gì, nếu có?
- Nếu chưa dùng công cụ nào, nguyên nhân là gì?
- Họ kỳ vọng gì ở một công cụ như SmartLife?

Đây là giai đoạn để tạo ra **bằng chứng thực trạng** và chứng minh rằng vấn đề nghiên cứu là có thật.

### Giai đoạn 2. Thử nghiệm pilot với SmartLife

Sau khi có dữ liệu khảo sát, anh chọn một nhóm sinh viên dùng SmartLife trong một khoảng thời gian ngắn, ví dụ 4-6 tuần. Khi đó, đề tài có thể đo:

- nhận thức trước - sau về tự quản
- thay đổi trong hành vi ghi chép, lập kế hoạch, bám mục tiêu
- mức độ sử dụng AI
- cảm nhận về tính hữu ích của SmartLife

Đây là giai đoạn để tạo ra **bằng chứng can thiệp** và chứng minh SmartLife có khả năng cải thiện một số khía cạnh tự quản của sinh viên.

---

## 12. Câu hỏi nghiên cứu và giả thuyết nghiên cứu

### 12.1. Câu hỏi nghiên cứu gợi ý

1. Sinh viên trong trường hiện đang nhận thức như thế nào về nhu cầu quản lý học tập, thời gian và tài chính cá nhân?
2. Sinh viên hiện đang sử dụng những công cụ hoặc cách thức nào để tự quản bản thân?
3. Vì sao một bộ phận sinh viên chưa sử dụng bất kỳ công cụ quản lý số nào?
4. Một công cụ như SmartLife có thể giải quyết những khoảng trống nào trong hành vi tự quản của sinh viên?
5. Việc sử dụng SmartLife trong thời gian ngắn có giúp cải thiện nhận thức và hành vi tự quản của sinh viên hay không?

### 12.2. Giả thuyết nghiên cứu gợi ý

**H1.** Phần lớn sinh viên có nhu cầu tự quản học tập, thời gian hoặc tài chính, nhưng chưa có công cụ tích hợp đủ phù hợp với nhu cầu thực tế của họ.

**H2.** Sinh viên chưa từng dùng app quản lý không phải vì không có nhu cầu, mà chủ yếu do thiếu nhận thức, thiếu thói quen, hoặc chưa tìm được công cụ phù hợp và dễ dùng.

**H3.** Mức độ khó khăn trong tự quản càng cao thì nhu cầu tìm kiếm công cụ hỗ trợ càng lớn.

**H4.** Sau một giai đoạn sử dụng SmartLife, sinh viên có xu hướng cải thiện nhận thức về tự quản và tăng tần suất các hành vi có tổ chức như lập kế hoạch, theo dõi nhiệm vụ, ghi nhận chi tiêu hoặc theo dõi GPA.

**H5.** Các tính năng có AI trong SmartLife làm tăng mức độ sẵn sàng sử dụng công cụ so với cách quản lý thủ công hoặc app rời rạc.

---

## 13. Thiết kế phương pháp nghiên cứu

### 13.1. Loại hình nghiên cứu

Đề xuất dùng **nghiên cứu hỗn hợp**:

- **Định lượng**: khảo sát bằng bảng hỏi và thống kê mô tả/so sánh
- **Định tính**: phỏng vấn ngắn một số sinh viên để hiểu sâu lý do, rào cản và kỳ vọng
- **Thử nghiệm pilot**: cho một nhóm sinh viên trải nghiệm SmartLife để đánh giá khả năng ứng dụng thực tế

### 13.2. Đối tượng nghiên cứu

- Sinh viên đại học trong trường anh
- Có thể chia theo:
  - năm học
  - ngành học
  - giới tính
  - nơi ở
  - mức độ từng sử dụng app quản lý trước đó

### 13.3. Mẫu nghiên cứu đề xuất

**Khảo sát thực trạng:**  
- Nên lấy tối thiểu 150-300 sinh viên để có dữ liệu đủ đáng tin ở cấp trường

**Pilot SmartLife:**  
- Nên chọn 20-40 sinh viên sẵn sàng dùng thử trong 4-6 tuần
- Có thể chia:
  - nhóm chưa từng dùng app quản lý
  - nhóm đã từng dùng app quản lý

Nếu làm kỹ hơn, có thể chia:

- **Nhóm A**: chưa từng dùng app quản lý
- **Nhóm B**: đã từng dùng app quản lý khác
- **Nhóm C**: dùng SmartLife trong giai đoạn pilot

### 13.4. Cách chọn mẫu

Ở cấp trường, có thể dùng:

- lấy mẫu thuận tiện có kiểm soát
- phát khảo sát theo khoa/lớp
- cố gắng bảo đảm đủ nhiều sinh viên ở nhiều năm học khác nhau

### 13.5. Thời gian nghiên cứu gợi ý

- Tuần 1-2: khảo sát thực trạng
- Tuần 3: tổng hợp kết quả khảo sát, rút ra nhu cầu chính
- Tuần 4-8: pilot SmartLife với nhóm sinh viên tham gia dùng thử
- Tuần 9: khảo sát sau sử dụng + phỏng vấn ngắn
- Tuần 10: phân tích kết quả và đề xuất hướng spin-off sản phẩm

---

## 14. Thiết kế bảng khảo sát sinh viên trong trường

Phần này có thể đưa trực tiếp vào đề cương hoặc chuyển thành Google Form.

### 14.1. Phần A - Thông tin chung

1. Bạn đang là sinh viên năm mấy?
2. Bạn thuộc khoa/ngành nào?
3. Giới tính của bạn?
4. Bạn đang ở ký túc xá, ở trọ hay ở cùng gia đình?
5. Bạn có đi làm thêm không?

### 14.2. Phần B - Thực trạng tự quản của sinh viên

Thang đo gợi ý: 1 = Hoàn toàn không đồng ý, 5 = Hoàn toàn đồng ý

1. Tôi thường lên kế hoạch học tập cho tuần của mình.
2. Tôi thường xuyên quên deadline hoặc các công việc quan trọng.
3. Tôi gặp khó khăn trong việc duy trì thói quen học tập đều đặn.
4. Tôi kiểm soát chi tiêu cá nhân của mình tốt.
5. Tôi thường biết rõ mình đang tiến gần hay xa mục tiêu học tập của bản thân.
6. Tôi hay cảm thấy việc học và việc cá nhân bị rối vì thiếu kế hoạch rõ ràng.
7. Tôi cần một công cụ giúp tôi theo dõi và quản lý bản thân tốt hơn.

### 14.3. Phần C - Hành vi tìm kiếm công cụ hỗ trợ

1. Bạn hiện có dùng công cụ nào để quản lý lịch trình, việc cần làm, thu chi hoặc học tập không?
   - Không dùng công cụ nào
   - Dùng sổ tay
   - Dùng Excel/Google Sheet
   - Dùng app todo/lịch
   - Dùng app quản lý chi tiêu
   - Dùng nhiều công cụ khác nhau

2. Nếu bạn **không dùng app quản lý**, lý do chính là gì?
   - Tôi chưa thấy thật sự cần
   - Tôi có nhu cầu nhưng chưa tìm được app phù hợp
   - Tôi thấy app quản lý phức tạp và khó duy trì
   - Tôi ngại nhập dữ liệu thường xuyên
   - Tôi quen quản lý theo cách riêng
   - Lý do khác

3. Nếu bạn từng thử app quản lý trước đây, vì sao bạn không tiếp tục dùng?
   - Quá rườm rà
   - Không phù hợp nhu cầu
   - Không có AI/cá nhân hóa
   - Không tạo được thói quen
   - Không thấy hiệu quả rõ ràng
   - Lý do khác

4. Khi gặp khó khăn trong quản lý học tập hoặc thời gian, bạn thường làm gì?
   - Tự ghi nhớ
   - Hỏi bạn bè
   - Tìm trên mạng
   - Dùng app/công cụ
   - Để đó và xử lý sau

### 14.4. Phần D - Nhận thức và nhu cầu đối với một công cụ như SmartLife

Thang đo 1-5

1. Tôi muốn có một công cụ tích hợp cả lịch học, todo, mục tiêu và theo dõi tiến độ.
2. Tôi muốn có công cụ hỗ trợ theo dõi GPA và lập kế hoạch học tập.
3. Tôi muốn có AI gợi ý cách sắp xếp công việc và mục tiêu cá nhân.
4. Tôi muốn có công cụ giúp theo dõi chi tiêu dành riêng cho sinh viên.
5. Nếu một công cụ dễ dùng và phù hợp, tôi sẵn sàng dùng thử trong ít nhất 1 tháng.
6. AI cá nhân hóa có thể giúp tôi ra quyết định tốt hơn trong học tập và quản lý thời gian.

### 14.5. Phần E - Đánh giá mức độ phù hợp của SmartLife sau khi giới thiệu hoặc cho dùng thử

Có thể áp dụng sau khi người tham gia xem demo hoặc dùng thử.

1. SmartLife phù hợp với nhu cầu thực tế của sinh viên.
2. SmartLife dễ hiểu và dễ bắt đầu sử dụng.
3. SmartLife giúp tôi có cái nhìn tổng quan hơn về việc học và mục tiêu cá nhân.
4. SmartLife có thể giúp tôi hình thành thói quen tự quản tốt hơn.
5. Tôi sẽ tiếp tục sử dụng SmartLife nếu sản phẩm được hoàn thiện thêm.
6. Tôi sẵn sàng giới thiệu SmartLife cho bạn bè nếu ứng dụng ổn định và dễ dùng.

### 14.6. Câu hỏi mở

1. Theo bạn, khó khăn lớn nhất của sinh viên trong việc tự quản hiện nay là gì?
2. Nếu có một ứng dụng dành riêng cho sinh viên, bạn muốn nó giúp bạn điều gì nhất?
3. Bạn thấy SmartLife còn thiếu điều gì để thực sự hữu ích với sinh viên trong trường?

---

## 15. Thiết kế đo lường kết quả thực tế từ pilot SmartLife

Để bài nghiên cứu có “kết quả thực”, không nên chỉ dừng ở khảo sát nhận thức. Anh nên bổ sung một **pilot can thiệp ngắn hạn**.

### 15.1. Thiết kế trước - sau

**Bước 1.** Khảo sát trước khi dùng SmartLife:

- mức độ tự quản hiện tại
- công cụ đang dùng
- mức độ khó khăn
- nhu cầu hỗ trợ

**Bước 2.** Cho sinh viên dùng SmartLife trong 4-6 tuần:

- cập nhật todo
- ghi lịch trình
- thử dùng focus timer
- theo dõi GPA hoặc mục tiêu
- tương tác với AI nếu cần

**Bước 3.** Khảo sát sau khi dùng:

- cảm nhận thay đổi
- hành vi nào cải thiện rõ nhất
- tính năng nào hữu ích nhất
- rào cản nào còn tồn tại

### 15.2. Chỉ số kết quả có thể dùng

#### Chỉ số từ khảo sát

- điểm tự đánh giá khả năng tự quản trước và sau
- mức độ nhận thức về sự cần thiết của công cụ hỗ trợ
- mức độ sẵn sàng tiếp tục sử dụng
- mức độ tin tưởng vào AI hỗ trợ

#### Chỉ số từ log sử dụng SmartLife

Với code hiện tại, có thể khai thác tốt:

- số lượng `todos` được tạo
- tỷ lệ `todos` hoàn thành
- số lượng mục tiêu được thêm
- số lần ghi nhận `transactions`
- số kỳ/môn GPA được cập nhật
- số phiên chat AI, số tin nhắn AI, số token từ `api_logs`

Riêng dữ liệu focus timer hiện mới ở `localStorage`, nên nếu muốn dùng làm chỉ số nghiên cứu chính thì cần nâng cấp lưu xuống database trong phiên bản tiếp theo.

### 15.3. So sánh nhóm sinh viên chưa từng dùng app quản lý

Đây là điểm rất mạnh cho đề tài của anh.

Có thể kiểm tra:

- trước khi dùng SmartLife, nhóm này quản lý theo cách nào
- sau khi dùng SmartLife, họ có thay đổi rõ hơn nhóm đã từng dùng app hay không
- SmartLife có giúp “kích hoạt nhận thức” và tạo thói quen số lần đầu cho họ hay không

Nếu nhóm chưa từng dùng app mà lại cải thiện rõ sau pilot, đó là bằng chứng rất mạnh cho luận điểm:

> SmartLife không chỉ phục vụ người đã có thói quen quản lý, mà còn có thể trở thành công cụ khởi tạo hành vi tự quản cho sinh viên trước đây chưa có hệ thống hỗ trợ phù hợp.

---

## 16. Cách xử lý dữ liệu để chứng minh giả thuyết

### 16.1. Với khảo sát thực trạng

Anh có thể dùng các thống kê cơ bản:

- tần suất
- tỷ lệ phần trăm
- điểm trung bình từng nhóm biến
- so sánh giữa nhóm đã dùng và chưa dùng app quản lý

Ví dụ:

- bao nhiêu phần trăm sinh viên chưa từng dùng app quản lý
- bao nhiêu phần trăm trong nhóm đó vẫn thừa nhận họ gặp khó khăn về tự quản
- yếu tố cản trở lớn nhất là gì

### 16.2. Với pilot SmartLife

Anh có thể dùng:

- so sánh trước - sau
- so sánh nhóm chưa từng dùng app với nhóm đã từng dùng app
- phân tích câu hỏi mở để rút ra insight định tính

Nếu số mẫu đủ lớn hơn, có thể làm thêm:

- kiểm định T-test trước - sau
- kiểm định khác biệt giữa các nhóm
- tương quan giữa mức độ dùng AI và mức độ cải thiện tự quản

### 16.3. Logic chứng minh giả thuyết

Ví dụ:

- Nếu sinh viên đánh giá khó khăn tự quản cao nhưng tỷ lệ dùng app thấp -> chứng minh có khoảng trống công cụ
- Nếu sinh viên đánh giá SmartLife phù hợp và dễ dùng -> chứng minh tính khả thi của giải pháp
- Nếu sau pilot các chỉ số hành vi và nhận thức cải thiện -> chứng minh SmartLife có tiềm năng tác động thực

---

## 17. Từ nghiên cứu đến spin-off sản phẩm SmartLife

Phần này rất quan trọng nếu anh muốn đề tài không chỉ dừng ở học thuật mà còn giúp phát triển sản phẩm thật.

### 17.1. Dữ liệu khảo sát giúp xác định đúng pain points

Khảo sát sẽ cho biết sinh viên thật sự thiếu gì:

- thiếu công cụ tổng hợp
- thiếu động lực duy trì
- thiếu AI tư vấn đúng ngữ cảnh
- thiếu công cụ dễ dùng cho sinh viên mới bắt đầu

Khi đó SmartLife có thể spin-off theo hướng rất rõ ràng, không phải xây theo cảm tính.

### 17.2. Có thể xây roadmap sản phẩm dựa trên kết quả nghiên cứu

Ví dụ:

- nếu sinh viên quan tâm nhất đến deadline và học tập -> ưu tiên module Schedule + GPA + AI planning
- nếu sinh viên ngại nhập dữ liệu thủ công -> ưu tiên tự động hóa và giảm số bước thao tác
- nếu sinh viên mới bắt đầu rất cần hướng dẫn -> thiết kế onboarding riêng cho nhóm chưa từng dùng app quản lý
- nếu AI là yếu tố giữ chân -> đầu tư mạnh vào nudges và cá nhân hóa

### 17.3. SmartLife có thể trở thành sản phẩm spin-off có cơ sở thực nghiệm

Điểm mạnh của hướng này là sản phẩm không chỉ “có ý tưởng hay”, mà có:

- bằng chứng về nhu cầu thật trong trường
- dữ liệu khảo sát thực tế
- dữ liệu dùng thử thực tế
- phản hồi người dùng thật

Như vậy, spin-off SmartLife sẽ có nền tảng mạnh hơn cả về học thuật lẫn sản phẩm.

---

## 18. Gợi ý tên đề tài theo hướng đã bổ sung phương pháp nghiên cứu

Nếu muốn bám sát hơn với phần khảo sát nhận thức, tìm kiếm công cụ và pilot sản phẩm, tên đề tài có thể điều chỉnh theo hướng sau:

### Phương án A

**Nghiên cứu nhận thức, nhu cầu và hành vi tìm kiếm công cụ hỗ trợ tự quản của sinh viên đại học, từ đó đề xuất và đánh giá giải pháp SmartLife**

Tên này mạnh ở chỗ có đủ ba lớp: thực trạng nhận thức, hành vi tìm giải pháp, và đề xuất sản phẩm.

### Phương án B

**Nghiên cứu thực trạng tự quản của sinh viên đại học và đánh giá tiềm năng ứng dụng SmartLife như một công cụ AI hỗ trợ hình thành thói quen tự quản**

Tên này cân bằng giữa bài toán thực trạng và thử nghiệm giải pháp.

### Phương án C

**Khảo sát thực trạng tự quản học tập, thời gian và tài chính của sinh viên đại học, từ đó phát triển và đánh giá giải pháp SmartLife**

Tên này khá “chuẩn nghiên cứu cấp trường”, dễ bảo vệ vì có logic vấn đề -> khảo sát -> phát triển giải pháp -> đánh giá.
