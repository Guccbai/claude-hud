use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "claude-hud")]
#[command(version, about = "High-performance Claude Code StatusLine")]
pub struct Cli {
    /// Enter TUI configuration mode
    #[arg(short = 'c', long = "config")]
    pub config: bool,

    /// Set theme
    #[arg(short = 't', long = "theme")]
    pub theme: Option<String>,

    /// Patch Claude Code cli.js to disable context warnings
    #[arg(long = "patch")]
    pub patch: Option<String>,

    /// Install the desktop HUD plugin and register it in ~/.claude/settings.json
    #[arg(long = "install-desktop")]
    pub install_desktop: bool,
}

impl Cli {
    pub fn parse_args() -> Self {
        Self::parse()
    }
}
