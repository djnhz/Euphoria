-- De takenlijst: klusjes voor onderweg, onderhoud en de winterklaarlijst.
CREATE TABLE IF NOT EXISTS taken (
  id serial PRIMARY KEY,
  titel text NOT NULL,
  toelichting text NOT NULL DEFAULT '',
  post_id integer REFERENCES posten(id) ON DELETE SET NULL,
  deadline date,
  soort text NOT NULL DEFAULT 'gewoon',
  samen boolean NOT NULL DEFAULT false,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  couple_id integer REFERENCES couples(id),
  klaar boolean NOT NULL DEFAULT false,
  klaar_op timestamptz,
  klaar_door integer REFERENCES users(id) ON DELETE SET NULL,
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS taken_klaar_idx ON taken (klaar);

-- Wie zich heeft aangemeld voor een klus die je samen doet.
CREATE TABLE IF NOT EXISTS taak_helpers (
  id serial PRIMARY KEY,
  taak_id integer NOT NULL REFERENCES taken(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT taak_helpers_taak_user UNIQUE (taak_id, user_id)
);
