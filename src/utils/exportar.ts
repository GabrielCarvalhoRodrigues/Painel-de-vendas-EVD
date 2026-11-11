import * as XLSX from 'xlsx';

/** Gera e baixa um .xlsx. As linhas são objetos { "Nome da coluna": valor }. */
export async function exportarExcel(nomeArquivo: string, aba: string, linhas: Record<string, string | number | null>[]) {
  const planilha = XLSX.utils.json_to_sheet(linhas);
  const colunas = Object.keys(linhas[0] ?? {});
  planilha['!cols'] = colunas.map((c) => ({
    wch: Math.max(c.length, ...linhas.map((l) => String(l[c] ?? '').length)) + 2,
  }));
  const livro = XLSX.utils.book_new();
  // O Excel não aceita : \ / ? * [ ] no nome da aba, nem mais de 31 caracteres.
  XLSX.utils.book_append_sheet(livro, planilha, aba.replace(/[:\\/?*[\]]/g, '-').slice(0, 31));
  XLSX.writeFile(livro, nomeArquivo);
}
