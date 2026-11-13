// Practice page (board 7c): the four tricks a first-time user tries.
export const LESSONS = [
  {
    key: 'd',
    instr: 'Describe a word in "quotes"',
    before: 'I am ',
    trig: '"a person who writes books"',
    after: ' that lives in a garage.',
    title: 'did you mean…',
    bg: 'var(--note-yellow)',
    options: [
      ['an author', '94%'],
      ['a writer', '89%'],
      ['a novelist', '81%'],
    ],
  },
  {
    key: 't',
    instr: 'Write a French or Arabic word in [brackets]',
    before: 'I feel ',
    trig: '[fatigué]',
    after: ' after work.',
    title: 'fatigué · French → English',
    bg: 'var(--note-green)',
    options: [
      ['tired', '96%'],
      ['exhausted', '88%'],
      ['weary', '74%'],
    ],
  },
  {
    key: 'i',
    instr: 'Describe an idiom in {curly brackets}',
    before: 'The exam was ',
    trig: '{something very easy}',
    after: '.',
    title: 'idioms that mean this',
    bg: 'var(--note-pink)',
    options: [
      ['a piece of cake', 'very easy'],
      ['a walk in the park', 'easy'],
      ['child’s play', 'simple'],
    ],
  },
  {
    key: 'g',
    ghost: 'new routine works',
    instr: 'Grey text is a suggestion: press Tab to keep it',
    before: 'The results of the experiment show that the ',
    result: 'new routine works.',
  },
];
