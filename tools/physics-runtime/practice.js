/* Formative feedback lives in the current page, without a student record. */
(() => {
  const number = text => {
    const value = text.trim().replace(/−/g, '-').replace(/,/g, '.');
    const parts = value.split('/');
    if (parts.length > 2 || parts.some(part => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(part.trim()))) return NaN;
    const values = parts.map(Number);
    if (values.some((n,i) => !Number.isFinite(n) || n === 0 && /[1-9]/.test(parts[i].split(/e/i)[0]))) return NaN;
    return values[0] / (values[1] ?? 1);
  };
  const normalized = value => value.trim().normalize('NFC').toLocaleLowerCase('it').replace(/\s+/g, ' ');
  for (const form of document.querySelectorAll('form[data-practice-answer]')) {
    const output = form.querySelector('output');
    const answer = JSON.parse(form.dataset.practiceAnswer);
    const feedback = new Map(Array.from(form.querySelectorAll('[data-practice-option]'), item => [item.dataset.practiceOption, item]));
    form.addEventListener('input', () => {
      output.textContent = '';
      for (const item of feedback.values()) item.hidden = true;
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const raw = new FormData(form).get('answer');
      if (answer.kind === 'rational') {
        const value = number(raw);
        const expected = number(answer.exact);
        const correct = Number.isFinite(value) && Math.abs(value - expected) <= 1e-9 * Math.abs(expected);
        output.textContent = correct ? 'Risposta corretta.' : 'Il valore non coincide. Controlla l’unità e riprova.';
      } else if (answer.kind === 'text') {
        output.textContent = answer.accepted.some(item => normalized(item) === normalized(raw))
          ? 'Risposta corretta.' : 'Confronta la tua formulazione con la soluzione.';
      } else {
        for (const [id, item] of feedback) item.hidden = id !== raw;
        output.textContent = raw === answer.id ? 'Risposta corretta.' : 'Rivedi la scelta.';
      }
    });
    form.querySelector('button').disabled = false;
  }
  // A deep link opens its question after navigation (including same-page links).
  const openLinkedQuestion = () => {
    const id = location.hash.slice(1);
    const details = document.getElementById(id);
    if (details?.classList.contains('reviewed-question')) details.open = true;
  };
  openLinkedQuestion();
  addEventListener('hashchange', openLinkedQuestion);
})();
