#!/bin/bash
set -e

# Update system
apt-get update
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Mount the data disk
DATA_DISK="/dev/sdb"
MOUNT_POINT="/data"

# Check if disk is already formatted
if ! blkid $DATA_DISK | grep -q ext4; then
    echo "Formatting data disk..."
    mkfs.ext4 -F $DATA_DISK
fi

mkdir -p $MOUNT_POINT
mount $DATA_DISK $MOUNT_POINT

# Add to fstab if not already there
if ! grep -q "$MOUNT_POINT" /etc/fstab; then
    echo "$DATA_DISK $MOUNT_POINT ext4 defaults,nofail 0 2" >> /etc/fstab
fi

# Create ClickHouse data directories
mkdir -p $MOUNT_POINT/clickhouse
chown -R root:root $MOUNT_POINT/clickhouse

# Install ClickHouse
curl -fsSL https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml.key | gpg --dearmor -o /usr/share/keyrings/clickhouse-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/clickhouse-keyring.gpg] https://packages.clickhouse.com/deb stable main" > /etc/apt/sources.list.d/clickhouse.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y clickhouse-server clickhouse-client

# Configure ClickHouse to use our data disk
cat > /etc/clickhouse-server/config.d/data-paths.xml << 'EOF'
<clickhouse>
    <path>/data/clickhouse/</path>
    <tmp_path>/data/clickhouse/tmp/</tmp_path>
    <user_files_path>/data/clickhouse/user_files/</user_files_path>
    <format_schema_path>/data/clickhouse/format_schemas/</format_schema_path>
</clickhouse>
EOF

# Allow connections from anywhere (for internal VPC access)
cat > /etc/clickhouse-server/config.d/listen.xml << 'EOF'
<clickhouse>
    <listen_host>0.0.0.0</listen_host>
</clickhouse>
EOF

# Set ownership
chown -R clickhouse:clickhouse $MOUNT_POINT/clickhouse

# Start ClickHouse
systemctl enable clickhouse-server
systemctl start clickhouse-server

# Install gsutil for data loading
curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts
ln -sf /root/google-cloud-sdk/bin/gsutil /usr/local/bin/gsutil
ln -sf /root/google-cloud-sdk/bin/gcloud /usr/local/bin/gcloud

# Create a convenience script for the user
cat > /usr/local/bin/ch << 'EOF'
#!/bin/bash
clickhouse-client "$@"
EOF
chmod +x /usr/local/bin/ch

echo "ClickHouse setup complete!"
