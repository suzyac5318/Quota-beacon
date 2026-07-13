#[cfg(windows)]
mod windows_impl {
    use std::{
        collections::{HashMap, HashSet},
        fs::{self, File},
        io::{BufRead, BufReader, Seek, SeekFrom},
        path::{Path, PathBuf},
        sync::{Arc, Mutex},
        thread,
        time::Duration,
    };

    use tauri::{
        AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl,
        WebviewWindowBuilder,
    };
    use windows_sys::Win32::{
        Foundation::{CloseHandle, HWND, LPARAM, RECT},
        System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
        },
        UI::WindowsAndMessaging::{
            EnumWindows, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId, IsIconic,
            IsWindowVisible,
        },
    };

    use crate::{models::ConversationTokenUsage, token_usage};

    const OVERLAY_WIDTH: f64 = 96.0;
    const OVERLAY_HEIGHT: f64 = 32.0;
    const RIGHT_INSET: f64 = 16.0;
    const TOP_INSET: f64 = 78.0;
    const MIN_CODEX_WIDTH: f64 = 560.0;
    const POLL_INTERVAL: Duration = Duration::from_millis(80);
    const TOKEN_REFRESH_TICKS: u8 = 6;

    #[derive(Clone, Copy)]
    struct CodexWindow {
        hwnd: isize,
        rect: RECT,
        minimized: bool,
    }

    #[derive(Default)]
    struct LogTail {
        path: Option<PathBuf>,
        offset: u64,
    }

    #[derive(Debug)]
    struct ActivityEvent {
        renderer_window_id: String,
        conversation_id: String,
    }

    unsafe extern "system" fn enum_window(hwnd: HWND, lparam: LPARAM) -> i32 {
        if IsWindowVisible(hwnd) == 0 || !is_codex_window(hwnd) {
            return 1;
        }
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect) != 0 && rect.right > rect.left && rect.bottom > rect.top {
            let windows = &mut *(lparam as *mut Vec<CodexWindow>);
            windows.push(CodexWindow {
                hwnd: hwnd as isize,
                rect,
                minimized: IsIconic(hwnd) != 0,
            });
        }
        1
    }

    unsafe fn is_codex_window(hwnd: HWND) -> bool {
        let mut process_id = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        if process_id == 0 {
            return false;
        }
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
        if process.is_null() {
            return false;
        }
        let mut buffer = vec![0u16; 1024];
        let mut length = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut length) != 0;
        CloseHandle(process);
        if !ok {
            return false;
        }
        let path = String::from_utf16_lossy(&buffer[..length as usize]).to_ascii_lowercase();
        path.ends_with("\\chatgpt.exe") && path.contains("\\openai.codex_")
    }

    fn enumerate_codex_windows() -> Vec<CodexWindow> {
        let mut windows = Vec::new();
        unsafe {
            EnumWindows(
                Some(enum_window),
                &mut windows as *mut Vec<CodexWindow> as LPARAM,
            );
        }
        windows
    }

    fn logs_root() -> Option<PathBuf> {
        let packages = dirs::data_local_dir()?.join("Packages");
        fs::read_dir(packages).ok()?.flatten().find_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("OpenAI.Codex_") {
                return None;
            }
            let path = entry.path().join("LocalCache/Local/Codex/Logs");
            path.is_dir().then_some(path)
        })
    }

    fn newest_log(directory: &Path) -> Option<PathBuf> {
        fn visit(directory: &Path, newest: &mut Option<(std::time::SystemTime, PathBuf)>) {
            let Ok(entries) = fs::read_dir(directory) else {
                return;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    visit(&path, newest);
                } else if path.extension().and_then(|value| value.to_str()) == Some("log") {
                    let modified = entry.metadata().and_then(|value| value.modified()).ok();
                    if let Some(modified) = modified {
                        if newest.as_ref().is_none_or(|current| modified > current.0) {
                            *newest = Some((modified, path));
                        }
                    }
                }
            }
        }
        let mut newest = None;
        visit(directory, &mut newest);
        newest.map(|(_, path)| path)
    }

    fn field(line: &str, name: &str) -> Option<String> {
        let start = line.find(name)? + name.len();
        let value = &line[start..];
        let end = value.find(char::is_whitespace).unwrap_or(value.len());
        Some(value[..end].trim_matches('"').to_string())
    }

    fn activity_event(line: &str) -> Option<ActivityEvent> {
        if !line.contains("rendererWindowFocused=true") {
            return None;
        }
        let explicitly_active = line.contains("thread_stream_view_activity_changed active=true");
        let conversation_created = line.contains("Conversation created");
        if !explicitly_active && !conversation_created {
            return None;
        }
        Some(ActivityEvent {
            renderer_window_id: field(line, "rendererWindowId=")?,
            conversation_id: field(line, "conversationId=")?,
        })
    }

    impl LogTail {
        fn read_events(&mut self) -> Vec<ActivityEvent> {
            let Some(root) = logs_root() else {
                return Vec::new();
            };
            let Some(path) = newest_log(&root) else {
                return Vec::new();
            };
            let initial_read = self.path.as_ref() != Some(&path);
            if initial_read {
                self.path = Some(path.clone());
                self.offset = fs::metadata(&path)
                    .map(|metadata| metadata.len().saturating_sub(512 * 1024))
                    .unwrap_or(0);
            }
            let Ok(mut file) = File::open(path) else {
                return Vec::new();
            };
            if file.seek(SeekFrom::Start(self.offset)).is_err() {
                return Vec::new();
            }
            let mut reader = BufReader::new(file);
            if self.offset > 0 {
                let mut partial = String::new();
                let _ = reader.read_line(&mut partial);
            }
            let mut events = Vec::new();
            let mut line = String::new();
            while reader.read_line(&mut line).unwrap_or(0) > 0 {
                if let Some(event) = activity_event(&line) {
                    events.push(event);
                }
                line.clear();
            }
            if let Ok(offset) = reader.stream_position() {
                self.offset = offset;
            }
            if initial_read {
                events.pop().into_iter().collect()
            } else {
                events
            }
        }
    }

    fn overlay_label(hwnd: isize) -> String {
        format!("token-overlay-{:x}", hwnd as usize)
    }

    fn ensure_overlay(app: &AppHandle, target: CodexWindow) {
        let label = overlay_label(target.hwnd);
        if app.get_webview_window(&label).is_some() {
            return;
        }
        let url = WebviewUrl::App(format!("index.html?token-overlay={}", target.hwnd).into());
        let builder = WebviewWindowBuilder::new(app, &label, url)
            .title("Codex Token Usage")
            .inner_size(OVERLAY_WIDTH, OVERLAY_HEIGHT)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .visible(false);
        let builder = unsafe { builder.owner_raw(std::mem::transmute(target.hwnd)) };
        if let Ok(window) = builder.build() {
            let _ = window.set_ignore_cursor_events(true);
        }
    }

    fn place_overlay(app: &AppHandle, target: CodexWindow, codex_app_active: bool) {
        let Some(overlay) = app.get_webview_window(&overlay_label(target.hwnd)) else {
            return;
        };
        let scale = overlay.scale_factor().unwrap_or(1.0);
        let target_width = (target.rect.right - target.rect.left) as f64 / scale;
        let visible = codex_app_active && !target.minimized && target_width >= MIN_CODEX_WIDTH;
        if !visible {
            let _ = overlay.hide();
            return;
        }
        let width = (OVERLAY_WIDTH * scale).round() as u32;
        let height = (OVERLAY_HEIGHT * scale).round() as u32;
        let x = target.rect.right - width as i32 - (RIGHT_INSET * scale).round() as i32;
        let y = target.rect.top + (TOP_INSET * scale).round() as i32;
        let _ = overlay.set_size(PhysicalSize::new(width, height));
        let _ = overlay.set_position(PhysicalPosition::new(x, y));
        if !overlay.is_visible().unwrap_or(false) {
            let _ = overlay.show();
        }
    }

    fn publish_usage(
        app: &AppHandle,
        cache: &Mutex<token_usage::TokenUsageCache>,
        hwnd: isize,
        conversation_id: Option<&str>,
    ) -> ConversationTokenUsage {
        let payload = token_usage::scan_conversation(cache, conversation_id);
        let _ = app.emit_to(
            overlay_label(hwnd),
            "conversation-token-usage",
            payload.clone(),
        );
        payload
    }

    pub fn start(app: AppHandle, cache: Arc<Mutex<token_usage::TokenUsageCache>>) {
        thread::spawn(move || {
            let mut log_tail = LogTail::default();
            let mut renderer_to_hwnd: HashMap<String, isize> = HashMap::new();
            let mut conversations: HashMap<isize, String> = HashMap::new();
            let mut published: HashMap<isize, ConversationTokenUsage> = HashMap::new();
            let mut missing_ticks: HashMap<isize, u16> = HashMap::new();
            let mut refresh_tick = 0u8;

            loop {
                let windows = enumerate_codex_windows();
                let window_handles: HashSet<isize> =
                    windows.iter().map(|window| window.hwnd).collect();
                let foreground = unsafe { GetForegroundWindow() } as isize;
                let codex_app_active = window_handles.contains(&foreground);

                for event in log_tail.read_events() {
                    if window_handles.contains(&foreground) {
                        renderer_to_hwnd.insert(event.renderer_window_id.clone(), foreground);
                    }
                    if let Some(hwnd) = renderer_to_hwnd.get(&event.renderer_window_id).copied() {
                        conversations.insert(hwnd, event.conversation_id);
                    }
                }

                for target in windows.iter().copied() {
                    missing_ticks.remove(&target.hwnd);
                    ensure_overlay(&app, target);
                    place_overlay(&app, target, codex_app_active);
                }

                for hwnd in published.keys().copied().collect::<Vec<_>>() {
                    if !window_handles.contains(&hwnd) {
                        let ticks = missing_ticks.entry(hwnd).or_default();
                        *ticks = ticks.saturating_add(1);
                        if *ticks < 125 {
                            continue;
                        }
                        if let Some(overlay) = app.get_webview_window(&overlay_label(hwnd)) {
                            let _ = overlay.destroy();
                        }
                        missing_ticks.remove(&hwnd);
                        published.remove(&hwnd);
                        conversations.remove(&hwnd);
                        renderer_to_hwnd.retain(|_, value| *value != hwnd);
                    }
                }

                refresh_tick = refresh_tick.saturating_add(1);
                if refresh_tick >= TOKEN_REFRESH_TICKS {
                    refresh_tick = 0;
                    for hwnd in window_handles.iter().copied() {
                        let next = publish_usage(
                            &app,
                            &cache,
                            hwnd,
                            conversations.get(&hwnd).map(String::as_str),
                        );
                        published.insert(hwnd, next);
                    }
                }
                thread::sleep(POLL_INTERVAL);
            }
        });
    }
}

#[cfg(windows)]
pub use windows_impl::start;

#[cfg(not(windows))]
pub fn start(
    _app: tauri::AppHandle,
    _cache: std::sync::Arc<std::sync::Mutex<crate::token_usage::TokenUsageCache>>,
) {
}
