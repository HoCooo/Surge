#!/bin/bash

# 检查是否以 root 用户运行
if [[ $EUID -ne 0 ]]; then
    echo "This script must be run as root. Use 'sudo' to execute."
    exit 1
fi

# ====================
# 依赖检查和安装
# ====================
echo "Checking and installing required dependencies..."

REQUIRED_PACKAGES=(git python3-pip python3-venv imagemagick libwebp-dev neofetch libzbar-dev libxml2-dev libxslt-dev tesseract-ocr tesseract-ocr-all wget unzip bc)
MISSING_PACKAGES=()

# 检查缺失的依赖
for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if ! dpkg -l | grep -q "^ii  $pkg"; then
        MISSING_PACKAGES+=("$pkg")
    fi
done

# 安装缺失的依赖
if [ "${#MISSING_PACKAGES[@]}" -ne 0 ]; then
    echo "The following packages are missing: ${MISSING_PACKAGES[*]}"
    echo "Installing missing packages..."
    apt update && apt upgrade -y
    apt install -y "${MISSING_PACKAGES[@]}"
else
    echo "All required dependencies are already installed."
fi

# ====================
# 设置 Swap 文件
# ====================
create_swap() {
    SWAPFILE="/swapfile"
    SWAPSIZE_MB=1024  # 1GB

    echo "Creating 1GB Swap file..."

    # 检查是否已存在 Swap 文件
    if swapon --show | grep -q "$SWAPFILE"; then
        echo "Swap file already exists and is active."
    else
        # 删除可能存在的旧 Swap 文件
        if [[ -f "$SWAPFILE" ]]; then
            echo "Removing existing swap file..."
            rm -f "$SWAPFILE"
        fi

        # 创建新的 Swap 文件
        echo "Creating swap file at $SWAPFILE..."
        fallocate -l ${SWAPSIZE_MB}M $SWAPFILE
        chmod 600 $SWAPFILE
        mkswap $SWAPFILE
        swapon $SWAPFILE

        # 将 Swap 持久化到 /etc/fstab
        if ! grep -q "$SWAPFILE" /etc/fstab; then
            echo "$SWAPFILE none swap sw 0 0" >> /etc/fstab
        fi

        echo "Swap file created and enabled successfully."
    fi

    # 输出当前 Swap 信息
    swapon --show
}

create_swap

# ====================
# 安装和配置 Snell
# ====================
install_snell() {
    echo "Installing and configuring Snell..."

    SNELL_VERSION="v4.1.1"
    SNELL_URL="https://dl.nssurge.com/snell/snell-server-${SNELL_VERSION}-linux-amd64.zip"
    SNELL_ZIP="/tmp/snell-server.zip"
    SNELL_BIN="/usr/local/bin/snell-server"

    # 下载 Snell 文件
    echo "Downloading Snell..."
    wget -O $SNELL_ZIP $SNELL_URL

    # 解压文件到 /usr/local/bin
    echo "Unzipping Snell..."
    unzip -o $SNELL_ZIP -d /usr/local/bin
    chmod +x $SNELL_BIN

    # 创建配置文件夹
    echo "Creating configuration directory..."
    mkdir -p /etc/snell

    # 使用 --wizard 自动生成配置
    echo "Generating Snell configuration..."
    $SNELL_BIN --wizard -c /etc/snell/snell-server.conf

    # 配置 Systemd 服务
    SERVICE_FILE="/lib/systemd/system/snell.service"
    echo "Creating Systemd service..."
    cat <<EOF > $SERVICE_FILE
[Unit]
Description=Snell Proxy Service
After=network.target

[Service]
Type=simple
User=nobody
Group=nogroup
LimitNOFILE=32768
ExecStart=/usr/local/bin/snell-server -c /etc/snell/snell-server.conf
AmbientCapabilities=CAP_NET_BIND_SERVICE
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=snell-server
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    # 重载服务配置
    echo "Reloading Systemd..."
    systemctl daemon-reload

    # 设置开机自启并启动服务
    echo "Enabling and starting Snell service..."
    systemctl enable snell
    systemctl start snell

    # 检查服务状态
    echo "Snell service status:"
    systemctl status snell --no-pager

    echo "Snell setup complete!"
}

install_snell

# ====================
# 安装和配置 PagerMaid-Pyro
# ====================
install_pagermail() {
    echo "Installing and configuring PagerMaid-Pyro..."

    # 拉取项目
    echo "Cloning PagerMaid-Pyro repository..."
    cd /var/lib
    git clone https://github.com/TeamPGM/PagerMaid-Pyro.git PagerMaid-Pyro
    cd PagerMaid-Pyro

    # 设置虚拟环境
    echo "Setting up Python virtual environment..."
    python3 -m venv venv
    source venv/bin/activate

    # 更新 pip
    echo "Upgrading pip..."
    python3 -m pip install --upgrade pip

    # 安装依赖
    echo "Installing Python dependencies..."
    pip3 install -r requirements.txt

    # 配置 PagerMaid
    echo "Generating config.yml from config.gen.yml..."
    cp config.gen.yml config.yml

    echo "Please edit '/var/lib/PagerMaid-Pyro/config.yml' to configure PagerMaid-Pyro!"
    echo "After configuration, run the following commands to start PagerMaid-Pyro:"
    echo "1. source venv/bin/activate"
    echo "2. python3 -m pagermaid"

    # 配置 Systemd 服务
    SERVICE_FILE="/etc/systemd/system/PagerMaid-Pyro.service"
    echo "Creating PagerMaid-Pyro Systemd service..."
    cat <<EOF > $SERVICE_FILE
[Unit]
Description=PagerMaid-Pyro telegram utility daemon
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/lib/PagerMaid-Pyro
ExecStart=/var/lib/PagerMaid-Pyro/venv/bin/python3 -m pagermaid
Restart=always
MemoryAccounting=yes
MemoryMax=200M
MemoryHigh=150M
MemorySwapMax=100M

[Install]
WantedBy=multi-user.target
EOF

    # 重载服务配置
    echo "Reloading Systemd..."
    systemctl daemon-reload

    echo "PagerMaid-Pyro installed. Please edit the configuration file and start the service using:"
    echo "sudo systemctl start PagerMaid-Pyro"
    echo "sudo systemctl enable PagerMaid-Pyro"
}

install_pagermail

echo "Script execution completed."
