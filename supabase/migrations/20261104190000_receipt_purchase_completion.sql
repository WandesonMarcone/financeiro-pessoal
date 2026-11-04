-- Evita duplicar a compra financeira ao confirmar novamente um cupom.
alter table public.documents
  add column if not exists purchase_operation_id uuid,
  add column if not exists purchase_confirmed_at timestamptz;

create unique index if not exists documents_purchase_operation_once
  on public.documents(purchase_operation_id)
  where purchase_operation_id is not null;
