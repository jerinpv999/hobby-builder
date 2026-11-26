/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";

const say = (text) => {
  const s = window.speechSynthesis;
  if (!s) return;
  s.cancel();
  s.speak(new SpeechSynthesisUtterance(text));
};

/* the conversation panel */
export default function Talk({ person, questions, ask, close }) {
  const [log, setLog] = useState([{ who: person.name, text: person.hello }]);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(false);
  const end = useRef(null);
  const timer = useRef(0);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [log]);
  useEffect(() => () => { clearTimeout(timer.current); window.speechSynthesis?.cancel(); }, []);

  const send = (question, shown = question) => {
    if (!question.trim()) return;
    const answer = ask(question);
    if (!answer) return;
    setLog((l) => [...l, { who: "You", text: shown }, { who: person.name, text: answer.text }].slice(-30));
    if (voice) say(answer.text);
    if (answer.bye) timer.current = setTimeout(close, 1500);
  };

  return (
    <div className="talk">
      <header>
        <b>{person.name}</b> <span>{person.job}</span>
        <label><input type="checkbox" checked={voice} onChange={(e) => { setVoice(e.target.checked); if (e.target.checked) say(log[log.length - 1].text); else window.speechSynthesis?.cancel(); }} /> 🔊 Voice</label>
        <button onClick={close} aria-label="End conversation">✕</button>
      </header>
      <div className="log" aria-live="polite">
        {log.map((m, i) => <p key={i} className={m.who === "You" ? "me" : ""}><b>{m.who}:</b> {m.text}</p>)}
        <div ref={end} />
      </div>
      <div className="asks">
        {questions.map(([id, label]) => <button key={id} onClick={() => send(id, label)}>{label}</button>)}
        {["airport", "park", "hospital", "railway station"].map((p) => <button key={p} onClick={() => send(`Where is the ${p}?`)}>Where is the {p}?</button>)}
        <button onClick={() => send("bye", "Goodbye!")}>Goodbye</button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); setText(""); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type something to say…" aria-label="Your message" maxLength={160} />
        <button type="submit">Say</button>
      </form>
    </div>
  );
}
