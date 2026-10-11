'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('app.js', 'utf8');
const start = app.indexOf('function analyzeQuizReflection(l,text){');
const end = app.indexOf('\nfunction renderQuizReflection', start);
assert(start >= 0 && end > start, 'Could not locate analyzeQuizReflection in app.js');
const source = app.slice(start, end);
const analyze = vm.runInNewContext('(' + source + ')');

const strongAnswers = {
  'model-gry': 'W modelu gry najpierw ustalam cel i zasadę, a potem zachowanie, które można obserwować. Na treningu ćwiczymy przejście z ataku do obrony w grze zadaniowej 6 na 6. Sprawdzam, czy po stracie zespół zabezpiecza centrum i odzyskuje piłkę w pięć sekund. Jeśli rywal omija pressing długim podaniem, cofamy linię i zabezpieczamy głębię.',
  'build-up': 'Gdy rywal naciska dwoma napastnikami, szukamy wolnego zawodnika za pierwszą linią, ponieważ ruch napastników może otworzyć podanie do pomocnika. Na treningu ćwiczymy budowanie od bramki w grze zadaniowej 7 na 6 i obserwujemy, czy pomocnik przyjmuje piłkę przodem. Jeśli rywal zamknie środek, zmieniamy stronę i zabezpieczamy centrum po stracie.',
  'pressing': 'Gdy boczny obrońca rywala przyjmuje piłkę tyłem, skrzydłowy rusza do doskoku, a napastnik zamyka podanie do środka. Na treningu robimy grę 6 na 5 z punktem za odbiór w bocznej strefie. Sprawdzam, czy zespół odzyskuje piłkę w ciągu pięciu sekund. Jeśli rywal zagra długą piłkę, obrońcy zabezpieczają głębię, a pomocnicy zbierają drugą piłkę.',
  'transitions': 'Po stracie najbliższy zawodnik natychmiast doskakuje, a pozostali zabezpieczają centrum i głębię, ponieważ chcemy ograniczyć kontratak. Na treningu robimy grę 5 na 5, w której po stracie zespół ma pięć sekund na odbiór. Sprawdzam liczbę odzyskanych piłek. Jeśli rywal wyjdzie spod kontrpressingu, wracamy do obrony i chronimy przestrzeń za linią.',
  'low-block': 'Przeciw niskiemu blokowi rozciągamy szerokość i szukamy wolnego zawodnika w półprzestrzeni, aby przesunąć linię obrony. Na treningu gramy 7 na 6 na ograniczonej przestrzeni, punktując wejście w pole karne po zmianie strony. Obserwuję, czy pojawiają się wbiegnięcia i podania wycofane. Jeśli rywal zamknie skrzydło, atakujemy centrum lub drugą stronę.',
  'microcycle': 'W mikrocyklu po meczu MD+1 priorytetem jest regeneracja, a obciążenie zależy od minut rozegranych przez zawodników. Na treningu grupuję zawodników według czasu gry i monitoruję obciążenie oraz samopoczucie. Sprawdzam, czy planowana intensywność odpowiada celowi jednostki. Jeśli kolejny mecz jest blisko, skracam objętość i zostawiam świeżość.',
  'opponent-analysis': 'Analizuję rywala, szukając powtarzalnych wzorców i wyzwalaczy pressingu, a nie pojedynczych akcji. Notuję, kiedy przeciwnik zamyka środek i gdzie zostawia wolnego zawodnika. Na podstawie obserwacji przygotowuję plan meczowy i sprawdzam kilka podobnych sytuacji na wideo. Jeśli rywal zmieni pressing, aktualizujemy rozwiązanie i szukamy innej przestrzeni.',
  'player-development': 'W profilu zawodnika zapisuję konkretną mocną stronę i sytuację, w której ją widać, zamiast oceniać go ogólnie. Na treningu wyznaczam cel rozwojowy i ćwiczenie, w którym sprawdzę zachowanie. Po zadaniu notuję obserwowalny dowód i omawiam go z zawodnikiem. Jeśli cel jest za trudny, zmieniam warunek i ustalam następny krok.',
  'set-pieces': 'Przy rzucie rożnym ustawiamy blok i ruch wbiegających, aby stworzyć przewagę w wybranej strefie. Na treningu ćwiczymy dwa warianty stałego fragmentu i zabezpieczenie drugiej piłki. Liczę, czy pierwszy kontakt kierujemy w zaplanowaną strefę. Jeśli rywal broni indywidualnie, zmieniamy blok i timing wbiegnięcia.',
  'coaching': 'W coachingu używam krótkiego komunikatu w momencie, gdy zawodnik może zastosować wskazówkę, zamiast dawać kilka instrukcji naraz. W treningu obserwuję decyzję i zadaję pytanie, które pomaga zawodnikowi samodzielnie ją ocenić. Sprawdzam, czy w następnej próbie rozpoznaje sygnał bez podpowiedzi. Jeśli zawodnik jest przeciążony informacją, skracam komunikat i wracam do jednego priorytetu.'
};

const genericAnswer = 'Piłka nożna jest bardzo ważna i trzeba być dobrym. Zawodnicy muszą ciężko pracować, ponieważ praca daje sukces. Na treningu robimy różne ćwiczenia, aby każdy był lepszy. Jeśli będzie trudno, trzeba spróbować jeszcze raz i zachować motywację.';
const shortAnswer = 'Trzeba znaleźć wolnego zawodnika.';

let checks = 0;
for (const [id, answer] of Object.entries(strongAnswers)) {
  const result = analyze({ id, outcomes: [], principles: [], sections: [] }, answer);
  assert(result.score >= 7, id + ': developed answer should score at least 7/10, got ' + result.score);
  assert.equal(result.score, result.criteria.reduce((sum, criterion) => sum + criterion.score, 0), id + ': total must equal sum of rubric criteria');
  assert.equal(result.criteria.length, 5, id + ': expected five rubric dimensions');
  assert(result.strengths.length > 0, id + ': strengths feedback must not be empty');
  assert(result.improve.length <= 4, id + ': improvement list should stay actionable');
  checks += 4;
}

for (const id of Object.keys(strongAnswers)) {
  const result = analyze({ id, outcomes: [], principles: [], sections: [] }, genericAnswer);
  assert(result.score <= 4, id + ': generic answer should not receive a high score, got ' + result.score);
  checks += 1;
}

const short = analyze({ id: 'build-up', outcomes: [], principles: [], sections: [] }, shortAnswer);
assert.equal(short.confidence, 'niska', 'short answer should have low confidence');
assert(short.improve.some(item => item.includes('zbyt krótka')), 'short answer should explain why more detail is needed');
checks += 2;

const adaptive = analyze({ id: 'build-up', outcomes: [], principles: [], sections: [] }, strongAnswers['build-up']);
assert.equal(adaptive.criteria.find(item => item.name === 'Adaptacja i wariant').score, 2, 'specific opponent adaptation should score fully');
checks += 1;

console.log('PASS: ' + checks + ' coaching-reflection regression assertions across 10 lesson topics, generic answers, short answers and rubric consistency.');
