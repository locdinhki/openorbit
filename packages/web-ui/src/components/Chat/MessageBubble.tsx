import type { ChatMessage } from '../../lib/types'

interface Props {
  message: ChatMessage
}

export default function MessageBubble({ message }: Props): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser ? 'ml-12' : 'mr-12'
        }`}
        style={{
          background: isUser ? 'rgba(99, 102, 241, 0.2)' : 'var(--cos-bg-tertiary)',
          color: 'var(--cos-text-primary)'
        }}
      >
        {message.content}
      </div>
    </div>
  )
}
