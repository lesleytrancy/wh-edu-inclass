# 火山引擎部署实施文档

本文按当前代码实现部署一间课堂：React/Vite 静态站点、FastAPI、SQLite、上传文件和豆包模型接口。同一域名提供页面、`/api` 和 WebSocket；示例系统为 Ubuntu 22.04 LTS。下文的域名 `class.example.com`、仓库地址、密钥和用户名均需替换。

## 1. 40 人并发配置

按 **40 名学生同时在线，另有 1 名教师和 1 个教室大屏** 估算。以下是单课堂试运行的起始配置，不是经过压测的吞吐量保证。

| 资源 | 建议配置 | 原因 |
| --- | --- | --- |
| 云服务器 ECS | 通用型，**4 vCPU / 8 GiB 内存**，Ubuntu 22.04 LTS，单实例 | Nginx、1 个 FastAPI worker、文档解析和约 42 条 WebSocket 连接共机运行；无需 GPU，AI 推理在豆包云端完成 |
| 系统盘 | SSD 40 GiB | 操作系统、Node/Python 依赖、代码及构建产物 |
| 数据盘 | SSD **100 GiB 起**，挂载到 `/var/lib/whclass` | SQLite、AI 上传件和课堂展示原件；本地现有演示 `data/` 已约 2.7 GiB，实际按课件留余量并监控扩容 |
| 公网 | EIP，**50 Mbps 起始带宽**；高峰集中下载大课件时提高带宽或采用适合的文件分发方案 | 40 台设备同时取 20 MiB 课件约产生 800 MiB 下行；50 Mbps 理论传完约 134 秒，实际还受协议和线路影响 |
| 域名与 TLS | 已完成所需备案的域名，可信 HTTPS 证书 | 浏览器麦克风需要安全上下文；同源 `wss://` 与 `/api` 也可避免跨域配置 |

初期只运行 **1 台 ECS、1 个 Uvicorn worker**。当前 `classroom_state` 和 WebSocket 连接保存在 Python 进程内；直接开多个 worker、部署多个实例或加负载均衡会让不同学生进入不同状态。SQLite 和上传文件也在本地盘上。只有改造为共享状态、跨进程消息广播和共享存储后，才能横向扩容。

云服务器规格可按地域库存选同等 vCPU/内存的通用型，磁盘、EIP 和带宽以购买控制台实际可选项为准。容量需要用本校设备、课件大小和模型调用量做验收，不建议仅凭人数换算规格。火山引擎官方文档：[ECS 产品说明](https://docs.volcengine.com/docs/ecs?lang=zh)、[通用型实例适用场景](https://docs.volcengine.com/docs/ecs/Use-scenarios?lang=zh)、[安全组原则](https://docs.volcengine.com/docs/ecs/Security-overview?lang=zh)。

## 2. 开通资源与网络

1. 在火山引擎控制台选靠近学校的地域，创建上述 ECS、同地域 SSD 数据盘和 EIP；把域名 A 记录指向 EIP。使用中国内地云资源对外提供网站时，先完成备案并获取备案号；火山引擎对可用于备案的 ECS 购买时长、计费方式和公网 IP 还有要求，购买前核对[备案云资源条件](https://docs.volcengine.com/docs/Record/Preparingtofilecloudresources?lang=zh)。若尚未备案，先在受控测试环境验证，不要用公网 IP 的 HTTP 页面测试录音功能。
2. 安全组入站仅允许公网 TCP 80/443、运维固定 IP 的 TCP 22；不要放通 8000、5173 或 SQLite。出站允许 DNS、系统更新和豆包 API 的 HTTPS。系统防火墙也保持相同策略。
3. 挂载并格式化新数据盘到 `/var/lib/whclass`。确认设备名后操作，**不要格式化已有数据盘**。为数据盘配置 UUID 自动挂载，确认重启后路径可用，再部署服务。
4. 在火山引擎方开通豆包模型服务，创建可用模型接入点并取得 API Key；确认账号限流与预算。模型请求从服务器出站到 `ark.cn-beijing.volces.com`，模型并发和限流不受 ECS 规格保证。

## 3. 安装应用

以下命令在 ECS 上执行。需要先安装 `git`、`nginx`、`python3`、`python3-venv` 和满足项目要求的 Node.js（20.19+ 的 20.x 或 22.12+）；推荐使用受维护的 Node.js 22.x。部署目录示例为 `/srv/whclass`，命令中的仓库 URL 换成实际地址。

```bash
sudo apt update
sudo apt install -y git nginx python3 python3-venv
sudo useradd --system --create-home --shell /usr/sbin/nologin whclass
sudo mkdir -p /srv/whclass /var/lib/whclass
sudo chown -R whclass:whclass /srv/whclass /var/lib/whclass
sudo -u whclass git clone https://example.com/your/repo.git /srv/whclass
cd /srv/whclass
node --version
npm --version
sudo -u whclass npm ci
sudo -u whclass npm run build
sudo -u whclass python3 -m venv .venv
sudo -u whclass .venv/bin/pip install -r server/requirements.txt
```

`node --version` 必须满足上面的范围；若尚未安装 Node.js，先按其官方安装方法安装，再执行 `npm ci`。`dist/` 是 Nginx 的静态资源目录；生产环境不运行 `npm run dev`、`vite preview` 或带 `--reload` 的 Uvicorn。不要把本地 `data/`、`.env`、`.venv`、`node_modules` 随代码发布到服务器。

在 `/etc/whclass.env` 保存模型密钥，文件只允许 root 读取。`DOUBAO_MODEL` 填已开通的接入点 ID；未填密钥可运行服务，但 AI 功能会降级或报错。`AI_DATA_DIR` 必须指向已挂载的数据盘。

```bash
sudo install -m 600 -o root -g root /dev/null /etc/whclass.env
sudoedit /etc/whclass.env
```

文件内容示例（不要把真实密钥提交到 Git）：

```dotenv
AI_DATA_DIR=/var/lib/whclass
DOUBAO_API_KEY=替换为实际密钥
DOUBAO_MODEL=替换为接入点ID
CORS_ORIGINS=https://class.example.com
```

创建 `/etc/systemd/system/whclass.service`：

```ini
[Unit]
Description=Wh Class FastAPI
After=network-online.target
Wants=network-online.target
RequiresMountsFor=/var/lib/whclass

[Service]
User=whclass
Group=whclass
WorkingDirectory=/srv/whclass
EnvironmentFile=/etc/whclass.env
ExecStart=/srv/whclass/.venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8000 --workers 1
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now whclass
sudo systemctl status whclass
curl -fsS http://127.0.0.1:8000/api/health
```

健康检查应返回 `ok: true`；`modelConfigured: true` 仅说明密钥和模型名已配置，不表示模型调用或额度已验证。

## 4. Nginx 与 HTTPS

创建 `/etc/nginx/sites-available/whclass`。`/api/` 必须先于 SPA 回退匹配，WebSocket 代理需要升级头和较长空闲超时。这里把单次请求体限制为 550 MiB，应用侧 AI 解析仍限制**单个文件 500 MiB**；多文件批量上传应分批处理。

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    server_name class.example.com;
    root /srv/whclass/dist;
    index index.html;
    client_max_body_size 550m;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
        proxy_request_buffering off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/whclass /etc/nginx/sites-enabled/whclass
sudo nginx -t
sudo systemctl reload nginx
```

域名解析和备案完成后，可用 Certbot 为 Nginx 申请证书并设置 HTTP 跳转及续期：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d class.example.com --redirect
sudo certbot renew --dry-run
sudo nginx -t
```

也可以从火山引擎证书中心取得证书，按[官方 Nginx 安装指南](https://docs.volcengine.com/docs/CertificateCenter/InstallinganSSLcertificateonNginx?lang=zh)配置 443，并自行安排续期。证书生效后访问 `https://class.example.com/`，且教师端、学生端和大屏都使用**完全相同的域名**；不要混用 IP、HTTP 和其他域名。当前前端默认使用同源 `/api` 和同源 WebSocket，无需设置 `VITE_AI_API_BASE`。若跨域部署，必须在构建前配置该变量、后端 `CORS_ORIGINS`，并额外处理写死为同源的材料与 WebSocket 路径。

## 5. 验收 40 人场景

1. 访问 `https://class.example.com/api/health` 和三端页面；浏览器开发者工具确认 `/api/classroom/live` 返回 `101 Switching Protocols`，断线后能重连。
2. 教师上传一份实际课件，学生端和大屏检查课件及翻页；验证课前答题、课堂提问、小组讨论和课后复习在 **40 台真实设备** 上的同步与显示。浏览器允许麦克风后验证录音和语音识别。
3. 使用实际课堂的 PDF/图片大小，同时让 40 台设备首次进入和拉取课件，记录首屏时间、下载完成时间、WebSocket 掉线率、API 错误率、ECS CPU/内存、磁盘剩余空间及 EIP 出入带宽。若课件下载排队明显，提高带宽或调整文件分发方式；若解析时 CPU/内存吃紧，升级 ECS。
4. 按预期的最高 AI 请求并发验证豆包限流、错误率和响应时间。前端普通 AI 请求通常 30 秒超时，报告为 120 秒；模型侧慢响应或限流会触发降级或报错，扩 ECS 不能解决外部模型配额问题。
5. 重启 `whclass` 服务，确认静态页面、SQLite、已上传文件仍可访问；检查课堂状态是否恢复。服务端重启会清空内存状态，仍在线的教师浏览器可能在重连时重新发送本地状态，但这不是可靠的持久化或恢复机制。

## 6. 运维、备份与上线限制

- 监控 CPU、内存、磁盘剩余空间、EIP 带宽、Nginx 5xx、Uvicorn 日志和模型调用失败率；日志查看：`sudo journalctl -u whclass -f`。预留上传与备份空间，避免磁盘满导致 SQLite 写入失败。
- 定期备份 `/var/lib/whclass` 中的 `classroom.db`、`uploads/` 和 `classroom-materials/`，并做恢复演练。备份 SQLite 时用 SQLite 在线备份接口或短暂停写，不要在持续写入期间仅复制数据库文件。云盘快照可作为附加恢复手段；官方文档也提示快照应考虑写入一致性：[创建快照](https://docs.volcengine.com/docs/ecs/Create-a-snapshot?lang=zh)。浏览器 `localStorage`/IndexedDB 中的状态和教师本地文件不包含在服务器备份里。
- 更新时先备份数据，再拉取已验收版本，运行 `npm ci`、`npm run build`、安装依赖、`sudo systemctl restart whclass`，然后重复健康检查与三端同步检查。课堂进行中不要重启：服务端课堂状态只在内存中。
- 当前演示实现没有服务端身份认证、严格角色授权、持久化课堂状态和并发写入冲突处理；`/api/classroom/reset-demo` 等写接口也没有鉴权。**不要把此配置直接当作可承载真实学生信息的正式生产环境**。正式投入使用前需要补齐认证授权、接口访问控制、隐私合规与数据持久化，并完成 40 人实测。服务器配置只能提供资源余量，不能消除这些应用限制。
