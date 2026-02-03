# Deploy automático no EasyPanel (ao dar commit/push)

Para que cada **push** no repositório dispare um **redeploy automático** do app no EasyPanel:

## 1. Token no GitHub

O EasyPanel usa um **Personal Access Token** do GitHub com permissão para **webhooks** (assim o GitHub avisa o EasyPanel quando há push).

### Opção A: Token clássico

1. Acesse [GitHub → Settings → Developer settings → Personal access tokens (classic)](https://github.com/settings/tokens).
2. **Generate new token (classic)**.
3. Marque os escopos:
   - **repo** – acesso ao conteúdo do repositório
   - **admin:repo_hook** – deploy automático (webhooks)
4. Gere o token e **copie** (ele não é mostrado de novo).

### Opção B: Token fine-grained (recomendado)

1. Acesse [GitHub → Settings → Developer settings → Personal access tokens (fine-grained)](https://github.com/settings/tokens?type=beta).
2. **Generate new token**.
3. Resource owner: sua conta ou organização.
4. Repository access: **Only select repositories** e escolha este repositório.
5. Em **Repository permissions**:
   - **Metadata**: Read-only (obrigatório)
   - **Contents**: Read-only
   - **Webhooks**: **Read and write** (para deploy automático)
6. Gere o token e **copie**.

## 2. Configurar no EasyPanel

1. No EasyPanel, vá em **Settings** (ícone de engrenagem).
2. Abra a seção **Github**.
3. Cole o **Personal Access Token** e salve.
4. Deve aparecer a mensagem: **Github token updated**.

## 3. Fonte do app como GitHub

O app precisa estar configurado com **Code source = GitHub** (não “Upload” ou “Git SSH”):

1. No seu **App** no EasyPanel, abra **Source** (ou a aba onde está a origem do código).
2. Escolha **GitHub** como fonte.
3. Selecione o repositório e o branch (ex.: `main`).
4. Salve.

Com o token com permissão de webhooks e a fonte em GitHub, o EasyPanel passa a receber eventos de push e pode fazer **redeploy automático** quando você der push (ou quando alguém fizer merge na branch configurada).

## Resumo

| Onde              | O que fazer |
|-------------------|-------------|
| GitHub            | Criar token com escopo **repo** + **admin:repo_hook** (clássico) ou **Webhooks: Read and write** (fine-grained). |
| EasyPanel Settings | Colar o token em **Github**. |
| App no EasyPanel  | Fonte = **GitHub**, repositório e branch corretos. |

Depois disso, a cada `git push` (por exemplo após um commit), o EasyPanel pode redeployar o app automaticamente, conforme a configuração do painel.
