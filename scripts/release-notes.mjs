/**
 * Extrai do CHANGELOG.md a secção de uma versão, para o CI a usar como corpo
 * da release. Uso: node scripts/release-notes.mjs v1.1.5
 *
 * Escreve a secção no stdout. Sai com código 1 (sem escrever nada) quando não
 * há secção para a tag — cabe a quem chama decidir se isso é um erro.
 */
import { readFileSync } from "node:fs";

const tag = process.argv[2];
if (!tag) {
  console.error("Falta a tag. Uso: node scripts/release-notes.mjs v1.1.5");
  process.exit(2);
}

const linhas = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").split(/\r?\n/);

// O cabeçalho da versão é `## <tag>`; a secção vai daí até ao `##` seguinte.
const inicio = linhas.findIndex((l) => l.trim() === `## ${tag}`);
if (inicio === -1) {
  console.error(`Sem secção "## ${tag}" no CHANGELOG.md`);
  process.exit(1);
}

const resto = linhas.slice(inicio + 1);
const fim = resto.findIndex((l) => l.startsWith("## "));
const corpo = (fim === -1 ? resto : resto.slice(0, fim)).join("\n").trim();

if (!corpo) {
  console.error(`A secção "## ${tag}" está vazia`);
  process.exit(1);
}

process.stdout.write(corpo + "\n");
