-- Create talent_payouts table
CREATE TABLE IF NOT EXISTS public.talent_payouts (
    id TEXT PRIMARY KEY DEFAULT ('pay_' || substr(md5(random()::text), 1, 8)),
    talent_id TEXT NOT NULL REFERENCES public.talent(id) ON DELETE CASCADE,
    contract_id TEXT NOT NULL, -- references contracts table
    invoice_id TEXT REFERENCES public.invoices(id) ON DELETE SET NULL,
    gross_amount DECIMAL(10,2) NOT NULL,
    commission_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    net_amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'failed')),
    failure_reason TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create fee_configurations table
CREATE TABLE IF NOT EXISTS public.fee_configurations (
    id TEXT PRIMARY KEY DEFAULT ('fee_' || substr(md5(random()::text), 1, 8)),
    contract_type TEXT NOT NULL UNIQUE, -- e.g., 'global', 'remote-full-time', 'freelance'
    client_fee_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    talent_commission_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    updated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create fee_audit_logs table
CREATE TABLE IF NOT EXISTS public.fee_audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('faud_' || substr(md5(random()::text), 1, 8)),
    config_id TEXT NOT NULL REFERENCES public.fee_configurations(id) ON DELETE CASCADE,
    changed_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    previous_client_fee_pct DECIMAL(5,2),
    new_client_fee_pct DECIMAL(5,2),
    previous_talent_commission_pct DECIMAL(5,2),
    new_talent_commission_pct DECIMAL(5,2),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Fee Configurations
INSERT INTO public.fee_configurations (contract_type, client_fee_pct, talent_commission_pct)
VALUES 
    ('global', 15.00, 5.00),
    ('Remote / Full-time Retainer', 12.00, 0.00),
    ('Fixed-Scope Project', 18.00, 8.00)
ON CONFLICT (contract_type) DO NOTHING;

-- Seed mock payouts
DO $$
DECLARE
    talent_record RECORD;
    new_pay_id TEXT;
    inv_record RECORD;
BEGIN
    FOR talent_record IN SELECT id FROM public.talent LIMIT 5 LOOP
        -- Get a paid invoice to link
        SELECT id INTO inv_record FROM public.invoices WHERE status = 'paid' LIMIT 1;
        
        INSERT INTO public.talent_payouts (talent_id, contract_id, invoice_id, gross_amount, commission_pct, net_amount, payment_method, status, created_at)
        VALUES (talent_record.id, 'cnt_mock_1', inv_record.id, 3500.00, 5.00, 3325.00, 'Bank Transfer', 'pending', NOW() - INTERVAL '2 days');
        
        INSERT INTO public.talent_payouts (talent_id, contract_id, invoice_id, gross_amount, commission_pct, net_amount, payment_method, status, paid_at, created_at)
        VALUES (talent_record.id, 'cnt_mock_2', inv_record.id, 4000.00, 0.00, 4000.00, 'Wise', 'paid', NOW() - INTERVAL '15 days', NOW() - INTERVAL '16 days');
    END LOOP;
END $$;
