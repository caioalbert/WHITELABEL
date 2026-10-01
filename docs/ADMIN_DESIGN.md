# Interface administrativa

O painel usa uma navegação compartilhada, com os mesmos destinos no computador e no celular. A área atual aparece no menu e no caminho da página. A busca rápida abre com Ctrl K ou Command K e também pelos botões de busca.

## Referências

- [Apple — Mac](https://www.apple.com/br/mac/): espaço entre grupos, tipografia e contraste entre superfícies.
- [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout): hierarquia e adaptação do conteúdo.
- [Apple Design](https://developer.apple.com/design/): referência geral de interação e organização visual.

A identidade e o logotipo continuam sendo os da marca configurada. A interface usa fontes do sistema, ícones Lucide e os componentes Radix já disponíveis no projeto.

## Padrão para novas telas

`app/admin/layout.tsx` envolve as telas com `AdminShell`. Não adicionar outro menu ou outro botão de logout nas páginas. Usar `AdminPageHeader` para título, descrição, retorno à lista e ações específicas da tela. O login recebe apenas o estilo da área administrativa.

As regras de `app/admin/admin.css` ficam restritas à área administrativa. Azul identifica ações, enquanto as cores de status continuam indicando situação. Respeitar foco visível, redução de movimento e redução de transparência.

O resumo mantém todas as métricas existentes, priorizando clientes, adimplência, pendências e receita. A lista de empresas tem filtros de situação e aceita CNPJ com ou sem pontuação. A tabela pode rolar horizontalmente em telas estreitas.

## Validação local

- Build de produção com webpack: concluído.
- TypeScript e lint: sem erros; oito avisos anteriores permanecem.
- 112 testes passaram, incluindo importação de funcionários e condições comerciais.
- Interface real do Next.js verificada em 1440 × 1000 e 390 × 844, com APIs e autenticação de teste.
- Busca rápida, retorno do foco ao fechar, filtros e CNPJ formatado.
- Detalhes da empresa, dependentes e cancelamento da confirmação de inativação.
- Cadastro de empresa até a etapa de importação, sem finalizar.
- Navegação móvel fecha ao selecionar uma página.
- Clientes, planos, parceiros, vendedores, contratos e login.

Os testes de interface usam dados fictícios, sem envio de e-mails ou mudanças em produção. As regras financeiras foram preservadas. A sessão administrativa e os controles de segurança foram corrigidos; detalhes em [ADMIN_SESSION.md](ADMIN_SESSION.md).
