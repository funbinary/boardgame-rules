#!/usr/bin/env bash
# rules-api 服务器一次性引导脚本（root 执行）。
# 服务器：Ubuntu 24.04 x86_64，nginx 1.24（/etc/nginx/conf.d/rule.conf 托管 zhibinai.cn）
# 幂等：重复执行安全。日常发版不需要本脚本（deploy.yml 会自动更新二进制并重启）。
set -euo pipefail

echo ">> 创建目录"
mkdir -p /opt/rules-api/data

echo ">> 安装 systemd 单元"
if [ ! -f /opt/rules-api/rules-api.service ]; then
  echo "!! 请先把 server/deploy/rules-api.service 上传到 /opt/rules-api/" >&2
  exit 1
fi
cp /opt/rules-api/rules-api.service /etc/systemd/system/rules-api.service
systemctl daemon-reload
systemctl enable rules-api

echo ">> 配置 nginx /api/ 反代（幂等）"
CONF=/etc/nginx/conf.d/rule.conf
if grep -q "location /api/" "$CONF"; then
  if grep -q "proxy_set_header Upgrade" "$CONF"; then
    echo "   /api/ location 已含 WebSocket 头，跳过"
  else
    echo "   /api/ location 存在但缺 WebSocket 头，补丁中"
    cp "$CONF" "$CONF.bak.$(date +%s)"
    python3 - "$CONF" << 'PYEOF'
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    content = f.read()

old = """        proxy_set_header X-Forwarded-Proto $scheme;
    }
"""
new = """        proxy_set_header X-Forwarded-Proto $scheme;
        # WebSocket(联机对战 /api/play/ws)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
"""
if old not in content:
    print("!! 未找到反代配置锚点，请手工检查", file=sys.stderr)
    sys.exit(1)
with open(path, "w", encoding="utf-8") as f:
    f.write(content.replace(old, new, 1))
print("已补 WebSocket 头", path)
PYEOF
    nginx -t
    systemctl reload nginx
  fi
else
  cp "$CONF" "$CONF.bak.$(date +%s)"
  python3 - "$CONF" << 'PYEOF'
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    content = f.read()

anchor = "        try_files $uri $uri/ =404;\n    }\n"
snippet = anchor + """
    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # WebSocket(联机对战 /api/play/ws)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
"""
if anchor not in content:
    print("!! 未找到 location / 锚点，请手工检查", file=sys.stderr)
    sys.exit(1)
with open(path, "w", encoding="utf-8") as f:
    f.write(content.replace(anchor, snippet, 1))
print("已更新", path)
PYEOF
  nginx -t
  systemctl reload nginx
fi

echo ">> 启动服务"
systemctl restart rules-api
sleep 2
systemctl --no-pager --lines 3 status rules-api || true
curl -s http://127.0.0.1:8787/api/health && echo " <- 本机健康检查 OK"
echo ">> 引导完成"
