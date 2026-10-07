use crate::config::{
    AnsiColor, ColorConfig, IconConfig, SegmentConfig, SegmentId, TextStyleConfig,
};
use std::collections::HashMap;

pub fn model_segment() -> SegmentConfig {
    SegmentConfig {
        id: SegmentId::Model,
        enabled: true,
        icon: IconConfig {
            plain: "".to_string(),
            nerd_font: "".to_string(),
        },
        colors: ColorConfig {
            icon: Some(AnsiColor::Color256 { c256: 245 }), // dim gray (muted label)
            text: Some(AnsiColor::Color256 { c256: 110 }), // soft steel blue (brand anchor)
            background: None,
        },
        styles: TextStyleConfig::default(),
        options: HashMap::new(),
    }
}

pub fn directory_segment() -> SegmentConfig {
    SegmentConfig {
        id: SegmentId::Directory,
        enabled: true,
        icon: IconConfig {
            plain: "📁".to_string(),
            nerd_font: "\u{f024b}".to_string(),
        },
        colors: ColorConfig {
            icon: Some(AnsiColor::Color256 { c256: 245 }), // dim gray (muted label)
            text: Some(AnsiColor::Color256 { c256: 252 }), // neutral light
            background: None,
        },
        styles: TextStyleConfig::default(),
        options: HashMap::new(),
    }
}

pub fn git_segment() -> SegmentConfig {
    SegmentConfig {
        id: SegmentId::Git,
        enabled: true,
        icon: IconConfig {
            plain: "🌿".to_string(),
            nerd_font: "\u{f02a2}".to_string(),
        },
        colors: ColorConfig {
            icon: Some(AnsiColor::Color256 { c256: 245 }), // dim gray (muted label)
            text: Some(AnsiColor::Color256 { c256: 109 }), // soft teal
            background: None,
        },
        styles: TextStyleConfig::default(),
        options: {
            let mut opts = HashMap::new();
            opts.insert("show_sha".to_string(), serde_json::Value::Bool(false));
            opts
        },
    }
}

pub fn context_window_segment() -> SegmentConfig {
    SegmentConfig {
        id: SegmentId::ContextWindow,
        enabled: true,
        icon: IconConfig {
            plain: "⚡️".to_string(),
            nerd_font: "\u{f49b}".to_string(),
        },
        colors: ColorConfig {
            icon: Some(AnsiColor::Color256 { c256: 245 }), // dim gray (muted label)
            text: Some(AnsiColor::Color256 { c256: 252 }), // neutral light (threshold color overrides)
            background: None,
        },
        styles: TextStyleConfig::default(),
        options: HashMap::new(),
    }
}

pub fn usage_segment() -> SegmentConfig {
    SegmentConfig {
        id: SegmentId::Usage,
        enabled: true,
        icon: IconConfig {
            plain: "📊".to_string(),
            nerd_font: "\u{f029a}".to_string(),
        },
        colors: ColorConfig {
            icon: Some(AnsiColor::Color256 { c256: 245 }), // dim gray (muted label)
            text: Some(AnsiColor::Color256 { c256: 252 }), // neutral light (windows embed own colors)
            background: None,
        },
        styles: TextStyleConfig::default(),
        options: {
            let mut opts = HashMap::new();
            opts.insert(
                "api_base_url".to_string(),
                serde_json::Value::String("https://api.anthropic.com".to_string()),
            );
            opts.insert(
                "cache_duration".to_string(),
                serde_json::Value::Number(180.into()),
            );
            opts.insert("timeout".to_string(), serde_json::Value::Number(2.into()));
            opts
        },
    }
}

pub fn cost_segment() -> SegmentConfig {
    SegmentConfig {
        id: SegmentId::Cost,
        enabled: true,
        icon: IconConfig {
            plain: "💰".to_string(),
            nerd_font: "\u{eec1}".to_string(),
        },
        colors: ColorConfig {
            icon: Some(AnsiColor::Color256 { c256: 245 }), // dim gray (muted label)
            text: Some(AnsiColor::Color256 { c256: 180 }), // soft tan (money)
            background: None,
        },
        styles: TextStyleConfig::default(),
        options: HashMap::new(),
    }
}

pub fn session_segment() -> SegmentConfig {
    SegmentConfig {
        id: SegmentId::Session,
        enabled: false,
        icon: IconConfig {
            plain: "⏱️".to_string(),
            nerd_font: "\u{f19bb}".to_string(),
        },
        colors: ColorConfig {
            icon: Some(AnsiColor::Color16 { c16: 2 }), // Green
            text: Some(AnsiColor::Color16 { c16: 2 }),
            background: None,
        },
        styles: TextStyleConfig::default(),
        options: HashMap::new(),
    }
}

pub fn output_style_segment() -> SegmentConfig {
    SegmentConfig {
        id: SegmentId::OutputStyle,
        enabled: false,
        icon: IconConfig {
            plain: "🎯".to_string(),
            nerd_font: "\u{f12f5}".to_string(),
        },
        colors: ColorConfig {
            icon: Some(AnsiColor::Color16 { c16: 6 }), // Cyan
            text: Some(AnsiColor::Color16 { c16: 6 }),
            background: None,
        },
        styles: TextStyleConfig::default(),
        options: HashMap::new(),
    }
}
