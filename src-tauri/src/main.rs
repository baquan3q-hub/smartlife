// SmartLife Desktop (Windows) — vỏ Tauri v2 bọc web app https://smartlife.courses
// - Cửa sổ chính: toàn bộ SmartLife (đóng = ẩn xuống khay hệ thống)
// - Cửa sổ note nổi: #/sticky-window?id=<uuid>. Khung cửa sổ do Windows vẽ → kéo, đổi kích thước, đóng
//   luôn hoạt động, không phụ thuộc trang web. Mặc định luôn nằm trên cùng.
// - Đóng note: Rust gọi window.__smartlifeSaveNow() để lưu nốt rồi mới huỷ cửa sổ.
// - Lệnh từ trang web → app: trang "điều hướng" tới https://smartlife.courses/__desktop/<lệnh>?...,
//   Rust chặn lượt điều hướng đó (on_navigation) và thực hiện lệnh. Không cần kênh IPC của Tauri
//   (kênh này không hoạt động ổn định với trang tải từ web). Rust → trang dùng eval().
// - Danh sách note đang mở lưu ở file trong thư mục dữ liệu app → mở lại khi khởi động.
// - Khay hệ thống, phím tắt toàn cục Ctrl+Alt+N, tự khởi động, nhớ vị trí/kích thước, chỉ chạy 1 bản.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{collections::HashMap, path::PathBuf, sync::Mutex, time::Duration};

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_window_state::StateFlags;

const MAIN_LABEL: &str = "main";
const STICKY_PREFIX: &str = "sticky-";
const APP_URL: &str = "https://www.smartlife.courses/";
/// Tên miền gốc. Chấp nhận cả biến thể có tiền tố (vd www.smartlife.courses) vì máy chủ có thể chuyển hướng.
const APP_HOST: &str = "smartlife.courses";
/// Tiền tố đường dẫn của "lệnh desktop" (xem desktop_command_handler).
const COMMAND_PREFIX: &str = "/__desktop/";
/// Đánh dấu cho trang web biết đang chạy trong app desktop có hỗ trợ lệnh /__desktop/.
const DESKTOP_MARKER_JS: &str = "window.__SMARTLIFE_DESKTOP__ = 2;";
const MINIMIZED_ARG: &str = "--minimized";
const OPEN_LIST_FILE: &str = "open-sticky-notes.txt";
/// Hàm JS lưu nốt thay đổi (StickyWindowApp.tsx). Gọi qua eval nên không cần quyền IPC.
const SAVE_NOW_JS: &str = "window.__smartlifeSaveNow && window.__smartlifeSaveNow()";
/// Thời gian chờ JS gửi dữ liệu trước khi huỷ cửa sổ / thoát app.
/// (Dữ liệu đã được ghi vào máy từng lần gõ phím, đây chỉ là để kịp đẩy lên server.)
const SAVE_GRACE: Duration = Duration::from_millis(900);

static OPEN_LIST_LOCK: Mutex<()> = Mutex::new(());

/// Đường dẫn cửa sổ note nổi. Phải cùng origin với cửa sổ chính (tauri.conf.json → app.windows[0].url)
/// để dùng chung phiên đăng nhập Supabase (localStorage).
fn sticky_url(query: &str) -> Result<tauri::Url, String> {
    tauri::Url::parse(&format!("{APP_URL}#/sticky-window?{query}")).map_err(|e| e.to_string())
}

fn is_app_host(host: Option<&str>) -> bool {
    host.is_some_and(|h| h == APP_HOST || h.ends_with(&format!(".{APP_HOST}")))
}

fn is_valid_note_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

// ── Danh sách note đang mở (file text, mỗi dòng 1 id) ─────────────────────────
fn open_list_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join(OPEN_LIST_FILE))
}

fn read_open_ids(app: &AppHandle) -> Vec<String> {
    let Some(path) = open_list_path(app) else { return Vec::new() };
    let mut ids: Vec<String> = Vec::new();
    for line in std::fs::read_to_string(path).unwrap_or_default().lines() {
        let id = line.trim().to_string();
        if is_valid_note_id(&id) && !ids.contains(&id) {
            ids.push(id);
        }
    }
    ids
}

fn write_open_ids(app: &AppHandle, ids: &[String]) {
    let Some(path) = open_list_path(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Err(e) = std::fs::write(&path, ids.join("\n")) {
        eprintln!("[SmartLife] Không ghi được danh sách note đang mở: {e}");
    }
}

fn remember_open(app: &AppHandle, id: &str) {
    let _guard = OPEN_LIST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut ids = read_open_ids(app);
    if !ids.iter().any(|x| x == id) {
        ids.push(id.to_string());
        write_open_ids(app, &ids);
    }
}

fn forget_open(app: &AppHandle, id: &str) {
    let _guard = OPEN_LIST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let ids: Vec<String> = read_open_ids(app).into_iter().filter(|x| x != id).collect();
    write_open_ids(app, &ids);
}

// ── Cửa sổ ────────────────────────────────────────────────────────────────────
fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_LABEL) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn for_each_sticky(app: &AppHandle, f: impl Fn(&tauri::WebviewWindow)) {
    for (label, window) in app.webview_windows() {
        if label.starts_with(STICKY_PREFIX) {
            f(&window);
        }
    }
}

/// Mở (hoặc focus) cửa sổ note nổi. Nhãn cửa sổ cố định theo id note để plugin window-state nhớ vị trí.
/// Chỉ gọi ngoài main thread (command async / tác vụ nền) — trên Windows, tạo WebView2 trong handler
/// sự kiện hay command đồng bộ có thể làm treo app.
fn open_sticky(app: &AppHandle, note_id: &str, is_new: bool) -> Result<(), String> {
    if !is_valid_note_id(note_id) {
        return Err("invalid note id".into());
    }
    let label = format!("{STICKY_PREFIX}{note_id}");
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    let query = if is_new {
        format!("id={note_id}&new=1")
    } else {
        format!("id={note_id}")
    };
    WebviewWindowBuilder::new(app, label.clone(), WebviewUrl::External(sticky_url(&query)?))
        .title("Ghi chú")
        .inner_size(300.0, 320.0)
        .min_inner_size(200.0, 150.0)
        // Khung Windows: kéo thanh tiêu đề để di chuyển, kéo mép/góc để đổi kích thước,
        // "–" để thu nhỏ xuống taskbar (gộp chung icon SmartLife), X để đóng
        .decorations(true)
        .resizable(true)
        .maximizable(true)
        .minimizable(true)
        .skip_taskbar(false)
        // Mặc định không ghim; trang tự bật lại nếu note đã được ghim trước đó
        .always_on_top(false)
        .initialization_script(DESKTOP_MARKER_JS)
        .on_navigation(desktop_command_handler(app.clone(), label))
        .build()
        .map_err(|e| e.to_string())?;
    remember_open(app, note_id);
    Ok(())
}

fn spawn_open_sticky(app: &AppHandle, note_id: String, is_new: bool) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = open_sticky(&app, &note_id, is_new) {
            eprintln!("[SmartLife] Không mở được note {note_id}: {e}");
        }
    });
}

fn new_quick_note(app: &AppHandle) {
    spawn_open_sticky(app, uuid::Uuid::new_v4().to_string(), true);
}

/// Người dùng đóng note: ẩn ngay cho mượt, cho JS lưu nốt, rồi mới huỷ cửa sổ.
fn close_sticky_gracefully(app: &AppHandle, label: &str) {
    if let Some(id) = label.strip_prefix(STICKY_PREFIX) {
        forget_open(app, id);
    }
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.hide();
        let _ = window.eval(SAVE_NOW_JS);
        std::thread::spawn(move || {
            std::thread::sleep(SAVE_GRACE);
            let _ = window.destroy();
        });
    }
}

/// Thoát app: cho mọi note lưu nốt rồi mới thoát. Danh sách note đang mở được giữ để lần sau mở lại.
fn quit_gracefully(app: &AppHandle) {
    for_each_sticky(app, |w| {
        let _ = w.eval(SAVE_NOW_JS);
    });
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(SAVE_GRACE);
        app.exit(0);
    });
}

// ── Lệnh desktop từ trang web (qua điều hướng bị chặn) ──────────────────────────
/// Trả về hàm xử lý điều hướng cho 1 cửa sổ. URL dạng https://smartlife.courses/__desktop/<lệnh>?<tham số>
/// được coi là lệnh: chặn điều hướng (trang giữ nguyên) và thực hiện lệnh. URL khác cho đi bình thường.
fn desktop_command_handler(app: AppHandle, label: String) -> impl Fn(&tauri::Url) -> bool + Send + 'static {
    let is_sticky = label.starts_with(STICKY_PREFIX);
    move |url: &tauri::Url| {
        let on_app_host = is_app_host(url.host_str());
        let is_command = on_app_host && url.path().starts_with(COMMAND_PREFIX);
        if !is_command {
            // Cửa sổ note chỉ được ở trang gốc (#/sticky-window) của SmartLife: chặn điều hướng sang
            // đường dẫn khác trên cùng tên miền để note không bao giờ biến thành giao diện app đầy đủ.
            // Tên miền khác (vd máy chủ chuyển hướng) vẫn cho đi để cửa sổ không bị trắng.
            if is_sticky && on_app_host {
                let path = url.path();
                return path == "/" || path == "/index.html";
            }
            return true;
        }
        let command = url.path()[COMMAND_PREFIX.len()..].trim_end_matches('/').to_string();
        let params: HashMap<String, String> = url.query_pairs().into_owned().collect();
        let app = app.clone();
        let label = label.clone();
        // Chạy ngoài handler điều hướng (tạo cửa sổ trong handler có thể treo trên Windows)
        tauri::async_runtime::spawn(async move {
            run_desktop_command(&app, &label, &command, &params);
            // Báo lại cho trang là lệnh đã được nhận (desktopBridge chờ tín hiệu này)
            let nonce: String = params
                .get("nonce")
                .map(|n| n.chars().filter(|c| c.is_ascii_alphanumeric()).take(32).collect())
                .unwrap_or_default();
            if !nonce.is_empty() {
                if let Some(w) = app.get_webview_window(&label) {
                    let _ = w.eval(&format!("window.__smartlifeAck && window.__smartlifeAck('{nonce}')"));
                }
            }
        });
        false
    }
}

fn run_desktop_command(app: &AppHandle, label: &str, command: &str, params: &HashMap<String, String>) {
    let param = |key: &str| params.get(key).map(String::as_str).unwrap_or("");
    let this_window = || app.get_webview_window(label);
    match command {
        "new-note" => {
            let _ = open_sticky(app, &uuid::Uuid::new_v4().to_string(), true);
        }
        "open-note" => {
            if let Err(e) = open_sticky(app, param("id"), false) {
                eprintln!("[SmartLife] open-note: {e}");
            }
        }
        "show-main" => {
            show_main(app);
            if param("tab") == "sticky" {
                let _ = app.emit_to(MAIN_LABEL, "smartlife://navigate", "sticky");
                if let Some(main) = app.get_webview_window(MAIN_LABEL) {
                    let _ = main.eval("window.location.hash = '#/sticky'");
                }
            }
        }
        "on-top" => {
            if let Some(w) = this_window() {
                let _ = w.set_always_on_top(param("value") == "1");
            }
        }
        "ping" => {}
        "close" => {
            if label.starts_with(STICKY_PREFIX) {
                close_sticky_gracefully(app, label);
            }
        }
        "minimize" => {
            if let Some(w) = this_window() {
                let _ = w.minimize();
            }
        }
        other => eprintln!("[SmartLife] Lệnh desktop không hỗ trợ: {other}"),
    }
}

fn create_main_window(app: &AppHandle, visible: bool) -> tauri::Result<()> {
    let url = tauri::Url::parse(APP_URL).expect("valid app url");
    WebviewWindowBuilder::new(app, MAIN_LABEL, WebviewUrl::External(url))
        .title("SmartLife")
        .inner_size(1280.0, 820.0)
        .min_inner_size(420.0, 560.0)
        .center()
        .visible(visible)
        .initialization_script(DESKTOP_MARKER_JS)
        .on_navigation(desktop_command_handler(app.clone(), MAIN_LABEL.to_string()))
        .build()?;
    Ok(())
}

// ── Commands (gọi từ JS qua IPC — giữ cho tương thích) ──────────────────────────────────────────────────────
#[tauri::command]
async fn open_sticky_window(app: AppHandle, note_id: String) -> Result<(), String> {
    open_sticky(&app, &note_id, false)
}

#[tauri::command]
async fn new_sticky_window(app: AppHandle) -> Result<(), String> {
    open_sticky(&app, &uuid::Uuid::new_v4().to_string(), true)
}

#[tauri::command]
fn show_main_window(app: AppHandle) {
    show_main(&app);
}

// ── Khay hệ thống ─────────────────────────────────────────────────────────────
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let handle = app.handle();
    let autostart_on = handle.autolaunch().is_enabled().unwrap_or(false);

    let new_i = MenuItem::with_id(handle, "new", "Ghi chú mới (Ctrl+Alt+N)", true, None::<&str>)?;
    let show_notes_i = MenuItem::with_id(handle, "show_notes", "Hiện các ghi chú nổi", true, None::<&str>)?;
    let hide_notes_i = MenuItem::with_id(handle, "hide_notes", "Ẩn các ghi chú nổi", true, None::<&str>)?;
    let sticky_i = MenuItem::with_id(handle, "sticky", "Mở bảng Sticky Notes", true, None::<&str>)?;
    let open_i = MenuItem::with_id(handle, "open", "Mở SmartLife", true, None::<&str>)?;
    let autostart_i = CheckMenuItem::with_id(handle, "autostart", "Khởi động cùng Windows", true, autostart_on, None::<&str>)?;
    let quit_i = MenuItem::with_id(handle, "quit", "Thoát SmartLife", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(handle)?;
    let sep2 = PredefinedMenuItem::separator(handle)?;
    let sep3 = PredefinedMenuItem::separator(handle)?;
    let menu = Menu::with_items(
        handle,
        &[&new_i, &show_notes_i, &hide_notes_i, &sep1, &sticky_i, &open_i, &sep2, &autostart_i, &sep3, &quit_i],
    )?;

    let autostart_item = autostart_i.clone();
    let mut tray = TrayIconBuilder::with_id("smartlife-tray")
        .tooltip("SmartLife — Ctrl+Alt+N: ghi chú mới")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "new" => new_quick_note(app),
            "show_notes" => for_each_sticky(app, |w| {
                let _ = w.show();
                let _ = w.set_focus();
            }),
            "hide_notes" => for_each_sticky(app, |w| {
                let _ = w.hide();
            }),
            "sticky" => {
                show_main(app);
                let _ = app.emit_to(MAIN_LABEL, "smartlife://navigate", "sticky");
            }
            "open" => show_main(app),
            "autostart" => {
                let launcher = app.autolaunch();
                let enabled = launcher.is_enabled().unwrap_or(false);
                let result = if enabled { launcher.disable() } else { launcher.enable() };
                let now_enabled = if result.is_ok() { !enabled } else { enabled };
                let _ = autostart_item.set_checked(now_enabled);
            }
            "quit" => quit_gracefully(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } = event {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = handle.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(handle)?;
    Ok(())
}

fn main() {
    // Ctrl+Alt+N (không dùng Ctrl+Alt+N vì trùng phím "cửa sổ ẩn danh" của Chrome/Edge)
    let quick_note = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN);

    let app = tauri::Builder::default()
        // Phải đăng ký đầu tiên: mở lần 2 → focus cửa sổ đang chạy
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Chỉ nhớ vị trí & kích thước, không nhớ trạng thái ẩn/hiện
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed && shortcut == &quick_note {
                        new_quick_note(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![open_sticky_window, new_sticky_window, show_main_window])
        .setup(move |app| {
            setup_tray(app)?;

            if let Err(e) = app.global_shortcut().register(quick_note) {
                // Phím tắt có thể đã bị ứng dụng khác chiếm — không chặn app khởi động
                eprintln!("[SmartLife] Không đăng ký được Ctrl+Alt+N: {e}");
            }

            // Cửa sổ chính (tạo bằng code để gắn bộ xử lý lệnh desktop).
            // Khởi động cùng Windows → chạy ngầm dưới khay.
            let start_hidden = std::env::args().any(|a| a == MINIMIZED_ARG);
            create_main_window(app.handle(), !start_hidden)?;

            // Mở lại các note nổi đang mở lần trước (giống Microsoft Sticky Notes)
            let handle = app.handle().clone();
            for id in read_open_ids(&handle) {
                spawn_open_sticky(&handle, id, false);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label().to_string();
                if label == MAIN_LABEL {
                    // Đóng cửa sổ chính = ẩn xuống khay (note nổi vẫn hoạt động)
                    api.prevent_close();
                    let _ = window.hide();
                } else if label.starts_with(STICKY_PREFIX) {
                    api.prevent_close();
                    close_sticky_gracefully(window.app_handle(), &label);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building SmartLife desktop");

    app.run(|handle, event| {
        // Thoát bằng cách khác (vd Windows tắt máy): cố gắng cho các note lưu nốt.
        // Dữ liệu vẫn an toàn nhờ đã ghi vào máy ở từng lần gõ phím.
        if let RunEvent::ExitRequested { .. } = event {
            for_each_sticky(handle, |w| {
                let _ = w.eval(SAVE_NOW_JS);
            });
        }
    });
}
