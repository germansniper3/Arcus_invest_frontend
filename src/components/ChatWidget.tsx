import { FormEvent, useMemo, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { ChatMessage } from '../types';

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionID = useMemo(() => crypto.randomUUID(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    const current = question;
    setQuestion('');
    setLoading(true);
    try {
      const message = await api.chat(current, sessionID);
      setMessages((items) => [...items, message]);
    } catch {
      setQuestion(current); // restore the unsent question so the user can retry
      toast.error('Arcus Assist is unavailable right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`chat ${open ? 'chat-open' : ''}`}>
      {open && (
        <section className="chat-panel" aria-label="Arcus Assist">
          <div className="chat-head">
            <span><Bot size={18} /> Arcus Assist</span>
            <button onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button>
          </div>
          <div className="chat-log">
            {messages.length === 0 && <p>Ask about quotes, PCB design, workshops, or Innovation Hub enrollment.</p>}
            {messages.map((message) => (
              <article key={message.id || message.question}>
                <strong>{message.question}</strong>
                <span>{message.answer}</span>
              </article>
            ))}
            {loading && <p>Thinking...</p>}
          </div>
          <form onSubmit={submit} className="chat-form">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask Arcus..." />
            <button aria-label="Send message"><Send size={18} /></button>
          </form>
        </section>
      )}
      <button className="chat-launch" onClick={() => setOpen((value) => !value)} aria-label="Open Arcus Assist">
        <Bot size={21} />
      </button>
    </div>
  );
}
