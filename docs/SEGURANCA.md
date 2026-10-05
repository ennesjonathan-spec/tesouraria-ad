# Segurança e proteção de dados

## Quem vê o quê

| | Administrador / Tesoureiro | Operador | Consulta |
|---|---|---|---|
| Entrar no aplicativo | sim | sim | sim |
| Ver a relação de membros | sim | sim | sim |
| Cadastrar e editar membros | sim | sim | não |
| Registrar recebimentos | sim | sim | não |
| Gerar e compartilhar comprovantes | sim | sim | sim |
| Ver comprovantes | todos | só os que ele emitiu | todos |
| Cancelar comprovante | sim | não | não |
| Relatórios e exportações | sim | sim | sim |
| Editar dados da igreja | sim | não | não |
| Cadastrar e liberar usuários | sim | não | não |
| Ver o registro de auditoria | sim | não | não |

Essas regras não são só telas escondidas: estão escritas no banco como
*Row Level Security*. Mesmo que alguém chame a API por fora do aplicativo, o
banco devolve apenas o que aquele perfil pode ver. Um usuário desativado não lê
mais nada, e quem não fez login não lê absolutamente nada.

## O que o sistema não deixa fazer

- **Apagar comprovante.** Não existe exclusão. O caminho do erro é cancelar
  (com motivo registrado) e emitir um novo, ligado ao cancelado.
- **Editar comprovante emitido.** Nome, data, valores e forma ficam congelados.
- **Apagar membro com histórico.** Ele é inativado; os comprovantes antigos
  continuam válidos e com o nome que tinham na data da emissão.
- **Renomear, inativar ou apagar o NÃO IDENTIFICADO.**
- **Promover a si mesmo.** Só um administrador muda perfil de acesso.
- **Lançar valor zero ou negativo**, ou comprovante sem nenhum item.

Cada uma dessas regras é um gatilho no banco, testado em
`supabase/tests/01_cenarios.sql`.

## Auditoria

Toda inclusão e alteração em membros, comprovantes, itens, usuários e
configurações grava uma linha em `audit_logs` com o usuário, a data, o estado
anterior e o novo. Só o administrador consulta, em **Configurações → Registro de
auditoria**.

## LGPD

Os dados pessoais guardados são o mínimo: nome, telefone (opcional) e uma
observação interna. Isso é dado pessoal comum, e o tratamento se apoia no
legítimo interesse da igreja em registrar as entregas e prestar contas.

O que o aplicativo faz para proteger:

- Nenhuma lista de membros é pública: sem login, não há leitura de nada.
- Nenhum comprovante tem link público permanente. O arquivo é gerado no próprio
  celular e entregue pelo menu de compartilhar.
- **O arquivo compartilhado traz apenas os dados daquele comprovante.** Nome de
  outros membros, totais do mês e qualquer informação interna da tesouraria
  ficam de fora.
- Ao sair do aplicativo, a cópia local de membros e rascunhos é apagada do
  aparelho.
- O aplicativo não envia mensagem sozinho: abrir o WhatsApp e enviar depende
  sempre de um toque da pessoa, com o destinatário à vista.

Se um membro pedir para ser removido, o caminho é **inativar** o cadastro: os
comprovantes já emitidos são registro contábil da igreja e precisam ser
preservados. A inativação tira o nome das buscas e dos novos lançamentos.

## O comprovante não é documento fiscal

O rodapé diz isso de propósito: *"Comprovante emitido pela tesouraria para
registro e confirmação da entrega."* Ele não serve para dedução de imposto de
renda nem substitui recibo fiscal. Não altere esse texto para sugerir o
contrário.

## Senhas e chaves

- A chave `anon public` fica no aplicativo e isso é esperado: ela sozinha não
  abre nada, porque a RLS é quem decide.
- A chave `service_role` **nunca** entra no aplicativo. Ela ignora todas as
  permissões.
- A senha do banco (definida na criação do projeto) só é usada para backup.
