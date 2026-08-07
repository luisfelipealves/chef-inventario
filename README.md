# Chef Master

1. Visão Geral e Arquitetura

O ChefGestão é uma aplicação web mobile-friendly desenhada especificamente para cozinheiras e

confeiteiras artesanais gerirem o seu stock de ingredientes e calcularem automaticamente o custo de

produção das suas receitas (Ficha Técnica).

A aplicação adota uma filosofia Local-First (Offline-First). O utilizador comum armazena 100% dos dados no

próprio dispositivo de forma gratuita e imediata. O modelo de negócio assenta num formato Freemium, onde

funcionalidades de nuvem e automatização avançada pertencem ao plano Premium.

2. Divisão do Projeto por Fases (Sprints para IA)

Para garantir a máxima eficácia no desenvolvimento guiado por IA (Vibe Coding), o projeto foi fracionado em

5 fases sequenciais. Cada fase deve ser validada e testada de forma isolada antes de se avançar para a

seguinte.

Fase 1: Fundação do Projeto & Banco Local (Offline-First)

Objetivo: Montar a infraestrutura e a base de dados interna do telemóvel que guardará os registos sem

custos de alojamento.

•

Configuração inicial do Next.js (App Router), Tailwind CSS e componentes do Shadcn/ui.

•

Instalação e setup da biblioteca dexie.js para gerir o IndexedDB nativo do navegador.

•

Definição do esquema inicial das tabelas: ingredientes e receitas.

PROMPT PARA A IA (FASE 1)

"Configura a estrutura inicial do projeto utilizando Next.js (App Router), Tailwind CSS e os componentes

base do Shadcn/ui. De seguida, instala a biblioteca dexie.js e configura a base de dados IndexedDB

local com duas tabelas iniciais: 'ingredientes' e 'receitas'. Cria apenas a estrutura de dados e as

ligações base do banco local, sem interfaces complexas por enquanto. Confirma quando terminar a

infraestrutura."

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://chef-inventario.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/607eec83-fe87-4249-9772-ea39891c1a16).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
