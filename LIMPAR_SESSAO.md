# Como Limpar a Sessão e Começar do Zero

## Opção 1: Limpar no Console do Navegador

Abra o console do navegador (F12) e execute:

```javascript
localStorage.removeItem('beautify_session');
location.reload();
```

## Opção 2: Limpar manualmente

1. Abra as DevTools do navegador (F12)
2. Vá para a aba "Application" (Chrome) ou "Storage" (Firefox)
3. No menu lateral, expanda "Local Storage"
4. Clique no domínio da sua aplicação (geralmente `localhost`)
5. Encontre a chave `beautify_session`
6. Clique com o botão direito e selecione "Delete"
7. Recarregue a página (F5)

## Opção 3: Limpar todos os dados da aplicação

No console do navegador:

```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## Após Limpar

Você será redirecionado para a página de login. A partir daí pode:

1. **Criar nova conta de profissional**: Clique em "Criar Nova Conta"
2. **Fazer login** (se já tiver criado uma conta anteriormente)

## Nota Importante

Este sistema usa autenticação local (localStorage). Para uma implementação real com Supabase Auth, seria necessário integrar o sistema de autenticação do Supabase que já está configurado no projeto.
