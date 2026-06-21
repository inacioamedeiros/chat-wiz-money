# 💸 App de Organização de Finanças Pessoais com Vibe Coding

Aprenda a **criar soluções com IA** de forma criativa, guiando ferramentas como o **Copilot** e o **Lovable** com uma comunicação simples e natural. O foco é desenvolver o conceito de um **App de Organização de Finanças Pessoais**, mas, acima de tudo, aprender o **jeito Vibe de programar com IA**.

---

## 📌 Prompt Final (PRD)

Objetivo  
Construir um MVP de um aplicativo móvel conversacional de finanças pessoais (iOS/Android) que permita registrar transações por chat em linguagem natural, classificar automaticamente, acompanhar metas e fornecer recomendações práticas do "Agente Financeiro". Entregar código pronto para deploy, documentação e scripts de treino/implantação.

Resumo do escopo obrigatório  
- Plataforma: React Native (preferência) ou Flutter; projeto que rode em iOS e Android.  
- Backend: serverless em Node.js/TypeScript (AWS Lambda / GCP Functions ou equivalente).  
- Banco: PostgreSQL gerenciado ou Firestore; armazenamento de arquivos em S3/GCS.  
- Autenticação: Firebase Auth ou Auth0 com email/senha e suporte a biometria.  
- NLU: pipeline que identifica intenções e extrai entidades; fallback por regras regex.  
- Classificador de categoria: modelo leve com endpoint REST e re-treinamento incremental.  
- Agente Financeiro: motor de regras configurável (JSON) que gera recomendações priorizadas.  
- UI/UX: chat principal, Hoje, Registrar transação, Metas, Relatórios, Onboarding rápido.  
- Segurança: TLS, criptografia AES-256, endpoint para exportar/excluir dados.  
- Observability: integração Sentry; logs estruturados; métricas básicas.  
- Testes: unit tests backend, integração básica e E2E do fluxo de registro por chat.  
- Documentação: README, scripts de deploy, AGENT_INSTRUCTIONS.md, DATA_GUIDE.md, design assets.  

Critérios de aceitação  
1. Onboarding completo em < 60s.  
2. Registro de 5 transações via chat sem erros.  
3. Classificador retorna categoria com confidence e permite correção.  
4. Tela Hoje exibe saldo estimado e recomendação do Agente.  
5. Metas criadas mostram progresso e aporte sugerido.  
6. Repositório com README, scripts de deploy e testes automatizados.  

---

## 🖼️ Prints / Vídeos das Interações

Inclua aqui **screenshots** ou pequenos **GIFs/vídeos** mostrando:  
- A conversa com o Copilot para gerar o PRD.  
- O prompt final sendo colado no Lovable.  
- A resposta do Lovable com o plano de MVP ou telas simuladas.  

---

## 📱 Resumo do App de Finanças Pessoais

O aplicativo permite que o usuário **controle suas finanças por meio de conversas naturais**.  
Principais funcionalidades:  
- Registrar gastos e receitas via chat em linguagem natural.  
- Classificação automática das transações com possibilidade de correção.  
- Definição e acompanhamento de metas financeiras.  
- Recomendações práticas do **Agente Financeiro** para economia.  
- Relatórios simples e personalizados com visão mensal e saldo estimado.  

O diferencial é a **simplicidade**: em vez de formulários complexos, o usuário conversa com o app como se fosse um consultor pessoal.
<img width="1200" height="658" alt="image" src="https://github.com/user-attachments/assets/24d4995f-e039-4c68-8dbd-a2fc8dd473b4" />

---

## 🤔 Reflexão sobre o Processo

- O que funcionou bem?  
  A clareza do PRD e a estruturação do prompt foram fundamentais. A IA conseguiu entender a intenção e gerar um plano detalhado sem necessidade de muitas correções.  

- O que não funcionou como esperado?  
  Algumas respostas iniciais foram genéricas. Foi preciso lapidar o prompt para que a IA entregasse algo realmente aplicável como MVP.  

- O que aprendi sobre conversar com IAs?  
  Aprendi que **clareza e contexto são tudo**. Quanto mais específico e objetivo o prompt, melhor o resultado. Também percebi que conversar com IA é como guiar um parceiro criativo: você não pede código, você mostra a vibe da ideia e deixa a IA transformar em solução.  

---

## 💬 Conclusão

Este projeto mostra como aplicar o conceito de **Vibe Coding** para criar um app de finanças pessoais sem escrever código manualmente. O foco foi aprender a **estruturar ideias em prompts claros**, usar a IA como parceira criativa e entregar um conceito funcional de MVP.
