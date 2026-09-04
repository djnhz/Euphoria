-- Pushmeldingen: per toestel een abonnement, en per gebruiker waar hij bericht
-- van wil. Eén persoon kan meerdere toestellen hebben, dus meerdere rijen.
CREATE TABLE IF NOT EXISTS push_abonnementen (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  toestel text NOT NULL DEFAULT '',
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_abonnementen_user_idx ON push_abonnementen (user_id);

-- Wat iemand wil ontvangen. Standaard aan: de browser vraagt zelf al toestemming,
-- en wie die geeft wil bericht -- daarna kan hij het hier per soort uitzetten.
ALTER TABLE users ADD COLUMN IF NOT EXISTS meld_bon boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meld_taak boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meld_vrijgave boolean NOT NULL DEFAULT true;
