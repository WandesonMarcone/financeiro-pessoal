export const cardTemplates=[
 {id:'nubank',name:'Nubank',issuer:'NUBANK',tone:'nubank'},
 {id:'caixa',name:'Caixa',issuer:'CAIXA',tone:'caixa'},
 {id:'inter',name:'Inter',issuer:'INTER',tone:'inter'},
 {id:'picpay',name:'PicPay',issuer:'PICPAY',tone:'picpay'},
 {id:'mercado-pago',name:'Mercado Pago',issuer:'MERCADO PAGO',tone:'mercado-pago'},
 {id:'itau',name:'Itaú',issuer:'ITAÚ',tone:'itau'},
 {id:'bradesco',name:'Bradesco',issuer:'BRADESCO',tone:'bradesco'},
 {id:'santander',name:'Santander',issuer:'SANTANDER',tone:'santander'},
 {id:'c6',name:'C6 Bank',issuer:'C6 BANK',tone:'c6'},
 {id:'neon',name:'Neon',issuer:'NEON',tone:'neon'},
 {id:'pagbank',name:'PagBank',issuer:'PAGBANK',tone:'pagbank'},
 {id:'btg',name:'BTG Pactual',issuer:'BTG PACTUAL',tone:'btg'},
] as const;

export function cardTemplate(name:string){const normalized=name.toLocaleLowerCase('pt-BR');return cardTemplates.find(template=>normalized.includes(template.id==='mercado-pago'?'mercado':template.id))??{issuer:'SEU CARTÃO',tone:'neutral'};}

export function CardVisual({card}:{card:any}){
 const name=String(card.name??''),template=cardTemplate(name);
 return <div className={'card-visual '+template.tone} aria-label={`Modelo visual do cartão ${name||template.issuer}`}><svg className="card-svg" viewBox="0 0 320 184" role="img" aria-hidden="true"><circle cx="280" cy="-10" r="92" fill="currentColor" opacity=".12"/><circle cx="324" cy="168" r="78" fill="currentColor" opacity=".10"/><text x="24" y="36" className="card-brand">{template.issuer}</text><rect x="24" y="64" width="46" height="34" rx="6" className="card-chip"/><path d="M31 75h32M31 86h32M40 65v32M55 65v32" className="card-chip-lines"/><text x="24" y="136" className="card-number">••••  ••••  ••••  0000</text><text x="24" y="163" className="card-owner">{name||'Cartão de crédito'}</text><path d="M272 138c15-22 30-22 44 0-15 22-30 22-44 0Z" fill="currentColor" opacity=".4"/><path d="M293 138c15-22 30-22 44 0-15 22-30 22-44 0Z" fill="currentColor" opacity=".25"/></svg></div>;
}
