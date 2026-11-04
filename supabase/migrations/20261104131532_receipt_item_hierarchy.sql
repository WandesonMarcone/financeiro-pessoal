-- Hierarquia explícita: categoria financeira, tipo/canal da compra e grupo
-- do produto. Os campos não alteram a RLS já existente em receipt_items.
alter table public.receipt_items
  add column subcategory text not null default 'Outro' check(length(trim(subcategory)) between 1 and 100),
  add column product_group text not null default 'Outros' check(length(trim(product_group)) between 1 and 100);

create index receipt_items_hierarchy_date_idx
  on public.receipt_items(household_id, category, subcategory, product_group, purchased_on desc)
  where not archived;
