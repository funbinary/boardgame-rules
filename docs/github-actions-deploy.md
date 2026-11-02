# GitHub Actions 自动部署配置（可移植文档）

本仓库的自动部署由一个文件驱动：[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)。
本文档把它整理成**可直接搬到其他项目**的形式：所有与本项目绑定的值都用 `【改】` 标注并使用占位符，附一次性准备步骤、服务器引导脚本和迁移清单。

---

## 一、总览：流水线做了什么

```
push 到 main（或手动触发）
  │
  ├─ 1. 配置 SSH ─── 私钥来自 GitHub Secrets；ssh-keyscan 后与固定指纹比对（防劫持）
  ├─ 2. 交叉编译 ─── Go 静态编译出 linux/amd64 二进制（CGO_ENABLED=0，无运行时依赖）
  ├─ 3. 同步静态站 ─ rsync --delete 增量推到服务器 webroot（无 rsync 则 tar 全量兜底）
  ├─ 4. 发布后端 ─── scp 成 .new → 原子 mv 替换 → 幂等安装 systemd 单元 → 重启
  └─ 5. 部署后验证 ─ curl 站点要 200 + curl /api/health 要 {"ok":true}，失败则 job 红
```

架构要点：**静态文件由 nginx 直接托管，Go 后端只监听 `127.0.0.1:<端口>`，由 nginx 反代 `/api/`（含 WebSocket 头）**。CI 通过 SSH 直接操作服务器，不借助任何第三方部署平台。

---

## 二、一次性准备

### 1. 生成专用部署密钥（不要复用个人密钥）

在本机执行：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key   # 不设 passphrase
```

- 公钥 `deploy_key.pub` 追加到服务器目标用户的 `~/.ssh/authorized_keys`（本项目用 root）：
  ```bash
  cat deploy_key.pub | ssh root@YOUR_SERVER_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
  ```
- 私钥 `deploy_key` 的**完整内容**（含 `-----BEGIN/END OPENSSH PRIVATE KEY-----` 行）配置到 GitHub 仓库：
  **Settings → Secrets and variables → Actions → New repository secret**
  - Name：`SERVER_SSH_KEY` 【改】仅当你在 workflow 里换用了别的名字
  - Value：私钥全文

### 2. 固定服务器主机指纹

```bash
ssh-keyscan -t ed25519 YOUR_SERVER_IP | ssh-keygen -lf -
# 输出形如：256 SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (ED25519)
```

把 `SHA256:...` 整段记下来，填进 workflow 的 `HOST_KEY_FP`。这一步的意义见「五、设计要点」第 1 条。

### 3. 服务器安装 nginx 与（可选）rsync

```bash
apt update && apt install -y nginx rsync
```

rsync 缺失时 workflow 会自动降级为 tar 全量同步，但 rsync 增量同步快得多，建议安装。

### 4. nginx 反代配置（一次性）

在后端监听 `127.0.0.1:8787`、域名 `your-domain.com` 的前提下，在站点 server 块中加：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8787;          # 【改】后端端口
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # WebSocket 需要（即使当前没有 WS，也建议保留，免得以后补）
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

改完 `nginx -t && systemctl reload nginx` 验证。本项目的完整幂等引导脚本见 [`server/deploy/bootstrap.sh`](../server/deploy/bootstrap.sh)（含目录创建、单元安装、按锚点自动补上述 location），可整体搬走改路径复用。

---

## 三、workflow 文件全文（模板）

保存为 `.github/workflows/deploy.yml`，把所有 `【改】` 处替换为本项目值即可：

```yaml
name: Deploy

on:
  push:
    branches: [main]        # 【改】触发分支
  workflow_dispatch:        # 保留：可在 Actions 页面手动触发

# 同一时间只允许一个部署；新推送会取消进行中的旧部署
concurrency:
  group: deploy-production
  cancel-in-progress: true

env:
  SERVER: root@YOUR_SERVER_IP                    # 【改】SSH 目标（用户@IP）
  # 服务器 ED25519 主机指纹（固定下来，防止 keyscan 被劫持；获取方式见文档第二节.2）
  HOST_KEY_FP: SHA256:YOUR_HOST_KEY_FINGERPRINT  # 【改】

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - name: 配置 SSH
        run: |
          mkdir -p ~/.ssh
          printf '%s\n' "${{ secrets.SERVER_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -t ed25519 YOUR_SERVER_IP > ~/.ssh/known_hosts 2>/dev/null   # 【改】IP
          actual="$(ssh-keygen -lf ~/.ssh/known_hosts | awk '{print $2}')"
          if [ "$actual" != "$HOST_KEY_FP" ]; then
            echo "::error::主机指纹不匹配（期望 $HOST_KEY_FP，实际 $actual）"
            exit 1
          fi

      # ── 以下「交叉编译」步骤是 Go 后端专用；纯静态站项目整段删除 ──
      - name: 交叉编译 YOUR_API（linux/amd64）
        uses: actions/setup-go@v5
        with:
          go-version-file: server/go.mod          # 【改】go.mod 路径
          cache-dependency-path: server/go.sum    # 【改】go.sum 路径
      - run: |
          cd server                                              # 【改】Go 模块目录
          CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
            go build -trimpath -ldflags "-s -w" -o /tmp/your-api ./cmd/your-api   # 【改】产物名与入口包

      - name: 部署静态站到 /var/www/YOUR_SITE
        run: |
          ssh "$SERVER" "mkdir -p /var/www/YOUR_SITE"          # 【改】webroot
          if ssh "$SERVER" "command -v rsync" > /dev/null 2>&1; then
            echo ">> rsync 增量同步（--delete 清除残留）"
            rsync -az --delete \
              --exclude='.git/' \
              --exclude='server/' \
              --stats ./ "$SERVER":/var/www/YOUR_SITE/        # 【改】webroot 与排除项
          else
            echo ">> tar 全量同步（先清空目录）"
            tar --exclude='./.git' --exclude='./server' -czf - . \
              | ssh "$SERVER" "find /var/www/YOUR_SITE -mindepth 1 -delete && tar -xzf - -C /var/www/YOUR_SITE"   # 【改】同上
          fi

      # ── 以下「发布后端」步骤是 Go 后端专用；纯静态站项目整段删除 ──
      - name: 发布 YOUR_API 二进制并重启服务
        run: |
          ssh "$SERVER" "mkdir -p /opt/your-api/data"
          scp -q /tmp/your-api "$SERVER":/opt/your-api/your-api.new
          ssh "$SERVER" "chmod +x /opt/your-api/your-api.new && mv /opt/your-api/your-api.new /opt/your-api/your-api"
          # systemd 单元幂等安装（单元内容内联在这里维护，与代码同版本演进）
          ssh "$SERVER" 'cat > /etc/systemd/system/your-api.service << "UNIT"
          [Unit]
          Description=your-api — 一句话说明        # 【改】
          After=network.target

          [Service]
          Type=simple
          WorkingDirectory=/opt/your-api
          ExecStart=/opt/your-api/your-api
          Environment=ADDR=127.0.0.1:8787          # 【改】监听地址与端口（务必 127.0.0.1）
          Environment=DB_PATH=/opt/your-api/data/your.db    # 【改】按需增删环境变量
          Restart=on-failure
          RestartSec=3
          NoNewPrivileges=true
          ProtectSystem=full
          ReadWritePaths=/opt/your-api/data

          [Install]
          WantedBy=multi-user.target
          UNIT
          systemctl daemon-reload && systemctl enable your-api >/dev/null && systemctl restart your-api'

      - name: 验证站点与 API
        run: |
          sleep 2
          status="$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 https://your-domain.com/)"   # 【改】域名
          echo "站点 HTTP $status"
          [ "$status" = "200" ]
          health="$(curl -s --max-time 20 https://your-domain.com/api/health)"    # 【改】健康检查路径
          echo "API $health"
          echo "$health" | grep -q '"ok":true'    # 【改】按你的 health 返回结构调整断言
```

---

## 四、服务器一次性引导（本项目版，可搬走改路径）

<details>
<summary><code>server/deploy/rules-api.service</code>（与 workflow 内联单元同内容，供 bootstrap 使用）</summary>

```ini
[Unit]
Description=rules-api — 桌游规则书用户与收藏服务
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/rules-api
ExecStart=/opt/rules-api/rules-api
Environment=ADDR=127.0.0.1:8787
Environment=DB_PATH=/opt/rules-api/data/rules.db
Environment=COOKIE_SECURE=1
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/opt/rules-api/data

[Install]
WantedBy=multi-user.target
```

</details>

<details>
<summary><code>server/deploy/bootstrap.sh</code>（root 执行一次；幂等，重复执行安全）</summary>

```bash
#!/usr/bin/env bash
# 服务器一次性引导脚本（root 执行）。
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
# ……完整内容见仓库 server/deploy/bootstrap.sh：
#   按「location /api/ 是否已存在」「WebSocket 头是否已配」三种情况分别处理，
#   修改前自动备份原配置（.bak.时间戳），改完 nginx -t 校验再 reload。
# 搬到新项目时：替换服务名、端口、目录路径三组值即可，逻辑通用。

echo ">> 启动服务"
systemctl restart rules-api
sleep 2
systemctl --no-pager --lines 3 status rules-api || true
curl -s http://127.0.0.1:8787/api/health && echo " <- 本机健康检查 OK"
echo ">> 引导完成"
```

</details>

---

## 五、设计要点与理由（改配置前先读）

1. **主机指纹固定（TOFU 防劫持）**：`ssh-keyscan` 本身走网络，若 DNS 被污染或中间人劫持，scan 到的会是攻击者的密钥、known_hosts 校验形同虚设。所以 scan 之后再用 `ssh-keygen -lf` 比对**预先记下的指纹**，不匹配直接失败。换服务器/重装系统后指纹会变，需同步更新 `HOST_KEY_FP`。
2. **`concurrency` + `cancel-in-progress`**：连推多个 commit 时，旧部署被取消、只跑最新一个——既省时间又避免两个部署并发写服务器。
3. **`CGO_ENABLED=0` 静态编译 + `-trimpath -ldflags "-s -w"`**：产物不依赖服务器上的任何 so 库，任意 Linux/amd64 直接运行；二进制更小、构建路径不泄漏。
4. **`rsync -az --delete`**：增量同步省带宽；`--delete` 清掉仓库里已删除的文件，保证 webroot 与仓库一致（不然改名/删除的旧页面会永远残留）。排除 `.git/` 与后端源码目录。rsync 不存在时降级为「tar 打包过 SSH + 先清空再解压」，行为等价、速度慢些。
5. **二进制 `scp` 成 `.new` 再 `mv`（原子替换）**：`mv` 在同一文件系统上是原子操作，传输中断不会破坏线上正在运行的二进制；Linux 下已启动的进程持有旧 inode，重启前服务不受影响。
6. **systemd 单元内联在 workflow 里幂等安装**：单元定义随代码一起演进、每次部署都重写一遍，服务器上的副本永不漂移；也意味着改单元不需要登服务器。代价是 YAML 里多一段 heredoc——注意 `<< "UNIT"` 的引号，防变量被本地 shell 展开。
7. **后端只听 `127.0.0.1`**：所有外部流量必须过 nginx（TLS、日志、限流都在 nginx 层做），后端端口不暴露公网。
8. **systemd 加固**：`NoNewPrivileges` / `ProtectSystem=full` / `ReadWritePaths=data` 把可写目录收窄到数据目录，其余文件系统对进程只读。
9. **部署后验证**：站点要 200、API health 要返回预期 JSON，任一失败整个 job 红——部署「跑完」不等于「成功」，验证不过等于没发上去。
10. **验证走域名而非 IP**：本项目的教训——certbot 上 HTTPS 后，纯 IP 的 80 端口请求会变 404，用 IP 验证会误报失败。

---

## 六、迁移到新项目改动清单

按顺序过一遍：

| # | 位置 | 改什么 |
|---|------|--------|
| 1 | 服务器 | 按「二、一次性准备」生成部署密钥、装 nginx/rsync、配好域名与证书、跑反代配置 |
| 2 | GitHub | 仓库 Secrets 添加 `SERVER_SSH_KEY` |
| 3 | workflow `env` | `SERVER`（用户@IP）、`HOST_KEY_FP`（指纹） |
| 4 | workflow 步骤1 | `ssh-keyscan` 里的 IP |
| 5 | workflow 步骤2 | Go 模块路径、产物名、入口包；**纯静态站项目删除步骤 2 和 5** |
| 6 | workflow 步骤3 | webroot 路径、rsync/tar 排除项 |
| 7 | workflow 步骤4 | 二进制路径、服务名、环境变量（ADDR 保持 `127.0.0.1:端口`） |
| 8 | workflow 步骤5 | 验证域名、健康检查路径与断言 |
| 9 | 触发分支 | `branches: [main]` 按需调整 |

非 Go 项目：把「交叉编译」换成你自己的构建（如 `npm run build`），产物放进 rsync 的同步范围或单独 scp；后端步骤同理换成你的运行方式，验证步骤保持「有断言的 curl」不变。

---

## 七、常见问题排查

| 症状 | 原因与处理 |
|------|-----------|
| `主机指纹不匹配` | 服务器重装/换 IP 导致指纹变化：重新 `ssh-keyscan` 取指纹，更新 `HOST_KEY_FP`。若你确认没换过服务器，**不要**盲改指纹——先排查是不是网络被劫持 |
| `Permission denied (publickey)` | Secrets 里的私钥内容不完整（缺 BEGIN/END 行或末尾换行）；或公钥没进服务器 `authorized_keys` |
| job 卡住直到 30 分钟超时 | 服务器安全组没放行 runner 的出站 SSH（22 端口）；或 `rsync`/`ssh` 在等交互输入——检查 keyscan 步骤是否成功写入了 known_hosts |
| 站点验证 404/301 | 验证 URL 用了裸 IP（certbot 后 80 端口对 IP 返回 404）；改走域名 HTTPS，见设计要点 10 |
| API health 不通但服务已重启 | nginx 反代没配/没 reload；或后端监听端口与 `proxy_pass` 不一致。登服务器 `curl http://127.0.0.1:<端口>/api/health` 先分清是服务问题还是反代问题 |
| 改了 systemd 单元没生效 | 检查 heredoc 结束符 `UNIT` 前是否有多余空格；改完必须 `daemon-reload`（workflow 里已包含） |
| 旧文件没被清理 | 用的是 tar 降级路径但没加 `--exclude` 对应项；或 rsync 时 `--delete` 被误删 |
