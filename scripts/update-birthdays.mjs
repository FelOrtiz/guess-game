import { readFile, writeFile } from 'node:fs/promises';

const assetUrl = new URL('../src/assets/character.json', import.meta.url);
const characters = JSON.parse(await readFile(assetUrl, 'utf8'));
const candidates = new Map();
const fictionalCategories = new Set(['Superhéroes y villanos', 'Videojuegos', 'Personajes animados']);
// Exact dates checked against the linked Wikidata items. These names either differ
// from the Wikidata article title or have conflicting/duplicate statements.
const verifiedBirthdays = new Map([
  ['Alicia Keys', { date: '1981-01-25', item: 'Q121507' }],
  ['Daddy Yankee', { date: '1976-02-03', item: 'Q272591' }],
  ['Lady Gaga', { date: '1986-03-28', item: 'Q19848' }],
  ['Iósif Stalin', { date: '1878-12-18', item: 'Q855' }],
  ['Lady Di', { date: '1961-07-01', item: 'Q9685' }],
  ['Isabel II', { date: '1926-04-21', item: 'Q9682' }],
  ['María Sharapova', { date: '1987-04-19', item: 'Q11666' }],
  ['Neymar Jr.', { date: '1992-02-05', item: 'Q142794' }],
  ['Shaquille O’Neal', { date: '1972-03-06', item: 'Q169452' }],
  ['Pedro Ruminot', { date: '1981-02-04', item: 'Q41746204' }],
  ['Dino Gordillo', { date: '1960-02-26', item: 'Q5807389' }],
  ['Benjamín Vicuña', { date: '1977-11-29', item: 'Q4889503' }],
  ['Fernando Godoy', { date: '1983-06-30', item: 'Q940361' }],
]);

function sparqlFor(names) {
  const labels = names.flatMap(name => ['en', 'es'].map(language => `${JSON.stringify(name)}@${language}`));
  return `SELECT ?label ?person ?birth WHERE {
    VALUES ?label { ${labels.join(' ')} }
    ?person rdfs:label ?label;
      wdt:P31 wd:Q5;
      p:P569 ?statement.
    ?statement psv:P569 ?value.
    ?value wikibase:timeValue ?birth; wikibase:timePrecision ?precision.
    FILTER(?precision = 11)
  }`;
}

function wikipediaSparqlFor(names) {
  const articles = names.flatMap(name => ['en', 'es'].map(language =>
    `(${JSON.stringify(name)} <https://${language}.wikipedia.org/wiki/${encodeURIComponent(name.replaceAll(' ', '_'))}>)`));
  return `SELECT ?name ?person ?birth WHERE {
    VALUES (?name ?article) { ${articles.join(' ')} }
    ?article schema:about ?person.
    ?person wdt:P31 wd:Q5; p:P569 ?statement.
    ?statement psv:P569 ?value.
    ?value wikibase:timeValue ?birth; wikibase:timePrecision ?precision.
    FILTER(?precision = 11)
  }`;
}

async function queryWikidata(query) {
  const url = new URL('https://query.wikidata.org/sparql');
  url.searchParams.set('query', query);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'GuessGameBirthdayUpdater/1.0 (local data maintenance)',
    },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status}`);
  return (await response.json()).results.bindings;
}

for (let offset = 0; offset < characters.length; offset += 25) {
  const names = characters.slice(offset, offset + 25)
    .filter(character => !fictionalCategories.has(character.category))
    .map(character => character.name);
  if (!names.length) continue;
  const labelRows = await queryWikidata(sparqlFor(names));
  const wikipediaRows = await queryWikidata(wikipediaSparqlFor(names));
  for (const row of [...labelRows, ...wikipediaRows]) {
    const name = row.label?.value ?? row.name.value;
    const birth = row.birth.value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) continue;
    const matches = candidates.get(name) ?? new Map();
    const key = `${row.person.value}|${birth}`;
    const existing = matches.get(key);
    matches.set(key, { person: row.person.value, birth, wikipedia: !!row.name || !!existing?.wikipedia });
    candidates.set(name, matches);
  }
}

let filled = 0;
const ambiguous = [];
for (const character of characters) {
  const matches = [...(candidates.get(character.name)?.values() ?? [])];
  const ageRaw = character.age;
  const previousBirthday = character.birthday;
  const age = /≈(\d+)[–-](\d+) \(2026\)/.exec(ageRaw);
  const preferred = matches.some(match => match.wikipedia) ? matches.filter(match => match.wikipedia) : matches;
  const eligible = preferred.some(match => match.wikipedia)
    ? preferred
    : age
    ? preferred.filter(match => {
        const birthYear = Number(match.birth.slice(0, 4));
        const youngest = Math.min(Number(age[1]), Number(age[2]));
        const oldest = Math.max(Number(age[1]), Number(age[2]));
        return birthYear >= 2026 - oldest && birthYear <= 2026 - youngest;
      })
    : preferred;
  const distinct = [...new Set(eligible.map(match => match.birth))];
  character.birthday = fictionalCategories.has(character.category)
    ? null
    : verifiedBirthdays.get(character.name)?.date ?? previousBirthday ?? (distinct.length === 1 && eligible.length === 1 ? distinct[0] : null);
  delete character.age;
  if (character.birthday) filled++;
  else if (matches.length) ambiguous.push({ name: character.name, age: ageRaw, matches });
}

console.log(JSON.stringify({
  total: characters.length,
  filled,
  unmatched: characters.length - filled,
  unmatchedNames: characters.filter(character => !character.birthday).map(({ name, category }) => `${category}: ${name}`),
  ambiguous: ambiguous.map(({ name, age, matches }) => ({ name, age, candidates: matches.length })),
}, null, 2));
if (process.argv.includes('--write')) {
  await writeFile(assetUrl, `${JSON.stringify(characters, null, 2)}\n`);
}
