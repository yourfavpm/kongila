-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY DEFAULT ('inv_' || substr(md5(random()::text), 1, 8)),
    client_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
    is_disputed BOOLEAN DEFAULT false,
    dispute_reason TEXT,
    subtotal_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax_amount_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id TEXT PRIMARY KEY DEFAULT ('invli_' || substr(md5(random()::text), 1, 8)),
    invoice_id TEXT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    talent_id TEXT REFERENCES public.talent(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount_usd DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Clients can view their own invoices
CREATE POLICY "Clients can view their own invoices" 
    ON public.invoices FOR SELECT 
    USING (auth.uid() = client_id);

-- Clients can update their own invoices (only to mark paid or dispute)
CREATE POLICY "Clients can update their own invoices"
    ON public.invoices FOR UPDATE
    USING (auth.uid() = client_id);

-- Admins can do everything on invoices
CREATE POLICY "Admins have full access to invoices" 
    ON public.invoices FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'ops_manager')
        )
    );

-- Clients can view line items of their own invoices
CREATE POLICY "Clients can view line items for their invoices" 
    ON public.invoice_line_items FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices 
            WHERE invoices.id = invoice_line_items.invoice_id 
            AND invoices.client_id = auth.uid()
        )
    );

-- Admins can do everything on line items
CREATE POLICY "Admins have full access to invoice line items" 
    ON public.invoice_line_items FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'ops_manager')
        )
    );

-- Seed Database with mock invoices for existing clients
DO $$
DECLARE
    client_record RECORD;
    new_inv_id TEXT;
    talent_record RECORD;
BEGIN
    FOR client_record IN SELECT id FROM public.users WHERE role = 'client' LOOP
        -- Get a random talent to assign line items
        SELECT * INTO talent_record FROM public.talent LIMIT 1;
        
        -- Insert a paid invoice
        INSERT INTO public.invoices (client_id, invoice_number, status, subtotal_usd, tax_amount_usd, total_usd, due_date, created_at)
        VALUES (client_record.id, 'INV-' || upper(substr(md5(random()::text), 1, 6)), 'paid', 3500.00, 700.00, 4200.00, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '40 days')
        RETURNING id INTO new_inv_id;

        INSERT INTO public.invoice_line_items (invoice_id, talent_id, description, amount_usd)
        VALUES (new_inv_id, talent_record.id, 'Senior Fullstack Engineer - March 2026', 3500.00);

        -- Insert a sent (pending) invoice
        INSERT INTO public.invoices (client_id, invoice_number, status, subtotal_usd, tax_amount_usd, total_usd, due_date, created_at)
        VALUES (client_record.id, 'INV-' || upper(substr(md5(random()::text), 1, 6)), 'sent', 4000.00, 800.00, 4800.00, CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE)
        RETURNING id INTO new_inv_id;

        INSERT INTO public.invoice_line_items (invoice_id, talent_id, description, amount_usd)
        VALUES (new_inv_id, talent_record.id, 'Senior Fullstack Engineer - April 2026', 3200.00);
        
        INSERT INTO public.invoice_line_items (invoice_id, talent_id, description, amount_usd)
        VALUES (new_inv_id, NULL, 'Kongila Managed Service Fee', 800.00);

        -- Insert an overdue invoice
        INSERT INTO public.invoices (client_id, invoice_number, status, subtotal_usd, tax_amount_usd, total_usd, due_date, created_at)
        VALUES (client_record.id, 'INV-' || upper(substr(md5(random()::text), 1, 6)), 'overdue', 1500.00, 300.00, 1800.00, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '30 days')
        RETURNING id INTO new_inv_id;

        INSERT INTO public.invoice_line_items (invoice_id, talent_id, description, amount_usd)
        VALUES (new_inv_id, talent_record.id, 'Consulting Flex Plan', 1500.00);
        
    END LOOP;
END $$;
