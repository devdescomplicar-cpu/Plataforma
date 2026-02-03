# CORS no deploy da API (apidc.pratiko.app.br)

O front em **https://descomplicar.pratiko.app.br** chama a API em **https://apidc.pratiko.app.br**. O navegador exige que a API responda ao **preflight (OPTIONS)** com o header `Access-Control-Allow-Origin`.

## 0. Desenvolvimento local contra API remota

Se você roda o front em `http://localhost:3000` ou `http://localhost:3001` com `VITE_API_URL=https://apidc.pratiko.app.br/api`, o **servidor da API** (apidc) precisa incluir localhost nas origens permitidas. No servidor onde a API roda, configure:

```bash
# Múltiplas origens (produção + dev local)
CORS_ORIGINS=https://descomplicar.pratiko.app.br,https://www.descomplicar.pratiko.app.br,http://localhost:3000,http://localhost:3001
```

Alternativa: durante o dev, use o proxy do Vite (deixe `VITE_API_URL` vazio) para chamar o backend local na porta 3001, assim não há CORS.

## 1. Conferir no servidor da API

- [ ] **Código atualizado**  
  O `server/src/app.ts` tem um handler explícito de CORS para `/api`. Garanta que o build e o processo em produção usem essa versão (faça deploy e reinicie o processo).

- [ ] **Variável de ambiente (recomendado)**  
  No ambiente onde a API roda (apidc), defina:
  ```bash
  CORS_ORIGIN=https://descomplicar.pratiko.app.br
  ```
  Ou várias origens separadas por vírgula:
  ```bash
  CORS_ORIGINS=https://descomplicar.pratiko.app.br,https://www.descomplicar.pratiko.app.br
  ```
  Se não definir nada, a API aceita qualquer `Origin` (funciona, mas em produção é melhor restringir).

- [ ] **Reinício após deploy**  
  Após subir o novo código, reinicie o processo da API (PM2, systemd, Docker, etc.) para carregar o novo build e as env vars.

## 2. Se usar Nginx (ou similar) na frente da API

Se o OPTIONS **não chega** ao Node (por exemplo Nginx responde 404/405 para OPTIONS), o preflight nunca recebe os headers CORS. Duas opções:

### Opção A: Encaminhar OPTIONS para o Node

Garanta que o Nginx encaminha **todas** as requisições para `/api` (incluindo OPTIONS) para o processo Node:

```nginx
location /api {
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' $http_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, Accept, X-Requested-With' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Max-Age' 86400 always;
        return 204;
    }
    proxy_pass http://localhost:3001;   # porta do Node
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Origin $http_origin;
}
```

Assim o Nginx responde ao OPTIONS com CORS e 204; o Node continua tratando GET/POST/etc.

### Opção B: Só proxy, CORS no Node

Se o Nginx já encaminha tudo (incluindo OPTIONS) para o Node, **não** responda OPTIONS no Nginx. Deixe o Node responder (o `app.ts` já faz isso). Confirme que não há `if ($request_method = 'OPTIONS') { return ...; }` para `/api` que impeça o request de chegar ao Node.

## 3. Testar após o deploy

No navegador (DevTools → Network), ao fazer login em https://descomplicar.pratiko.app.br:

1. Deve aparecer uma requisição **OPTIONS** para `https://apidc.pratiko.app.br/api/auth/login`.
2. A resposta deve ter status **204** e os headers:
   - `Access-Control-Allow-Origin: https://descomplicar.pratiko.app.br`
   - `Access-Control-Allow-Credentials: true`
   - `Access-Control-Allow-Methods: ...`
   - `Access-Control-Allow-Headers: ...`

Se o OPTIONS retornar 404, 502 ou sem `Access-Control-Allow-Origin`, o problema está no deploy/proxy (código não atualizado ou Nginx tratando OPTIONS antes do Node).
