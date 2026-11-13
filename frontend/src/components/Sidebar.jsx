/** Side note shown beside the page. */
export function LearnNote({ onOpenCheat }) {
  return (
    <section className="sticky" style={{ background: 'var(--note-blue)', transform: 'rotate(1deg)' }}>
      <h2 style={{ color: 'var(--blue)', marginBottom: 6 }}>How it works</h2>
      <ol>
        <li>
          Put a description in <b>"quotes"</b>, a French or Arabic word in <b>[brackets]</b>, or an idea in <b>{'{curly brackets}'}</b>
        </li>
        <li>
          Grey text is a suggestion: press <span className="kbd">Tab</span> to keep it
        </li>
        <li>Click any colored word to see a fix</li>
      </ol>
      <button className="tag" type="button" style={{ marginTop: 12 }} onClick={onOpenCheat}>
        open the cheat sheet
      </button>
    </section>
  );
}
