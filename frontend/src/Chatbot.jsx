import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { getChatbotAnswer } from './api';
import { translate } from './i18n';

const TOPICS = [
  { id: 'verify_payment', question: 'How can I check a payment?' },
  { id: 'otp_safety', question: 'Should I share my PIN or OTP?' },
  { id: 'suspicious_message', question: 'What should I do about a suspicious message?' },
  { id: 'lost_money', question: 'What if I have lost money?' },
];

export default function Chatbot({ lang }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const messagesRef = useRef(null);
  const t = (message) => translate(lang, message);

  useEffect(() => {
    setMessages([]);
    setError(false);
  }, [lang]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const askTopic = async (topic, question) => {
    setMessages((current) => [...current, { question }]);
    setError(false);
    setLoading(true);
    try {
      const response = await getChatbotAnswer(topic, lang);
      setMessages((current) => [...current, { answer: response.answer }]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {isOpen && (
        <section
          aria-label={t('Chat with QRaksha')}
          className="flex h-[min(34rem,70vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-xl"
        >
          <header className="flex items-center justify-between bg-spruce px-4 py-3 text-white">
            <h2 className="font-bold">{t('Chat with QRaksha')}</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t('Close chat')}
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={messagesRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            <p className="rounded-xl bg-canvas p-3 text-sm">{t('Hello! Choose a question to get safety guidance.')}</p>
            {messages.map((message, index) => (
              <React.Fragment key={index}>
                {message.question && (
                  <p className="ml-6 rounded-xl bg-spruce/10 p-3 text-sm">{t(message.question)}</p>
                )}
                {message.answer && (
                  <p className="mr-6 rounded-xl bg-canvas p-3 text-sm">{message.answer}</p>
                )}
              </React.Fragment>
            ))}
            {loading && <p className="rounded-xl bg-canvas p-3 text-sm">{t('Thinking…')}</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{t('I could not load an answer. Please try again.')}</p>}
          </div>

          <div className="space-y-2 border-t border-hairline p-3">
            <p className="text-xs text-ink-muted">{t('Do not enter personal or payment details here.')}</p>
            <div className="flex flex-col gap-2">
              {TOPICS.map(({ id, question }) => (
                <button
                  type="button"
                  key={id}
                  disabled={loading}
                  onClick={() => askTopic(id, question)}
                  className="rounded-xl border border-hairline px-3 py-2 text-left text-sm text-ink hover:bg-canvas disabled:opacity-50"
                >
                  {t(question)}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <button
        type="button"
        aria-label={isOpen ? t('Close chat') : t('Chat with QRaksha')}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-spruce text-white shadow-lg transition-colors hover:bg-spruce-hover"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
