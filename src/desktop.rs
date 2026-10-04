//! Installs the Claude Code desktop HUD plugin (sources under `desktop/`).
//!
//! The plugin files are embedded at build time, written to
//! `~/.claude/claude-hud/desktop/`, and that folder is added to
//! `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` so every new
//! desktop session loads it.

use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

const ENV_KEY: &str = "CLAUDE_CODE_PLUGIN_DIRS";

/// (path relative to the plugin root, contents)
const FILES: &[(&str, &str)] = &[
    (
        ".claude-plugin/plugin.json",
        include_str!("../desktop/.claude-plugin/plugin.json"),
    ),
    (
        "hooks/hooks.json",
        include_str!("../desktop/hooks/hooks.json"),
    ),
    (
        "hooks/register.tsx",
        include_str!("../desktop/hooks/register.tsx"),
    ),
    (
        "hooks/format.ts",
        include_str!("../desktop/hooks/format.ts"),
    ),
    ("hooks/icons.ts", include_str!("../desktop/hooks/icons.ts")),
    (
        "types/index.d.ts",
        include_str!("../desktop/types/index.d.ts"),
    ),
];

/// Adds `dir` to `env.CLAUDE_CODE_PLUGIN_DIRS` (a `:`-separated list), keeping
/// every other entry. Returns whether anything changed.
pub fn add_plugin_dir(settings: &mut Value, dir: &str) -> bool {
    if !settings.is_object() {
        *settings = json!({});
    }
    let env = settings
        .as_object_mut()
        .unwrap()
        .entry("env")
        .or_insert_with(|| json!({}));
    if !env.is_object() {
        *env = json!({});
    }
    let env = env.as_object_mut().unwrap();
    let current = env.get(ENV_KEY).and_then(Value::as_str).unwrap_or("");
    if current.split(':').any(|d| d == dir) {
        return false;
    }
    let next = if current.is_empty() {
        dir.to_string()
    } else {
        format!("{current}:{dir}")
    };
    env.insert(ENV_KEY.to_string(), Value::String(next));
    true
}

fn write_plugin(root: &Path) -> std::io::Result<()> {
    for (rel, body) in FILES {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, body)?;
    }
    Ok(())
}

/// Writes the plugin and registers it in `~/.claude/settings.json`.
/// Returns the plugin folder.
pub fn install() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let claude = dirs::home_dir()
        .ok_or("cannot find home directory")?
        .join(".claude");
    let root = claude.join("claude-hud").join("desktop");
    write_plugin(&root)?;

    let settings_path = claude.join("settings.json");
    let mut settings: Value = match fs::read_to_string(&settings_path) {
        Ok(text) => serde_json::from_str(&text)
            .map_err(|e| format!("{} is not valid JSON: {e}", settings_path.display()))?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => json!({}),
        Err(e) => return Err(e.into()),
    };
    if add_plugin_dir(&mut settings, &root.to_string_lossy()) {
        if settings_path.exists() {
            fs::copy(&settings_path, claude.join("settings.json.bak.claude-hud"))?;
        }
        fs::write(
            &settings_path,
            serde_json::to_string_pretty(&settings)? + "\n",
        )?;
    }
    Ok(root)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_plugin_dir_appends_once_and_keeps_others() {
        let mut s = json!({ "model": "opus", "env": { "A": "1", ENV_KEY: "/x" } });
        assert!(add_plugin_dir(&mut s, "/hud"));
        assert_eq!(s["env"][ENV_KEY], "/x:/hud");
        assert_eq!(s["env"]["A"], "1");
        assert!(!add_plugin_dir(&mut s, "/hud"));
        assert_eq!(s["env"][ENV_KEY], "/x:/hud");

        let mut empty = json!({});
        assert!(add_plugin_dir(&mut empty, "/hud"));
        assert_eq!(empty["env"][ENV_KEY], "/hud");
    }

    #[test]
    fn write_plugin_writes_every_file() {
        let root = std::env::temp_dir().join(format!("claude-hud-desktop-{}", std::process::id()));
        write_plugin(&root).unwrap();
        for (rel, body) in FILES {
            assert_eq!(fs::read_to_string(root.join(rel)).unwrap(), *body);
        }
        fs::remove_dir_all(root).unwrap();
    }
}
