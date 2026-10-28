# Desenvolvimento

## Situação inicial

Inspeção em 28/10/2026: a branch main continha somente README.md com o título do projeto. Não foram encontrados código, dependências, testes, automações ou instruções AGENTS.md. O README original foi preservado integralmente.

## Estrutura

| Caminho | Finalidade |
| --- | --- |
| src/ | Código-fonte da aplicação |
| tests/ | Testes automatizados |
| scripts/ | Rotinas de desenvolvimento e manutenção |
| docs/ | Documentação e decisões técnicas |
| .editorconfig | Padrões de edição |
| .gitignore | Exclusão de credenciais e artefatos locais do versionamento |

## Preparação local

1. Autenticar no GitHub com uma conta autorizada ao repositório privado.
2. Clonar: `git clone https://github.com/WandesonMarcone/nossa-casa-financas.git`.
3. Entrar: `cd nossa-casa-financas`.
4. Buscar branches: `git fetch origin`.
5. Acessar esta preparação: `git switch chore/estrutura-desenvolvimento`.
6. Conferir o estado: `git status`.

Não há comando de instalação, execução ou teste nesta etapa: nenhuma tecnologia ou dependência foi escolhida. As pastas contêm documentação, não uma aplicação funcional.

## Próxima etapa

Definir escopo inicial, plataforma, linguagem/framework, persistência e autenticação. Registrar essas decisões aqui antes de criar o manifesto de dependências e o ambiente executável. Depois, documentar versões, variáveis de ambiente, comandos de execução, testes e build; adicionar validação automatizada de acordo com a tecnologia adotada.

## Fluxo de trabalho

Criar branches por tarefa e revisar alterações por pull request. Preservar arquivos existentes; evitar reescrita de histórico. Usar dados fictícios em desenvolvimento e testes. Manter credenciais em arquivos locais ignorados; quando houver variáveis definidas, adicionar .env.example apenas com nomes e valores fictícios.
