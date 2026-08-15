# Plan: Adaptação para Gestão e Venda de Cestas Básicas (CestaFácil)

O projeto será migrado de um sistema de Bolão de Futebol para uma plataforma completa de gestão e venda de cestas básicas, kits de alimentos e planos recorrentes, conforme o PRD "CestaFácil". A transição focará em converter as entidades esportivas (jogos, palpites, seleções) em entidades comerciais (pedidos, produtos, cestas).

## User Review Required

> [!IMPORTANT]
> Esta é uma mudança estrutural profunda. O sistema deixará de ser um bolão de futebol para se tornar um e-commerce de cestas básicas. Toda a lógica de "jogos" e "ranking" será substituída por "catálogo" e "estoque".

## Mudanças Estruturais

### 1. Banco de Dados (Supabase)
- **Produtos e Cestas**: Criar tabelas para `produtos`, `cestas`, `cesta_itens` (composição) e `categorias`.
- **Estoque**: Tabela para controle de saldo e movimentações de produtos.
- **Pedidos**: Migrar o conceito de `palpites` para `pedidos`, incluindo status de entrega (`em_separacao`, `saiu_para_entrega`, etc.).
- **Clientes**: A tabela de `torcedores` será renomeada ou adaptada para `clientes`, com campos de endereço e histórico.
- **Assinaturas**: Tabela para planos recorrentes de alimentação.

### 2. Backend (Server Functions)
- **Gestão de Pedidos**: Fluxo de checkout, cálculo de frete e integração com gateway Pix (substituindo o fluxo manual de confirmação de palpite).
- **Controle de Produção**: Lógica para montagem de cestas baseada nos itens disponíveis.
- **Notificações**: Adaptar a fila de WhatsApp para enviar status do pedido (Pedido Recebido -> Pago -> Entregue).

### 3. Frontend (UI/UX)
- **Catálogo Público**: Substituir o dashboard de jogos por uma vitrine de cestas em destaque.
- **Monte sua Cesta**: Nova interface interativa para personalização de itens (substituições e adições).
- **Painel Administrativo**:
    - **Dashboard**: KPIs de vendas, estoque baixo e entregas do dia.
    - **Gestão de Produtos**: CRUD completo de itens e kits.
    - **Logística**: Tela para organização de rotas e status de separação.

## Detalhes Técnicos
- **PWA**: Manter e reforçar a capacidade offline para entregadores consultarem rotas.
- **SEO**: Atualizar metadados para termos relacionados a "cesta básica", "entrega de alimentos" e "kits mensais".
- **Temas**: Migrar as cores "Brasil Moderno" para uma paleta focada em alimentação e frescor (ex: Verdes, laranjas e tons terrosos).

## Próximos Passos
1. **Migrations**: Definir o novo esquema SQL de produtos e pedidos.
2. **Landing Page**: Refatorar `src/routes/index.tsx` para o novo catálogo.
3. **Admin**: Adaptar a sidebar e módulos para a nova realidade comercial.
