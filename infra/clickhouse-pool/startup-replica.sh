#!/bin/bash
set -e

# Replica startup: the data disk is already formatted and populated from the snapshot.
# We just mount it and start ClickHouse.

DATA_DISK="/dev/sdb"
MOUNT_POINT="/data"

# Mount the data disk (already has ext4 from the snapshot)
mkdir -p $MOUNT_POINT
mount $DATA_DISK $MOUNT_POINT

if ! grep -q "$MOUNT_POINT" /etc/fstab; then
    echo "$DATA_DISK $MOUNT_POINT ext4 defaults,nofail 0 2" >> /etc/fstab
fi

# Install ClickHouse
apt-get update
apt-get install -y apt-transport-https ca-certificates curl gnupg
curl -fsSL https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml.key | gpg --dearmor -o /usr/share/keyrings/clickhouse-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/clickhouse-keyring.gpg] https://packages.clickhouse.com/deb stable main" > /etc/apt/sources.list.d/clickhouse.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y clickhouse-server clickhouse-client

# Configure ClickHouse to use the data disk
cat > /etc/clickhouse-server/config.d/data-paths.xml << 'EOF'
<clickhouse>
    <path>/data/clickhouse/</path>
    <tmp_path>/data/clickhouse/tmp/</tmp_path>
    <user_files_path>/data/clickhouse/user_files/</user_files_path>
    <format_schema_path>/data/clickhouse/format_schemas/</format_schema_path>
</clickhouse>
EOF

# Listen on all interfaces (for internal VPC load balancer)
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
