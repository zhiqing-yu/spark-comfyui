#!/usr/bin/env bash
# Install the Spark ComfyUI Desktop application for the current user.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DESKTOP_DIR="$ROOT/desktop/electron"
ICON_SRC="$DESKTOP_DIR/assets/comfyui.png"
LAUNCH_SCRIPT="$DESKTOP_DIR/launch.sh"

echo "[1/4] Ensuring Node.js dependencies are installed..."
if [[ ! -d "$DESKTOP_DIR/node_modules/electron" ]]; then
  (cd "$DESKTOP_DIR" && npm install)
fi

echo "[2/4] Installing application icons..."
mkdir -p "$HOME/.local/share/icons/hicolor/512x512/apps" "$HOME/.local/share/icons"
cp "$ICON_SRC" "$HOME/.local/share/icons/hicolor/512x512/apps/spark-comfyui.png"
cp "$ICON_SRC" "$HOME/.local/share/icons/spark-comfyui.png"
gtk-update-icon-cache -f "$HOME/.local/share/icons/hicolor/" 2>/dev/null || true

echo "[3/4] Installing command launcher to ~/.local/bin/spark-comfyui-app..."
mkdir -p "$HOME/.local/bin"
cat <<EOF > "$HOME/.local/bin/spark-comfyui-app"
#!/usr/bin/env bash
set -euo pipefail
exec "$LAUNCH_SCRIPT" "\$@"
EOF
chmod +x "$HOME/.local/bin/spark-comfyui-app"

echo "[4/4] Installing .desktop shortcuts..."
mkdir -p "$HOME/.local/share/applications"
DESKTOP_ENTRY="[Desktop Entry]
Type=Application
Name=Spark ComfyUI
Name[zh_CN]=Spark ComfyUI
Comment=Start ComfyUI on DGX Spark with smooth desktop experience
Comment[zh_CN]=启动独立 ComfyUI 桌面端（原生 4K 流畅拖拽优化）
Exec=$LAUNCH_SCRIPT
Icon=spark-comfyui
Terminal=false
Categories=Graphics;
StartupNotify=true
StartupWMClass=spark-comfyui"

echo "$DESKTOP_ENTRY" > "$HOME/.local/share/applications/spark-comfyui.desktop"
chmod +x "$HOME/.local/share/applications/spark-comfyui.desktop"
update-desktop-database "$HOME/.local/share/applications/" 2>/dev/null || true

if [[ -d "$HOME/Desktop" ]]; then
  echo "$DESKTOP_ENTRY" > "$HOME/Desktop/spark-comfyui.desktop"
  chmod +x "$HOME/Desktop/spark-comfyui.desktop"
  gio set "$HOME/Desktop/spark-comfyui.desktop" metadata::trusted true 2>/dev/null || true
fi

echo "Done! You can now launch Spark ComfyUI from your desktop, application menu, or run 'spark-comfyui-app'."
