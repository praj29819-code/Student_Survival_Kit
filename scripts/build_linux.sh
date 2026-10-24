#!/usr/bin/env bash
# ============================================================================
# Student Survival Kit (SSK) - Build Script for Linux (Ubuntu / Debian / etc.)
# ============================================================================
set -e

echo "========================================================"
echo "    Building Student Survival Kit on Linux"
echo "========================================================"

# Check and install dependencies if apt is available
if command -v apt-get &> /dev/null; then
    echo "[Info] Debian/Ubuntu detected. Verifying essential build packages..."
    sudo apt-get update -qq || true
    sudo apt-get install -y -qq build-essential cmake libcurl4-openssl-dev libboost-all-dev libasio-dev || true
fi

# Create build directory
mkdir -p build
cd build

echo "[1/3] Configuring CMake project..."
cmake .. -DCMAKE_BUILD_TYPE=Release

echo "[2/3] Compiling student_survival_kit..."
cmake --build . -j$(nproc)

echo "[3/3] Build finished successfully!"
echo "Run the server with:"
echo "  export ANTHROPIC_API_KEY=\"your_key_here\"  # optional"
echo "  ./student_survival_kit"
