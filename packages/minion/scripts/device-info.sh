#!/bin/bash
# Collects device specs and outputs JSON for hive registration

HOSTNAME=$(hostname)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
KERNEL=$(uname -r)

# OS details
if [ -f /etc/os-release ]; then
  OS_NAME=$(grep ^PRETTY_NAME /etc/os-release | cut -d'"' -f2)
else
  OS_NAME=$(uname -s)
fi

# CPU
CPU_CORES=$(nproc)
CPU_MODEL=$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs)
if [ -z "$CPU_MODEL" ]; then
  CPU_MODEL=$(grep -m1 'Hardware' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs)
fi

# Pi-specific
PI_MODEL=$(cat /proc/device-tree/model 2>/dev/null | tr -d '\0')
PI_SERIAL=$(grep -m1 'Serial' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs)
PI_REVISION=$(grep -m1 'Revision' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs)

# Memory
MEM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
MEM_AVAILABLE=$(free -m | awk '/Mem:/ {print $7}')

# Storage
DISK_TOTAL=$(df -BG / | awk 'NR==2 {gsub("G",""); print $2}')
DISK_USED=$(df -BG / | awk 'NR==2 {gsub("G",""); print $3}')
DISK_FREE=$(df -BG / | awk 'NR==2 {gsub("G",""); print $4}')

# Network
IP_ADDR=$(ip -4 addr show | grep -v '127.0.0.1' | grep 'inet ' | head -1 | awk '{print $2}' | cut -d/ -f1)
IFACE=$(ip -4 addr show | grep -v '127.0.0.1' | grep 'inet ' | head -1 | awk '{print $NF}')
MAC_ADDR=$(ip link show "$IFACE" 2>/dev/null | grep ether | awk '{print $2}')

# Software
NODE_VER=$(node --version 2>/dev/null || echo "not installed")
PYTHON_VER=$(python3 --version 2>/dev/null | awk '{print $2}' || echo "not installed")
DOCKER_VER=$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',' || echo "not installed")

# Uptime
UPTIME_SECS=$(cat /proc/uptime | awk '{print int($1)}')

# Hardware fingerprint — unique identity that survives network/location changes
# Priority: Pi serial > DMI UUID > machine-id, combined with MAC
HWID_PARTS=""
if [ -n "$PI_SERIAL" ]; then
  HWID_PARTS="${PI_SERIAL}"
fi
DMI_UUID=$(cat /sys/class/dmi/id/product_uuid 2>/dev/null)
if [ -n "$DMI_UUID" ]; then
  HWID_PARTS="${HWID_PARTS}${DMI_UUID}"
fi
MACHINE_ID=$(cat /etc/machine-id 2>/dev/null)
if [ -n "$MACHINE_ID" ]; then
  HWID_PARTS="${HWID_PARTS}${MACHINE_ID}"
fi
HWID_PARTS="${HWID_PARTS}${MAC_ADDR}"
HARDWARE_ID=$(echo -n "$HWID_PARTS" | sha256sum | awk '{print $1}')

cat <<EOF
{
  "hardwareId": "$HARDWARE_ID",
  "hostname": "$HOSTNAME",
  "platform": "$OS",
  "arch": "$ARCH",
  "kernel": "$KERNEL",
  "os": "$OS_NAME",
  "cpu": {
    "model": "$CPU_MODEL",
    "cores": $CPU_CORES
  },
  "pi": {
    "model": "$PI_MODEL",
    "serial": "$PI_SERIAL",
    "revision": "$PI_REVISION"
  },
  "memory": {
    "totalMb": $MEM_TOTAL,
    "availableMb": $MEM_AVAILABLE
  },
  "storage": {
    "totalGb": $DISK_TOTAL,
    "usedGb": $DISK_USED,
    "freeGb": $DISK_FREE
  },
  "network": {
    "ip": "$IP_ADDR",
    "interface": "$IFACE",
    "mac": "$MAC_ADDR"
  },
  "software": {
    "node": "$NODE_VER",
    "python": "$PYTHON_VER",
    "docker": "$DOCKER_VER"
  },
  "uptimeSeconds": $UPTIME_SECS
}
EOF
