# Deploy POE2 Tools

This project needs a Node server in production. The pages are mostly static, but
`scripts/serve.mjs` also provides `/api/poe-ninja/currency` and
`/api/poe-ninja/currency-details` proxy endpoints used by the market pages.

## Tencent Cloud Lighthouse / CVM

1. Point the domain DNS to the server public IP:

```text
niou126.cn      A      <server-public-ip>
www.niou126.cn  CNAME  niou126.cn
```

2. Install Node.js 20 or newer on the server.

3. Clone and start the service:

```sh
git clone https://github.com/JermyNiu/PathOfExile2Tools.git
cd PathOfExile2Tools
npm start
```

For a long-running service, use pm2:

```sh
npm install -g pm2
pm2 start npm --name poe2-tools -- start
pm2 save
pm2 startup
```

4. Put Nginx in front of Node:

```nginx
server {
  listen 80;
  server_name niou126.cn www.niou126.cn;

  location / {
    proxy_pass http://127.0.0.1:8766;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

5. Enable HTTPS with Certbot or Tencent Cloud SSL certificate after DNS resolves.

## Docker

```sh
docker build -t poe2-tools .
docker run -d --name poe2-tools --restart unless-stopped -p 8766:8766 poe2-tools
```

Then use the same Nginx reverse proxy above.
