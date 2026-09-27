/**
 * Catálogo de serviços por plano.
 * ⚠️ Substitua/complete com os serviços reais do seu catálogo — hoje contém
 * apenas os itens de exemplo. Mantenha o padrão { servico, categoria }.
 */
const CATALOG = [
    { servico: 'SEO & Marketing de Conteúdo · Google Meu Negócio', categoria: 'Plano Básico' },
    { servico: 'Gestão de Mídias Sociais · Instagram', categoria: 'Plano Básico' },
    { servico: 'Gestão de Mídias Sociais · Facebook', categoria: 'Plano Básico' },
    { servico: 'Gestão Comercial & Preparação para Vendas · Comercial', categoria: 'Plano Básico' },
    { servico: 'SEO & Marketing de Conteúdo · Google Meu Negócio', categoria: 'Plano Essencial' },
    { servico: 'Gestão Comercial & Preparação para Vendas · Comercial', categoria: 'Plano Essencial' },
    { servico: 'Gestão de Mídias Sociais · Instagram', categoria: 'Plano Essencial' },
    { servico: 'Gestão de Mídias Sociais · Facebook', categoria: 'Plano Essencial' },
    { servico: 'SEO & Marketing de Conteúdo · Google Meu Negócio', categoria: 'Plano Avançado' },
    { servico: 'Gestão de Mídias Sociais · Instagram', categoria: 'Plano Avançado' },
    { servico: 'Gestão Comercial & Preparação para Vendas · Comercial', categoria: 'Plano Avançado' },
    { servico: 'Gestão de Mídias Sociais · Facebook', categoria: 'Plano Avançado' },
    // ⚠️ Complete aqui com os demais serviços do seu catálogo.
];

const PLANOS = [...new Set(CATALOG.map((c) => c.categoria))];

function serviceNamesForPlan(plano) {
    const list = plano ? CATALOG.filter((c) => c.categoria === plano) : CATALOG;
    return [...new Set(list.map((c) => c.servico))];
}

module.exports = { CATALOG, PLANOS, serviceNamesForPlan };
