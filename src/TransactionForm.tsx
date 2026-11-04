import { useRef, useState, type FormEvent } from 'react';
import { active, cents, today, type Snapshot } from './domain';
import { CurrencyInput } from './CurrencyInput';
import {CardVisual} from './CardVisual';

function CardChoice({ card, selected, onSelect }: { card: any; selected: boolean; onSelect: () => void }) {
  return <button type="button" aria-pressed={selected} className={'card-choice' + (selected ? ' selected' : '')} onClick={onSelect}>
    <CardVisual card={card}/>
  </button>;
}

export function TransactionForm({ snapshot, userId, initial = {}, onSave, onClose, onAttachReceipt, simple = false }: { snapshot: Snapshot; userId: string; initial?: any; onSave: (payload: any, id?: string) => Promise<void>; onClose: () => void; onAttachReceipt?:()=>void; simple?: boolean }) {
  const operationId = useRef(crypto.randomUUID());
  const [kind, setKind] = useState(initial.kind ?? 'expense');
  const [method, setMethod] = useState(initial.card_id ? 'card' : initial.account_id ? 'account' : 'untracked');
  const [cardId, setCardId] = useState(String(initial.card_id ?? ''));
  const [installments, setInstallments] = useState(Number(initial.installments ?? 1) > 1);
  const [category, setCategory] = useState(String(initial.category ?? ''));
  const [advanced, setAdvanced] = useState(Boolean(initial.kind && initial.kind !== 'expense'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const accounts = active(snapshot, 'accounts').filter(account => account.owner_user_id === userId);
  const cards = active(snapshot, 'cards').filter(card => card.owner_user_id === userId);
  const expenseCategories=[...new Set(['Alimentação','Lanche','Higiene pessoal','Limpeza','Combustível','Moradia','Transporte','Saúde','Lazer','Educação','Outros',...active(snapshot,'categories').map(item=>String(item.name))])];
  const fuel=kind==='expense'&&category==='Combustível';
  const descriptionHints:Record<string,string>={
    'Alimentação':'Ex.: Compra no Supermercado BH',
    'Lanche':'Ex.: Lanche no trabalho',
    'Higiene pessoal':'Ex.: Farmácia / higiene pessoal',
    'Limpeza':'Ex.: Produtos de limpeza',
    'Combustível':'Ex.: Gasolina comum',
    'Moradia':'Ex.: Condomínio',
    'Transporte':'Ex.: Uber ou manutenção',
    'Saúde':'Ex.: Consulta ou medicamento'
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const f = new FormData(e.currentTarget);
      const data: any = {
        kind,
        description: f.get('description'),
        amount_cents: cents(String(f.get('amount'))),
        occurred_on: String(f.get('occurred_on') || initial.occurred_on || today()),
        scope: kind === 'expense' ? 'family' : 'personal',
        category: kind === 'expense' ? category : f.get('category') || 'Outros',
        merchant: f.get('merchant') || '',
      };

      if (kind === 'transfer' || kind === 'income' || kind === 'card_payment' || method === 'account') data.account_id = f.get('account_id');
      if (kind === 'transfer') data.target_account_id = f.get('target_account_id');

      if (kind === 'card_payment' || (kind === 'expense' && method === 'card')) {
        if (!cardId) throw new Error('Escolha o cartão de crédito.');
        data.card_id = cardId;
        data.installments = installments ? Number(f.get('installments') || 1) : 1;
      }

      if (kind === 'card_payment') data.due_on = f.get('due_on');
      if (initial.due_item_id) data.due_item_id = initial.due_item_id;
      if (fuel) {
        const liters=Number(String(f.get('fuel_liters')??'').replace(',','.'));
        if (!Number.isFinite(liters)||liters<=0) throw new Error('Informe a quantidade de litros abastecida.');
        data.fuel_liters=liters;
        data.fuel_unit_cents=cents(String(f.get('fuel_unit_price')??''));
        data.fuel_station=String(f.get('fuel_station')??'').trim();
        const odometer=String(f.get('fuel_odometer')??'').trim();
        if(odometer){if(!/^\d+$/.test(odometer))throw new Error('A quilometragem deve conter apenas números.');data.fuel_odometer=Number(odometer);}
      }

      await onSave(data, operationId.current);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar');
    } finally {
      setBusy(false);
    }
  }

  const chooseMethod = (next: string) => {
    setMethod(next);
    if (next !== 'card') {
      setInstallments(false);
      setCardId('');
    }
  };

  return <section className="editor">
    <div className="row spread">
      <div><p className="eyebrow">LANÇAMENTO RÁPIDO</p><h2>{initial.due_item_id ? 'Pagar conta' : 'Registrar compra ou gasto'}</h2></div>
      <button className="quiet" onClick={onClose}>Fechar</button>
    </div>
    <form onSubmit={submit} className="grid-form">
      {advanced && !initial.due_item_id && <label>Tipo<select value={kind} onChange={e => setKind(e.target.value)}><option value="expense">Despesa / compra</option><option value="income">Receita</option><option value="transfer">Transferência</option><option value="card_payment">Pagamento de fatura</option></select></label>}

      {kind==='expense'&&<fieldset className="quick-methods"><legend>1. Qual é este gasto?</legend><select name="category" required value={category} onChange={event=>setCategory(event.target.value)}><option value="">Escolha a categoria</option>{expenseCategories.map(item=><option key={item} value={item}>{item}</option>)}</select>{category&&<p className="small">{fuel?'Informe os dados do abastecimento; o valor será conferido automaticamente.':`Você está registrando: ${category}.`}</p>}</fieldset>}
      {kind==='expense'&&['Alimentação','Lanche','Higiene pessoal','Limpeza','Saúde'].includes(category)&&<label>{category==='Saúde'?'Clínica, farmácia ou profissional (opcional)':'Onde foi a compra? (opcional)'}<input name="merchant" placeholder={category==='Saúde'?'Ex.: Clínica ou farmácia':'Ex.: Supermercado BH'} defaultValue={initial.merchant ?? ''}/></label>}
      {fuel&&<><label>Litros abastecidos<input name="fuel_liters" required inputMode="decimal" placeholder="Ex.: 32,45" defaultValue={initial.fuel_liters??''}/></label><label>Preço por litro (R$)<CurrencyInput name="fuel_unit_price" required defaultValue={initial.fuel_unit_cents?(Number(initial.fuel_unit_cents)/100).toFixed(2).replace('.',','):''}/></label><label>Posto (opcional)<input name="fuel_station" placeholder="Ex.: Posto X" defaultValue={initial.fuel_station??''}/></label><label>Quilometragem (opcional)<input name="fuel_odometer" inputMode="numeric" defaultValue={initial.fuel_odometer??''}/></label><p className="small">Litros × preço por litro precisam conferir com o valor total. O abastecimento continua sendo uma única despesa.</p></>}
      <label>{category==='Moradia'?'Qual conta ou despesa?':'Descrição'}<input name="description" required maxLength={250} placeholder={descriptionHints[category]??'Ex.: Compra no mercado'} defaultValue={initial.description ?? ''} /></label>
      <label>Valor (R$)<CurrencyInput aria-label="Valor (R$)" name="amount" required defaultValue={initial.amount_cents ? (initial.amount_cents / 100).toFixed(2) : ''} /><small>Digite só os números: 1000 vira R$ 10,00.</small></label>

      {kind === 'expense' && <fieldset className="quick-methods">
        <legend>Como você pagou?</legend>
        <div>
          <button type="button" aria-pressed={method === 'untracked'} onClick={() => chooseMethod('untracked')}>Depois eu vinculo</button>
          <button type="button" aria-pressed={method === 'account'} onClick={() => chooseMethod('account')}>Pix, débito ou dinheiro</button>
          <button type="button" aria-pressed={method === 'card'} onClick={() => chooseMethod('card')}>Cartão de crédito</button>
        </div>
      </fieldset>}

      {(kind === 'income' || kind === 'transfer' || kind === 'card_payment' || method === 'account') && <label>{kind === 'income' ? 'Onde recebeu?' : 'Conta, Pix ou cartão de débito'}<select name="account_id" required defaultValue={initial.account_id ?? ''}><option value="">Selecione</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}

      {kind === 'transfer' && <label>Conta de destino<select name="target_account_id" required defaultValue={initial.target_account_id ?? ''}><option value="">Selecione</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}

      {(kind === 'card_payment' || (kind === 'expense' && method === 'card')) && <fieldset className="card-picker">
        <legend>Escolha o cartão</legend>
        {cards.length ? <div className="card-picker-grid">{cards.map(card => <CardChoice key={card.id} card={card} selected={cardId === card.id} onSelect={() => setCardId(card.id)} />)}</div> : <p className="small">Você ainda não cadastrou um cartão. Adicione-o na aba Cartões.</p>}
      </fieldset>}

      {kind === 'expense' && method === 'card' && <label className="check"><input type="checkbox" checked={installments} onChange={e => setInstallments(e.target.checked)} />Compra parcelada</label>}
      {kind === 'expense' && method === 'card' && installments && <label>Quantidade de parcelas<input name="installments" type="number" min="2" max="120" required defaultValue={initial.installments ?? 2} /><small>As parcelas aparecerão na fatura correta, sem perder centavos.</small></label>}

      <details className="quick-details" open={advanced || Boolean(initial.due_item_id)}>
        <summary>Mais detalhes (opcional)</summary>
        <div className="grid-form quick-details-grid">
          {kind==='income' && <label>Categoria<input name="category" list="categories" defaultValue={initial.category ?? 'Salário'} /><datalist id="categories">{[...new Set(['Salário','Outros',...active(snapshot, 'categories').map(category => category.name)])].map(item => <option key={item} value={item} />)}</datalist></label>}
          {kind==='income' && <label>Origem (opcional)<input name="merchant" placeholder="Ex.: Exército Brasileiro" defaultValue={initial.merchant ?? ''} /></label>}
          <label>Data<input name="occurred_on" type="date" required defaultValue={initial.occurred_on ?? today()} /></label>
          {kind === 'card_payment' && <label>Vencimento da fatura<input name="due_on" type="date" required defaultValue={initial.due_on ?? ''} /></label>}
        </div>
      </details>

      <p className="small">O lançamento é compartilhado com a família. Aqui aparecem somente os seus cartões e contas.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Registrando…' : 'Salvar compra'}</button>
      {kind==='expense'&&!initial.due_item_id&&onAttachReceipt&&<button type="button" className="quiet" onClick={onAttachReceipt}>📷 Ler cupom ou foto da compra</button>}
      {!advanced && !initial.due_item_id && <button type="button" className="quiet" onClick={() => setAdvanced(true)}>Receita, transferência ou pagamento de fatura</button>}
    </form>
  </section>;
}
