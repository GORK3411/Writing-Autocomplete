// Sample document shown until the backend is connected.
// The shape below (paragraphs → sentences → tokens) is what the backend's
// analysis should return, so the UI does not need to change later.
//
// Inline markup in the source strings:
//   {g:from|to}  grammar        (red squiggle)        feature 9
//   {s:from|to}  spelling       (red squiggle)        feature 9
//   {b:from|to}  better word    (blue marker)         feature 8
//   {h:from|to}  hard word      (yellow marker)       feature 7
//   {t:key}      trigger "..." / [...] / {...}        features 1–3
// A number is a hard sentence (pink), index into HARD     feature 6
// { ghost } is the autocomplete line                      feature 4

export const TITLE = 'My first year in the city';

export const ISSUE_TYPES = {
  g: { label: 'grammar', cls: 'u-err', bg: 'var(--note-red)', color: 'var(--red)' },
  s: { label: 'spelling', cls: 'u-err', bg: 'var(--note-red)', color: 'var(--red)' },
  b: { label: 'better word', cls: 'u-better', bg: 'var(--note-blue)', color: 'var(--blue)' },
  h: { label: 'hard word', cls: 'u-hard', bg: 'var(--note-yellow)', color: 'var(--ochre)' },
};

export const TRIGGERS = {
  desc: {
    raw: '"a person who writes books"',
    title: 'did you mean…',
    bg: 'var(--note-yellow)',
    color: 'var(--blue)',
    note: 'grammar around it (a → an) is fixed for you',
    options: [
      ['an author', '94%'],
      ['a writer', '89%'],
      ['a novelist', '81%'],
    ],
  },
  trans: {
    raw: '[fatigué]',
    title: 'fatigué · French → English',
    bg: 'var(--note-green)',
    color: 'var(--green)',
    options: [
      ['tired', '96%'],
      ['exhausted', '88%'],
      ['weary', '74%'],
    ],
  },
  idiom: {
    raw: '{something very easy}',
    title: 'idioms that mean this',
    bg: 'var(--note-pink)',
    color: 'var(--rose)',
    stacked: true,
    options: [
      ['a piece of cake', 'very easy'],
      ['a walk in the park', 'easy and pleasant'],
      ['child’s play', 'so simple a child could do it'],
    ],
  },
};

export const HARD = [
  {
    orig: 'Notwithstanding my initial apprehension regarding the metropolitan environment, I endeavoured to acclimatise myself expeditiously to its multifarious demands.',
    versions: [
      'Even though I was nervous about the big city, I tried to get used to it quickly.',
      'I was nervous about the city, but I tried to adapt fast.',
      'I was nervous, but I tried to fit in fast.',
    ],
  },
  {
    orig: 'The ramifications of this transition were not merely logistical but encompassed profound psychological and socioeconomic dimensions that I had hitherto underestimated.',
    versions: [
      'This move changed more than my address; it affected my feelings and my money in ways I did not expect.',
      'The move affected my feelings and money more than I expected.',
      'The move was harder than I expected.',
    ],
  },
  {
    orig: 'Consequently, the preponderance of my apprehensions dissipated, notwithstanding the occasional recrudescence of homesickness during protracted winter evenings.',
    versions: [
      'So most of my worries went away, though I still felt homesick on some long winter evenings.',
      'Most of my worries went away, but I felt homesick on long winter nights.',
      'My worries faded, but winter nights made me homesick.',
    ],
  },
  {
    orig: 'In retrospect, the multifaceted challenges I encountered were instrumental in cultivating a degree of resilience that I had not previously anticipated possessing.',
    versions: [
      'Looking back, the many challenges I faced helped me become stronger than I expected.',
      'Looking back, my challenges made me stronger than I expected.',
      'These challenges made me stronger.',
    ],
  },
];

export const VERSION_LABELS = ['keeps the detail', 'simpler', 'shortest'];

const SRC = [
  [
    'When I first {g:arrive|arrived} in the city, everything {g:seem|seemed} {b:very big|enormous} and {b:very loud|deafening}.',
    'I {s:didnt|didn’t} know {g:no one|anyone}, and the streets {g:was|were} full of people who {g:walks|walked} {s:quikly|quickly} without looking up.',
    0,
    'My apartment was {b:small|cramped}, but {g:it have|it had} a window {s:wich|which} looked over a {b:nice|leafy} park.',
    'Every morning I {h:utilized|used} the subway, {s:alltough|although} it was {b:really crowded|packed}.',
  ],
  [
    'I am {t:desc}, so I wrote about the city every night.',
    'Some days I felt {t:trans} after work, but writing was {t:idiom} for me.',
    1,
  ],
  [
    'I {h:commenced|started} a new job at a bakery and {s:recieved|received} my first {s:paycheque|paycheck} after two {g:week|weeks}.',
    'My {s:colegues|colleagues} {g:was|were} kind and {h:facilitated|helped} my adjustment.',
    2,
    'Now I {h:endeavour|try} to {h:ascertain|find out} new places every {g:weekends|weekend}, and I feel {b:very happy|delighted} {g:to living|to live} here.',
    3,
  ],
  [{ ghost: { before: 'Next year, I want to', parts: [' explore the rest of the country', ' and write a book about it.'] } }],
];

// Parse once into a static model.
function parse() {
  let n = 0;
  const issues = [];
  const re = /\{([gsbht]):([^|}]+)(?:\|([^}]+))?\}/g;
  const paragraphs = SRC.map((sentences) =>
    sentences.map((src) => {
      if (typeof src === 'number') return { kind: 'hard', index: src };
      if (typeof src === 'object') return { kind: 'ghost', ...src.ghost };
      const tokens = [];
      let last = 0;
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(src))) {
        if (m.index > last) tokens.push({ kind: 'text', text: src.slice(last, m.index) });
        if (m[1] === 't') {
          tokens.push({ kind: 'trigger', key: m[2] });
        } else {
          const issue = { id: 'fx' + ++n, type: m[1], from: m[2], to: m[3] };
          issues.push(issue);
          tokens.push({ kind: 'issue', issue });
        }
        last = re.lastIndex;
      }
      if (last < src.length) tokens.push({ kind: 'text', text: src.slice(last) });
      return { kind: 'normal', tokens };
    })
  );
  return { paragraphs, issues };
}

export const MODEL = parse();
