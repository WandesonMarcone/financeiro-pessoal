import { useRef, useState, type FormEvent } from 'react';
import { active, cents, today, type Snapshot } from './domain';
import { CurrencyInput } from './CurrencyInput';

function CardChoice({ card, selected, onSelect }: { card: any; selected: boolean; onSelect: () => void }) {
  const name = String(card.name ?? '');
  const normalized = name.toLowerCase();
  const tone = normalized.includes('nubank') ? 'nubank' : normalized.includes('caixa') ? 'caixa' : normalized.includes('inter') ? 'inter' : normalized.includes('picpay') ? 'picpay' : normalized.includes('mercado') ? 'mercado-pago' : normalized.includes('bradesco') ? 'bradesco' : 'neutral';
  const issuer = normalized.includes('nubank') ? 'NUBANK' : normalized.includes('caixa') ? 'CAIXA' : normalized.includes('inter') ? 'INTER' : normalized.includes('picpay') ? 'PICPAY' : normalized.includes('mercado') ? 'MERCADO PAGO' : normalized.includes('bradesco') ? 'BRADESCO' : 'CARTÃO';

  return <button type="button" aria-pressed={selected} className={'card-choice' + (selected ? ' selected' : '')} onClick={onSelect}>
    <span className={'card-visual ' + tone}>
      <small>{issuer}</small>
      <strong>{name}</strong>
      <small>Cartão de crédito</small>
    </span>
  </button>;
}

export function TransactionForm({ snapshot, userId, initial = {}, onSave, onClose, simple = false }: { snapshot: Snapshot; userId: string; initial?: any; onSave: (payload: any, id?: string) => Promise<void>; onClose: () => void; simple?: boolean }) {
  const operationId = useRef(crypto.randomUUID());
  const [kind, setKind] = useState(initial.kind ?? 'expense');
  const [method, setMethod] = useState(initial.card_id ? 'card' : initial.account_id ? 'account' : 'untracked');
  const [cardId, setCardId] = useState(String(initial.card_id ?? ''));
  const [installments, setInstallments] = useState(Number(initial.installments ?? 1) > 1);
  const [advanced, setAdvanced] = useState(Boolean(initial.kind && initial.kind !== 'expense'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const accounts = active(snapshot, 'accounts').filter(account => account.owner_user_id === userId);
  const cards = active(snapshot, 'cards').filter(card => card.owner_user_id === userId);

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
        category: f.get('category') || 'Outros',
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

      <label>Descrição<input name="description" required maxLength={250} placeholder="Ex.: Compra no mercado" defaultValue={initial.description ?? ''} /></label>
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
          {['expense', 'income'].includes(kind) && <label>Categoria<input name="category" list="categories" defaultValue={initial.category ?? (simple ? 'Outros' : 'Outros')} /><datalist id="categories">{[...new Set(['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Salário', 'Outros', ...active(snapshot, 'categories').map(category => category.name)])].map(category => <option key={category} value={category} />)}</datalist></label>}
          {['expense', 'income'].includes(kind) && <label>Estabelecimento (opcional)<input name="merchant" placeholder="Ex.: Supermercado BH" defaultValue={initial.merchant ?? ''} /></label>}
          <label>Data<input name="occurred_on" type="date" required defaultValue={initial.occurred_on ?? today()} /></label>
          {kind === 'card_payment' && <label>Vencimento da fatura<input name="due_on" type="date" required defaultValue={initial.due_on ?? ''} /></label>}
        </div>
      </details>

      <p className="small">O lançamento é compartilhado com a família. Aqui aparecem somente os seus cartões e contas.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Registrando…' : 'Salvar compra'}</button>
      {!advanced && !initial.due_item_id && <button type="button" className="quiet" onClick={() => setAdvanced(true)}>Receita, transferência ou pagamento de fatura</button>}
    </form>
  </section>;
}
