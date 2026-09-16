-- Een begroting bestond uit één bedrag per post per jaar. Vaak wil je laten zien
-- hoe je aan dat bedrag komt -- "haalbeurt 350, poetsen 120, antifouling 180" --
-- zonder daar drie boekbare posten voor aan te maken. Een rij in deze tabel is
-- daarom voortaan een regel, en het bedrag van een post is de som van zijn regels.
--
-- `naam IS NULL` betekent: het losse bedrag van de post, zoals het altijd was.
-- `naam = ''` of tekst betekent: een begrotingsregel. Een nieuwe regel begint zonder
-- naam, dus de lege string kan de markering niet zijn -- vandaar NULL.
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS naam text;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS volgorde integer NOT NULL DEFAULT 0;

-- De oude unique stond één rij per post toe; dat is nu juist een lijst. Hij wordt
-- vervangen door een partiële: het lósse bedrag blijft uniek per post en per jaar.
-- Zonder die index zou het opslaan-tijdens-typen bij een dubbele afvuring (de timer
-- én het verlaten van het veld) twee rijen maken, en dan verdubbelt het bedrag
-- stilletjes.
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_jaar_post;
CREATE UNIQUE INDEX IF NOT EXISTS budgets_jaar_post_los
  ON budgets (jaar, post_id) WHERE naam IS NULL;
CREATE INDEX IF NOT EXISTS budgets_jaar_idx ON budgets (jaar);

-- Bestaande rijen houden naam NULL en blijven dus exact wat ze waren.
