// SmartLife Desktop (Windows) — vỏ Tauri v2 bọc web app https://smartlife.courses
// - Cửa sổ chính: toàn bộ SmartLife (đóng = ẩn xuống khay hệ thống)
// - Cửa sổ note nổi: #/sticky-window?id=<uuid>, không viền, luôn nằm trên cùng
// - Khay hệ thống, phím tắt toàn cục Ctrl+Shift+N, tự khởi động, nhớ vị trí cửa sổ, chỉ chạy 1 bản

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_window_state::StateFlags;

const MAIN_LABEL: &str = "main";
const APP_URL: &str = "https://smartlife.courses/";
const MINIMIZED_ARG: &str = "--minimized";

/// Đường dẫn cửa sổ note nổi. Phải cùng origin với cửa sổ chính (tauri.conf.json → app.windows[0].url)
/// để dùng chung phiên đăng nhập Supabase (localStorage).
fn sticky_url(query: &str) -> Result<tauri::Url, String> {
    tauri::Url::parse(&format!("{APP_URL}#/sticky-window?{query}")).map_err(|e| e.to_string())
}

fn is_valid_note_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_LABEL) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Mở (hoặc focus) cửa sổ note nổi. Nhãn cửa sổ cố định theo id note để plugin window-state nhớ vị trí.
fn open_sticky(app: &AppHandle, note_id: &str, is_new: bool) -> Result<(), String> {
    if !is_valid_note_id(note_id) {
        return Err("invalid note id".into());
    }
    let label = format!("sticky-{note_id}");
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    let query = if is_new {
        format!("id={note_id}&new=1")
    } else {
        format!("id={note_id}")
    };
    WebviewWindowBuilder::new(app, label, WebviewUrl::External(sticky_url(&query)?))
        .title("Sticky Note")
        .inner_size(320.0, 340.0)
        .min_inner_size(220.0, 160.0)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn new_quick_note(app: &AppHandle) {
    let id = uuid::Uuid::new_v4().to_string();
    if let Err(e) = open_sticky(app, &id, true) {
        eprintln!("[SmartLife] Không mở được note mới: {e}");
    }
}

#[tauri::command]
fn open_sticky_window(app: AppHandle, note_id: String) -> Result<(), String> {
    open_sticky(&app, &note_id, false)
}

#[tauri::command]
fn show_main_window(app: AppHandle) {
    show_main(&app);
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let handle = app.handle();
    let autostart_on = handle.autolaunch().is_enabled().unwrap_or(false);

    let new_i = MenuItem::with_id(handle, "new", "Ghi chú mới (Ctrl+Shift+N)", true, None::<&str>)?;
    let sticky_i = MenuItem::with_id(handle, "sticky", "Mở Sticky Notes", true, None::<&str>)?;
    let open_i = MenuItem::with_id(handle, "open", "Mở SmartLife", true, None::<&str>)?;
    let autostart_i = CheckMenuItem::with_id(handle, "autostart", "Khởi động cùng Windows", true, autostart_on, None::<&str>)?;
    let quit_i = MenuItem::with_id(handle, "quit", "Thoát SmartLife", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(handle)?;
    let sep2 = PredefinedMenuItem::separator(handle)?;
    let menu = Menu::with_items(handle, &[&new_i, &sticky_i, &open_i, &sep1, &autostart_i, &sep2, &quit_i])?;

    let autostart_item = autostart_i.clone();
    let mut tray = TrayIconBuilder::with_id("smartlife-tray")
        .tooltip("SmartLife")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "new" => new_quick_note(app),
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
            "quit" => app.exit(0),
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
    let quick_note = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyN);

    tauri::Builder::default()
        // Phải đăng ký đầu tiên: mở lần 2 → focus cửa sổ đang chạy
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Không nhớ trạng thái ẩn/hiện, chỉ nhớ vị trí & kích thước
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
        .invoke_handler(tauri::generate_handler![open_sticky_window, show_main_window])
        .setup(move |app| {
            setup_tray(app)?;

            if let Err(e) = app.global_shortcut().register(quick_note) {
                // Phím tắt có thể đã bị ứng dụng khác chiếm — không chặn app khởi động
                eprintln!("[SmartLife] Không đăng ký được Ctrl+Shift+N: {e}");
            }

            // Khởi động cùng Windows → chạy ngầm dưới khay
            if std::env::args().any(|a| a == MINIMIZED_ARG) {
                if let Some(w) = app.get_webview_window(MAIN_LABEL) {
                    let _ = w.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Đóng cửa sổ chính = ẩn xuống khay (note nổi vẫn hoạt động)
            if window.label() == MAIN_LABEL {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running SmartLife desktop");
}
