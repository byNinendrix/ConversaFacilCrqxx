# Versionamento do Sistema

## Objetivo
Registrar cada release aprovada com:
- numero de versao
- data
- titulo
- lista de mudancas implantadas

Esse historico alimenta o modal de versao no menu lateral.

## Fonte oficial
- Arquivo: `backend/config/version-history.json`
- Endpoint: `GET /version`

## Como publicar uma nova versao
Na pasta `backend`, execute:

```bash
npm run release:version -- 5.3.7 "Titulo da release" "Mudanca 1|Mudanca 2|Mudanca 3"
```

Esse comando atualiza automaticamente:
- `backend/config/version-history.json` (versao atual + historico)
- `frontend/package.json` (`versionSystem`)

## Fluxo recomendado
1. Aprovar mudancas no sistema.
2. Rodar comando de release com changelog.
3. Commitar os arquivos alterados.
4. Publicar.

Assim o botao `V: x.x.x` sempre mostra a versao atual e o historico completo.
