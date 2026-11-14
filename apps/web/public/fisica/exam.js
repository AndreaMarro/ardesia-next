/* Ardesia · transient, unproctored practice. No storage or account authority. */
(() => {
  'use strict';
  const normalize = value => {
    const text = String(value ?? '').trim().replace(/−/g, '-').replace(',', '.');
    if (!text) return '';
    // Whole-token numeric notation only: no units, Infinity, expressions or prefix parsing.
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) ? String(Object.is(number, -0) ? 0 : number) : null;
  };
  const expired = (session, now) => session.mode === 'timed' && now >= session.deadline;
  const remaining = (session, now) => session.mode === 'timed' ? Math.max(0, Math.ceil((session.deadline - now) / 1000)) : null;
  const grade = (question, answer) => {
    const raw = String(answer ?? '').trim();
    if (!raw) return 'blank';
    if (question.type === 'choice') return raw === question.correctChoice ? 'correct' : 'wrong';
    const number = normalize(raw);
    return number !== null && question.acceptedAnswers.some(expected => {
      const target = Number(normalize(expected));
      return Math.abs(Number(number) - target) <= 1e-9 * Math.max(1, Math.abs(target));
    }) ? 'correct' : 'wrong';
  };
  const summarize = (exam, answers) => {
    const items = exam.questions.map(question => ({id: question.id, answer: String(answers[question.id] ?? ''), verdict: grade(question, answers[question.id])}));
    const counts = {correct: 0, wrong: 0, blank: 0};
    for (const item of items) counts[item.verdict]++;
    return {...counts, score: (counts.correct * 10 - counts.wrong) / 10, items};
  };
  const accept = (session, question, answer, now) => {
    if (session.finished || expired(session, now)) return false;
    if (typeof answer !== 'string' || answer.length > 80) return false;
    if (question.type === 'choice' && answer !== '' && !question.choices.some(c => c.id === answer)) return false;
    session.answers[question.id] = answer;
    return true;
  };
  const createSession = (exam, mode, now) => {
    if (mode !== 'practice' && mode !== 'timed') throw new Error('Invalid mode');
    return {mode, startedAt: now, deadline: mode === 'timed' ? now + exam.durationMinutes * 60_000 : null, answers: {}, flagged: new Set(), index: 0, finished: false};
  };
  const parseData = text => {
    try {
      const source = JSON.parse(text);
      const exam = source?.exam;
      if (!/^[a-f0-9]{64}$/.test(source.sourceSha256 ?? '') || typeof source.sourceFile !== 'string' ||
        !exam || exam.status !== 'DRAFT' || exam.humanApproval !== false || exam.durationMinutes !== 50 ||
        !Array.isArray(exam.questions) || exam.questions.length !== 31 || !Array.isArray(exam.sources)) return null;
      const ids = new Set();
      for (const q of exam.questions) {
        if (typeof q.id !== 'string' || ids.has(q.id) || !/^c[1-5]$/.test(q.courseId) || !/^U[1-7]$/.test(q.syllabusUnit) || !/^sf-2026-u[1-7]-[0-9]{2}$/.test(q.unitId) ||
          ['topic','title','prompt','explanation','recoveryHint'].some(key => typeof q[key] !== 'string')) return null;
        ids.add(q.id);
        if (q.type === 'choice') {
          if (!Array.isArray(q.choices) || q.choices.length !== 5 || q.choices.some((c,i) => c.id !== 'ABCDE'[i] || typeof c.text !== 'string' || typeof c.feedback !== 'string') || !q.choices.some(c => c.id === q.correctChoice)) return null;
        } else if (q.type !== 'completion' || !Array.isArray(q.acceptedAnswers) || !q.acceptedAnswers.length || q.acceptedAnswers.some(value => typeof value !== 'string' || !normalize(value))) return null;
      }
      if (exam.questions.filter(q=>q.type === 'choice').length !== 21) return null;
      return source;
    } catch { return null; }
  };
  const engine = Object.freeze({normalize, expired, remaining, grade, summarize, accept, createSession, parseData});
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  if (typeof document === 'undefined') return;

  const source = parseData(document.getElementById('exam-data')?.textContent ?? '');
  const exam = source?.exam;
  const $ = id => document.getElementById(id);
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  if (!exam) {
    $('load-error').hidden = false;
    return;
  }
  let session = null, tick = null, result = null, lastAnnouncement = null;
  const labels = {correct: 'Corretta', wrong: 'Da rivedere', blank: 'Non risposta'};
  const courseNames = {c1: 'Strumenti e meccanica', c2: 'Fluidi', c3: 'Termodinamica', c4: 'Elettricità e magnetismo', c5: 'Onde, ottica e radiazioni'};
  const announce = text => { $('live-status').textContent = text; };
  const focusHeading = id => { $(id).focus(); };
  const current = () => exam.questions[session.index];
  const answeredCount = () => exam.questions.filter(q => String(session.answers[q.id] ?? '').trim()).length;
  const ensureActive = () => {
    if (!session || session.finished) return false;
    if (expired(session, Date.now())) { finish('timeout'); return false; }
    return true;
  };
  const timerText = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  function updateTime() {
    if (!session || session.finished) return;
    if (!ensureActive()) return;
    const seconds = remaining(session, Date.now());
    $('timer').textContent = seconds === null ? 'Senza limite' : timerText(seconds);
    if (seconds !== null && seconds <= 300) $('timer').classList.add('time-short');
    const threshold = seconds === null ? null : seconds <= 60 ? 'un minuto' : seconds <= 300 ? 'cinque minuti' : null;
    if (threshold && threshold !== lastAnnouncement) {
      lastAnnouncement = threshold;
      announce(`Restano meno di ${threshold}. Alla scadenza la prova viene consegnata automaticamente.`);
    }
  }
  function updateProgress() {
    $('answered-count').textContent = `${answeredCount()} / ${exam.questions.length} risposte`;
    $('progress').value = answeredCount();
    $('flag-count').textContent = `${session.flagged.size} da rivedere`;
    const nav = $('question-nav');
    nav.replaceChildren();
    for (const [i, q] of exam.questions.entries()) {
      const answered = Boolean(String(session.answers[q.id] ?? '').trim());
      const flagged = session.flagged.has(q.id);
      const button = make('button', `${i + 1}${flagged ? ' ⚑' : ''}`, 'number-button');
      button.type = 'button';
      button.dataset.answered = String(answered);
      button.setAttribute('aria-label', `Domanda ${i + 1}: ${answered ? 'risposta inserita' : 'senza risposta'}${flagged ? ', da rivedere' : ''}`);
      if (i === session.index) button.setAttribute('aria-current', 'step');
      button.addEventListener('click', () => { if (ensureActive()) { session.index = i; renderQuestion(); focusHeading('question-title'); } });
      nav.append(button);
    }
  }
  function renderQuestion() {
    if (!ensureActive()) return;
    const q = current();
    $('question-meta').textContent = `${q.courseId.toUpperCase()} · ${q.syllabusUnit} · ${q.topic}`;
    $('question-title').textContent = `${session.index + 1}. ${q.title}`;
    $('question-prompt').textContent = q.prompt;
    const area = $('answer-area');
    area.replaceChildren();
    if (q.type === 'choice') {
      const fieldset = make('fieldset');
      fieldset.append(make('legend', 'Scegli una sola alternativa', 'visually-hidden'));
      for (const option of q.choices) {
        const label = make('label', undefined, 'answer-choice');
        const input = make('input');
        input.type = 'radio'; input.name = 'answer'; input.value = option.id;
        input.checked = session.answers[q.id] === option.id;
        input.addEventListener('change', () => {
          if (!ensureActive()) return;
          if (accept(session, q, option.id, Date.now())) { updateProgress(); $('input-help').textContent = ''; }
          else ensureActive();
        });
        label.append(input, make('span', option.id, 'answer-letter'), make('span', option.text));
        fieldset.append(label);
      }
      area.append(fieldset);
      $('input-help').textContent = '';
    } else {
      const label = make('label', 'La tua risposta numerica', 'completion-label');
      label.htmlFor = 'completion-answer';
      const input = make('input');
      input.type = 'text'; input.id = 'completion-answer'; input.inputMode = 'decimal';
      input.autocomplete = 'off'; input.spellcheck = false; input.maxLength = 80;
      input.value = session.answers[q.id] ?? '';
      input.setAttribute('aria-describedby', 'input-help');
      input.addEventListener('input', () => {
        if (!ensureActive()) return;
        if (!accept(session, q, input.value, Date.now())) { ensureActive(); return; }
        updateProgress();
        const valid = normalize(input.value) !== null;
        input.setAttribute('aria-invalid', String(!valid));
        $('input-help').textContent = valid ? 'Solo il numero, nell’unità già indicata. Virgola e punto sono equivalenti; puoi usare e per la notazione scientifica.' : 'Usa un numero, senza unità o formule (esempio: 2,5 oppure 2.5e1). Puoi correggerlo o lasciare bianco; un testo non valido consegnato è contato come errato.';
      });
      const sign=make('button','± Cambia segno','secondary sign-toggle');
      sign.type='button';sign.setAttribute('aria-label','Cambia segno della risposta numerica');
      sign.addEventListener('click',()=>{
        if(!ensureActive())return;
        const value=input.value.trim();
        const next=/^[-−]/.test(value)?value.slice(1):'-'+value.replace(/^\+/,'');
        if(next.length>input.maxLength){
          const message='Il segno supererebbe il limite di 80 caratteri. Accorcia il numero prima di cambiare segno.';
          $('input-help').textContent=message;announce(message);input.focus();return;
        }
        input.value=next;
        input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
      });
      area.append(label, input, sign);
      const valid = normalize(input.value) !== null;
      input.setAttribute('aria-invalid', String(!valid));
      $('input-help').textContent = valid ? 'Solo il numero, nell’unità già indicata. Virgola e punto sono equivalenti; puoi usare e per la notazione scientifica.' : 'La risposta contiene un formato non valido: correggilo oppure lascia bianco.';
    }
    $('flag-question').setAttribute('aria-pressed', String(session.flagged.has(q.id)));
    $('flag-question').textContent = session.flagged.has(q.id) ? '⚑ Segnata da rivedere' : 'Segna da rivedere';
    $('previous').disabled = session.index === 0;
    $('next').disabled = session.index === exam.questions.length - 1;
    updateProgress(); updateTime();
  }
  function start(mode) {
    session = createSession(exam, mode, Date.now());
    result = null; lastAnnouncement = null;
    $('intro').hidden = true; $('results').hidden = true; $('active-exam').hidden = false;
    $('timer').classList.remove('time-short');
    $('mode-name').textContent = mode === 'timed' ? 'Prova a tempo · 50 minuti' : 'Allenamento · senza timer';
    renderQuestion(); focusHeading('question-title');
    clearInterval(tick); tick = setInterval(updateTime, 500);
    announce(mode === 'timed' ? 'Prova iniziata. Hai cinquanta minuti. Le risposte restano solo in questa pagina.' : 'Allenamento iniziato, senza limite di tempo.');
  }
  function requestSubmit() {
    if (!ensureActive()) return;
    const answered = answeredCount(), blank = exam.questions.length - answered;
    $('submit-summary').textContent = `Hai inserito ${answered} risposte su 31. ${blank} ${blank === 1 ? 'domanda resta bianca' : 'domande restano bianche'}; ${session.flagged.size} da rivedere. Dopo la consegna non puoi modificare questo tentativo.`;
    $('submit-dialog').showModal();
    $('continue-exam').focus();
  }
  function finish(reason) {
    if (!session || session.finished) return;
    // A manual click at/after the deadline is always a timeout, not an extra window.
    if (expired(session, Date.now())) reason = 'timeout';
    session.finished = true;
    const endedAt = Date.now();
    clearInterval(tick);
    if ($('submit-dialog').open) $('submit-dialog').close();
    const summary = summarize(exam, session.answers);
    result = {schemaVersion: 1, kind: 'ardesia-physics-practice-result', examId: exam.id,
      source: {file: source.sourceFile, sha256: source.sourceSha256, status: exam.status, humanApproval: false, sources: exam.sources},
      mode: session.mode, startedAt: new Date(session.startedAt).toISOString(), endedAt: new Date(endedAt).toISOString(),
      deadline: session.deadline === null ? null : new Date(session.deadline).toISOString(), reason,
      elapsedSeconds: Math.max(0, Math.floor(((reason === 'timeout' ? session.deadline : endedAt) - session.startedAt) / 1000)),
      grading: {correct: 1, wrong: -0.1, blank: 0}, ...summary,
      flagged: [...session.flagged], limitations: ['Prova libera non ufficiale', 'Chiavi e dati disponibili nel browser', 'Nessuna identità o competenza certificata', 'Contenuti DRAFT: revisione scientifica umana non completata']};
    $('active-exam').hidden = true; $('results').hidden = false;
    $('result-heading').textContent = reason === 'timeout' ? 'Tempo concluso. Ora ricostruiamo il ragionamento.' : 'La prova finisce. Il ripasso comincia.';
    $('result-score').textContent = summary.score.toLocaleString('it-IT', {maximumFractionDigits: 1});
    $('result-counts').textContent = `${summary.correct} ${summary.correct === 1 ? 'corretta' : 'corrette'} · ${summary.wrong} da rivedere · ${summary.blank} ${summary.blank === 1 ? 'non risposta' : 'non risposte'}`;
    $('result-context').textContent = `${session.mode === 'timed' ? 'Prova a tempo' : 'Allenamento libero'} · ${reason === 'timeout' ? 'consegna automatica alla scadenza' : 'consegna volontaria'}. Punteggio grezzo su 31; non è un voto universitario né una previsione di ammissione.`;
    renderRecovery(summary); renderReview(summary);
    focusHeading('result-heading');
    announce(reason === 'timeout' ? 'Tempo scaduto: risposte consegnate. Puoi leggere il risultato e tutte le spiegazioni.' : 'Prova consegnata. Risultato e spiegazioni disponibili.');
  }
  function renderRecovery(summary) {
    const list = $('recovery-list'); list.replaceChildren();
    const groups = new Map();
    summary.items.forEach((item, index) => {
      if (item.verdict === 'correct') return;
      const q = exam.questions[index];
      if (!groups.has(q.courseId)) groups.set(q.courseId, new Set());
      groups.get(q.courseId).add(q.topic);
    });
    if (!groups.size) {
      list.append(make('li', 'Tutte le risposte di questa prova sono corrette. Prova a spiegare i passaggi senza consultare le soluzioni: questa singola prova non certifica la padronanza dell’intero programma.'));
      return;
    }
    for (const [course, topics] of groups) {
      const item = make('li');
      const link = make('a', `${course.toUpperCase()} · ${courseNames[course]} →`);
      link.href = `./${course}.html#programma`;
      item.append(link, make('p', [...topics].join(' · ')));
      list.append(item);
    }
  }
  function renderReview(summary) {
    const list = $('review-list'); list.replaceChildren();
    summary.items.forEach((item, index) => {
      const q = exam.questions[index];
      const article = make('details', undefined, `review-item verdict-${item.verdict}`);
      const heading = make('summary', `${index + 1}. ${q.title} — ${labels[item.verdict]}`);
      article.append(heading, make('p', q.prompt, 'review-prompt'));
      const answer = item.answer.trim();
      if (q.type === 'choice') {
        const selectedOption = q.choices.find(c => c.id === answer);
        const correct = q.choices.find(c => c.id === q.correctChoice);
        article.append(make('p', selectedOption ? `La tua scelta: ${selectedOption.id}. ${selectedOption.text}` : 'Non hai risposto.', 'your-answer'));
        if (selectedOption) article.append(make('p', selectedOption.feedback, 'answer-feedback'));
        article.append(make('p', `Risposta corretta: ${correct.id}. ${correct.text}`, 'correct-answer'));
        const alternatives = make('details', undefined, 'alternatives');
        alternatives.append(make('summary', 'Capire anche le altre alternative'));
        const ul = make('ul');
        for (const choice of q.choices) ul.append(make('li', `${choice.id}. ${choice.text} — ${choice.feedback}`));
        alternatives.append(ul); article.append(alternatives);
      } else {
        article.append(make('p', answer ? `La tua risposta: ${answer}` : 'Non hai risposto.', 'your-answer'));
        article.append(make('p', `Valore corretto: ${q.acceptedAnswers[0]}, nell’unità richiesta.`, 'correct-answer'));
      }
      article.append(make('h3', 'Il ragionamento'), make('p', q.explanation), make('h3', 'Il prossimo passo'), make('p', q.recoveryHint));
      const link = make('a', `Riprendi la lezione: ${q.topic} →`); link.href = `./${q.unitId}.html`;
      article.append(link); list.append(article);
    });
  }
  function downloadResult() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2) + '\n'], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = make('a'); a.href = url; a.download = `ardesia-${exam.id}-${result.startedAt.slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Risultato esportato in JSON con risposte, provenienza e limiti della prova.');
  }
  $('start-practice').disabled = false; $('start-timed').disabled = false;
  $('start-practice').addEventListener('click', () => start('practice'));
  $('start-timed').addEventListener('click', () => start('timed'));
  $('previous').addEventListener('click', () => { if (ensureActive() && session.index > 0) { session.index--; renderQuestion(); focusHeading('question-title'); } });
  $('next').addEventListener('click', () => { if (ensureActive() && session.index < exam.questions.length - 1) { session.index++; renderQuestion(); focusHeading('question-title'); } });
  $('clear-answer').addEventListener('click', () => {
    if (!ensureActive()) return;
    if (!accept(session, current(), '', Date.now())) { ensureActive(); return; }
    renderQuestion(); focusHeading('question-title'); announce('Risposta rimossa: la domanda resta bianca.');
  });
  $('flag-question').addEventListener('click', () => {
    if (!ensureActive()) return;
    const id = current().id;
    if (session.flagged.has(id)) session.flagged.delete(id); else session.flagged.add(id);
    $('flag-question').setAttribute('aria-pressed', String(session.flagged.has(id)));
    $('flag-question').textContent = session.flagged.has(id) ? '⚑ Segnata da rivedere' : 'Segna da rivedere';
    updateProgress();
  });
  $('submit-exam').addEventListener('click', requestSubmit);
  $('continue-exam').addEventListener('click', () => { $('submit-dialog').close(); if (ensureActive()) $('submit-exam').focus(); });
  $('confirm-submit').addEventListener('click', () => { if (ensureActive()) finish('manual'); });
  $('submit-dialog').addEventListener('cancel', () => { if (ensureActive()) $('submit-exam').focus(); });
  $('export-result').addEventListener('click', downloadResult);
  $('new-attempt').addEventListener('click', () => {
    $('restart-dialog').showModal(); $('keep-result').focus();
  });
  $('keep-result').addEventListener('click', () => { $('restart-dialog').close(); $('new-attempt').focus(); });
  $('confirm-restart').addEventListener('click', () => {
    $('restart-dialog').close(); session = null; result = null;
    $('results').hidden = true; $('intro').hidden = false; focusHeading('intro-heading');
    announce('Pronto per un nuovo tentativo. Il precedente risultato è stato rimosso dalla pagina.');
  });
  document.addEventListener('visibilitychange', updateTime);
  window.addEventListener('focus', updateTime);
  window.addEventListener('pageshow', updateTime);
  window.addEventListener('beforeunload', event => {
    if (session && !session.finished) { event.preventDefault(); event.returnValue = ''; }
  });
})();
