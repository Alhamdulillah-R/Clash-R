fn main() {
    // 让 icon 文件变化触发 cargo 重新运行 build script + 重新嵌入 Windows 资源
    // 否则 dev 模式下 icon.ico 替换后 exe 不会重 link，任务栏图标不更新
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/icon.png");
    println!("cargo:rerun-if-changed=icons/icon.icns");

    #[cfg(feature = "clippy")]
    {
        println!("cargo:warning=Skipping tauri_build during Clippy");
    }

    #[cfg(not(feature = "clippy"))]
    tauri_build::build();
}
