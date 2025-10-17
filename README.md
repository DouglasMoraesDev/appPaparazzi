# appPaparazzi (Massas Paparazzi)

Projeto exemplo: app para criar lista de produção diária e equipe da cozinha confirmar itens.
Backend: Node + Express + Prisma (MySQL)
Frontend: HTML/CSS/Vanilla JS (páginas estáticas em public/)

## Passos para rodar localmente
1. Tenha Node.js instalado (recomendado v18+).
2. Tenha MySQL rodando e crie um banco vazio (no seu caso você já criou `apppaparazzi`).
3. Ajuste o `.env` se necessário (já configurado para seu banco).
4. Instale dependências:
   ```
   npm install
   ```
5. Gere client Prisma e rode migração:
   ```
   npx prisma generate
   npx prisma migrate dev --name init
   ```
   Ou, se preferir sem migrations:
   ```
   npx prisma db push
   ```
6. Rode seed para criar usuário dono e alguns produtos:
   ```
   npm run seed
   ```
7. Inicie o servidor:
   ```
   npm run dev
   ```
8. Abra no navegador:
   - Dono: http://localhost:3333/dono.html
   - Cozinha: http://localhost:3333/cozinha.html

## Credenciais de teste
- Dono: nome `dono`, senha `senha123`
- Cozinheiro: nome `cozinheiro`, senha `senha123`
# appPaparazzi
