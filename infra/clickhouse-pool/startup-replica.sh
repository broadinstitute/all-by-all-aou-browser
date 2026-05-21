#!/bin/bash
set -e

# Replica startup: boot image has ClickHouse pre-installed,
# data disk is pre-populated from snapshot. Just mount and start.

MOUNT_POINT="/data"

# Find the data disk — it's the large unpartitioned disk (not the boot disk)
DATA_DISK=$(lsblk -dnbo NAME,SIZE,TYPE | awk '$3=="disk"' | sort -k2 -nr | head -1 | awk '{print "/dev/"$1}')
echo "Detected data disk: $DATA_DISK"

# Mount the data disk (already formatted from snapshot)
mkdir -p $MOUNT_POINT
mount $DATA_DISK $MOUNT_POINT

if ! grep -q "$MOUNT_POINT" /etc/fstab; then
    echo "$DATA_DISK $MOUNT_POINT ext4 defaults,nofail 0 2" >> /etc/fstab
fi

# Ensure ClickHouse config points to data disk
cat > /etc/clickhouse-server/config.d/data-paths.xml << 'EOF'
<clickhouse>
    <path>/data/clickhouse/</path>
    <tmp_path>/data/clickhouse/tmp/</tmp_path>
    <user_files_path>/data/clickhouse/user_files/</user_files_path>
    <format_schema_path>/data/clickhouse/format_schemas/</format_schema_path>
</clickhouse>
EOF

cat > /etc/clickhouse-server/config.d/listen.xml << 'EOF'
<clickhouse>
    <listen_host>0.0.0.0</listen_host>
</clickhouse>
EOF

# Read-only mode: prevent accidental writes to replicas
cat > /etc/clickhouse-server/users.d/readonly.xml << 'EOF'
<clickhouse>
    <profiles>
        <default>
            <readonly>1</readonly>
        </default>
    </profiles>
</clickhouse>
EOF

chown -R clickhouse:clickhouse $MOUNT_POINT/clickhouse

systemctl enable clickhouse-server
systemctl start clickhouse-server

echo "ClickHouse replica ready!"
