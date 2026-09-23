DO $$
DECLARE
  target_schema text := current_schema();
  invoice_table regclass := to_regclass(format('%I.%I', target_schema, 'Invoice'));
  intent_attnum smallint;
  facts text;
BEGIN
  SELECT attnum
    INTO intent_attnum
    FROM pg_attribute
   WHERE attrelid = invoice_table
     AND attname = 'providerPaymentIntentId'
     AND NOT attisdropped;

  SELECT
    (SELECT count(*) FROM pg_class WHERE oid = invoice_table AND relkind = 'r')
    || '|' ||
    (SELECT count(*) FROM pg_inherits WHERE inhparent = invoice_table)
    || '|' ||
    (SELECT count(*)
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = 'Invoice_providerPaymentIntentId_key'
        AND i.indrelid = invoice_table
        AND i.indisunique
        AND i.indisvalid
        AND i.indisready
        AND i.indpred IS NULL
        AND i.indnkeyatts = 1
        AND i.indkey[0] = intent_attnum)
    || '|' ||
    (SELECT count(*)
      FROM pg_index i
      WHERE i.indrelid = invoice_table
        AND i.indisunique
        AND intent_attnum = ANY((i.indkey::int2[])[0:i.indnkeyatts - 1]))
    INTO facts;

  IF facts IS DISTINCT FROM '1|0|1|1' THEN
    RAISE EXCEPTION
      'schema invariant invoice_payment_intent_unique failed in schema %: expected 1|0|1|1, got %',
      target_schema,
      coalesce(facts, '<null>');
  END IF;
END $$;

-- The Invoice assertion above also makes this block non-vacuous: it fails first
-- if current_schema() does not contain the migrated application tables.
DO $$
DECLARE
  target_schema text := current_schema();
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO missing
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = target_schema
     AND c.relkind = 'r'
     AND c.relname <> '_prisma_migrations'
     AND NOT c.relrowsecurity;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'schema invariant rls_enabled_on_all_tables failed in schema %: %',
      target_schema,
      missing;
  END IF;
END $$;
