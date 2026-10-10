import React, { useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sources } from './AIComponents.jsx'

export function ChatContent({ text, from }) {
  if (from === 'me') return <p className="chat-plain-text">{text}</p>
  return <div className="chat-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
    table: ({ node, ...props }) => <div className="chat-table-scroll"><table {...props} /></div>,
  }}>{text || ''}</Markdown></div>
}

export function ThinkingMessage({ from = 'agent' }) {
  return <div className={`message ${from} thinking-message`} role="status" aria-live="polite">
    <div className="thinking-bubble"><span>思考中</span><span className="thinking-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></div>
  </div>
}

export function ChatMessages({ messages, busy = false, botFrom = 'agent', children }) {
  const thread = useRef(null)
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight
  }, [messages, busy])
  return <div className="messages" ref={thread}>
    {messages.map((message, index) => <div key={index} className={`message ${message.from}`}>
      {message.guidance && <small className="socratic-label">思考引导</small>}
      <ChatContent text={message.text} from={message.from} />
      <Sources refs={message.sourceRefs} status={message.searchStatus} />
      {message.time && <small>{message.time}</small>}
    </div>)}
    {children}
    {busy && <ThinkingMessage from={botFrom} />}
  </div>
}
