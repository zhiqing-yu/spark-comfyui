# Spark ComfyUI Desktop (Linux ARM64)

An independent, standalone desktop client for ComfyUI on NVIDIA Spark / DGX GH200 / Linux ARM64 systems.

## Features

- **Native App Experience**: Clean standalone window without browser address bars, tabs, or devtools clutter.
- **Independent Window Identity**: Dedicated window class (`spark-comfyui`) with official ComfyUI branding, completely separated from Chrome or other browsers.
- **Ultra-Smooth 4K Node Dragging**: Solves the severe Linux Electron 4K canvas dragging lag by leveraging LiteGraph's native single-canvas architecture (eliminating ~28.5MB per-frame offscreen double-buffer CPU blitting) and dynamic drag-time shadow bypassing.
- **Safe Lifecycle Control**: Integrated splash screen and non-blocking exit confirmation with secondary-click force exit protection.
- **Zero Backend Intrusion**: Seamlessly wraps existing `spark-comfyui` Docker containers without altering SageAttention, bf16 precision, or model environments.

## Quick Start

### Installation

Run the one-step installer:

```bash
cd desktop
./install.sh
```

### Launching

You can launch the app via any of the following:

- Double-click the **Spark ComfyUI** icon on your Desktop.
- Search for **Spark ComfyUI** in your system application menu.
- Run `spark-comfyui-app` in the terminal.
