-- Mappen zijn vanaf nu zelf aan te maken, in plaats van een vaste lijst ("bon",
-- "factuur", "verzekering", ...). Een map kan in een andere map hangen, zodat er
-- bijvoorbeeld een map "Bonnen en facturen" kan zijn met daarin een map per
-- vaarseizoen.
CREATE TABLE IF NOT EXISTS mappen (
  id serial PRIMARY KEY,
  naam text NOT NULL,
  ouder_id integer REFERENCES mappen(id) ON DELETE RESTRICT,
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mappen_ouder_idx ON mappen (ouder_id);

-- Geen twee mappen met dezelfde naam op hetzelfde niveau. `coalesce` omdat NULL (de
-- hoofdmappen) in een unieke index geen waarde heeft om op te botsen.
CREATE UNIQUE INDEX IF NOT EXISTS mappen_naam_uniek
  ON mappen (coalesce(ouder_id, 0), lower(naam));

ALTER TABLE documents ADD COLUMN IF NOT EXISTS map_id integer
  REFERENCES mappen(id) ON DELETE SET NULL;

-- Bestaande documenten krijgen een echte map: één hoofdmap per oude `map`-waarde,
-- behalve "bon" en "factuur" -- die twee gaan samen in een map "Bonnen en facturen"
-- met daarin het eerste vaarseizoen, zodat niets van wat er al stond losraakt.
INSERT INTO mappen (naam)
  SELECT DISTINCT map FROM documents WHERE map NOT IN ('bon', 'factuur');

INSERT INTO mappen (naam)
  SELECT 'Bonnen en facturen' WHERE EXISTS (
    SELECT 1 FROM documents WHERE map IN ('bon', 'factuur')
  );

INSERT INTO mappen (naam, ouder_id)
  SELECT 'Seizoen ' || extract(year FROM now())::text, id
  FROM mappen WHERE naam = 'Bonnen en facturen' AND ouder_id IS NULL;

UPDATE documents SET map_id = (
  SELECT m.id FROM mappen m
  WHERE m.ouder_id IS NULL AND lower(m.naam) = lower(documents.map)
) WHERE documents.map NOT IN ('bon', 'factuur');

UPDATE documents SET map_id = (
  SELECT kind.id FROM mappen kind
  JOIN mappen ouder ON ouder.id = kind.ouder_id
  WHERE ouder.naam = 'Bonnen en facturen' AND ouder.ouder_id IS NULL
) WHERE documents.map IN ('bon', 'factuur');

ALTER TABLE documents DROP COLUMN map;

-- `lib/mappen.ts` zoekt het lopende vaarseizoen op via deze twee instellingen. Waren
-- er al bonnen, dan wijzen ze meteen naar wat hierboven is aangemaakt. Was er nog
-- niets (een verse database), dan blijven ze leeg en maakt `bonnenRootId` /
-- `huidigeBonnenMapId` alles zelf aan zodra iemand voor het eerst een bon indient.
INSERT INTO settings (sleutel, waarde)
  SELECT 'bonnen_root_id', id::text FROM mappen
  WHERE naam = 'Bonnen en facturen' AND ouder_id IS NULL
  ON CONFLICT (sleutel) DO NOTHING;

INSERT INTO settings (sleutel, waarde)
  SELECT 'bonnen_huidig_id', kind.id::text
  FROM mappen kind JOIN mappen ouder ON ouder.id = kind.ouder_id
  WHERE ouder.naam = 'Bonnen en facturen' AND ouder.ouder_id IS NULL
  ON CONFLICT (sleutel) DO NOTHING;
