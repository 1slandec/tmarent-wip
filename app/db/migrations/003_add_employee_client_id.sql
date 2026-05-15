ALTER TABLE employee
ADD COLUMN IF NOT EXISTS client_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'employee_client_id_key'
          AND conrelid = 'employee'::regclass
    ) THEN
        ALTER TABLE employee
        ADD CONSTRAINT employee_client_id_key UNIQUE (client_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'employee_client_id_fkey'
          AND conrelid = 'employee'::regclass
    ) THEN
        ALTER TABLE employee
        ADD CONSTRAINT employee_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES client(client_id);
    END IF;
END $$;
