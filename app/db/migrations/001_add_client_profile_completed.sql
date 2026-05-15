ALTER TABLE client
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN;

UPDATE client
SET profile_completed = (
    full_name IS NOT NULL
    AND age IS NOT NULL
    AND license_no IS NOT NULL
);

ALTER TABLE client
ALTER COLUMN profile_completed SET DEFAULT FALSE;

ALTER TABLE client
ALTER COLUMN profile_completed SET NOT NULL;

CREATE OR REPLACE FUNCTION sync_client_profile_completed()
RETURNS TRIGGER AS $$
BEGIN
    NEW.profile_completed = (
        NEW.full_name IS NOT NULL
        AND NEW.age IS NOT NULL
        AND NEW.license_no IS NOT NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_client_profile_completed ON client;

CREATE TRIGGER trg_sync_client_profile_completed
BEFORE INSERT OR UPDATE OF full_name, age, license_no
ON client
FOR EACH ROW
EXECUTE FUNCTION sync_client_profile_completed();
