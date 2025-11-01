# React Component Integration Guide

Guide for using the AI Chatbot as a standalone React component.

## Installation

The chatbot is distributed as a React component. To use it in your React app:

### Option 1: Direct Import (Same Repository)

```tsx
import { Chatbot } from '../AIChatbot/frontend/components/Chatbot';
```

### Option 2: Copy Components

Copy the `frontend/components` and `frontend/hooks` folders into your project.

### Option 3: Build as Package (Future)

```bash
npm install @learning-yogi/ai-chatbot
```

## Basic Usage

```tsx
import React from 'react';
import { Chatbot } from './components/Chatbot';

function App() {
  return (
    <div className="container">
      <h1>My App</h1>
      <Chatbot apiUrl="http://localhost:9000" />
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiUrl` | `string` | `'http://localhost:9000'` | Chatbot API URL |
| `context` | `ChatContext` | `undefined` | Context for document/project |
| `defaultProvider` | `'claude' \| 'openai' \| 'local'` | `undefined` | Force specific provider |
| `onMessage` | `(message: ChatMessage) => void` | `undefined` | Message callback |
| `className` | `string` | `''` | Additional CSS classes |

## Examples

### With Document Context

```tsx
<Chatbot
  apiUrl="http://localhost:9000"
  context={{
    document_id: "doc-123",
    project: "MyProject"
  }}
/>
```

### Custom Styling

```tsx
<Chatbot
  className="my-chatbot max-w-md mx-auto"
/>
```

### Force Provider

```tsx
<Chatbot
  defaultProvider="openai"
/>
```

### Message Callback

```tsx
<Chatbot
  onMessage={(message) => {
    console.log('New message:', message);
  }}
/>
```

## Using the Hook Directly

For custom UI, use the `useChatbot` hook:

```tsx
import { useChatbot } from './hooks/useChatbot';

function CustomChatUI() {
  const { messages, isLoading, sendMessage } = useChatbot({
    apiUrl: 'http://localhost:9000',
    context: { document_id: 'doc-123' }
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello')}>Send</button>
    </div>
  );
}
```

## Styling

The component uses TailwindCSS. Ensure Tailwind is configured in your project or include the styles:

```css
/* Required Tailwind classes used by chatbot */
```

For custom styling, override with CSS:

```css
.my-chatbot {
  /* Custom styles */
}
```

## Environment Variables

Set `VITE_CHATBOT_API_URL` in your `.env`:

```bash
VITE_CHATBOT_API_URL=http://localhost:9000
```

## TypeScript Types

Import types for TypeScript projects:

```tsx
import type {
  ChatMessage,
  ChatContext,
  ChatRequest,
  ChatResponse
} from './types';
```

## Best Practices

1. **API URL**: Use environment variables for API URL
2. **Error Handling**: Wrap in error boundary
3. **Loading States**: Show loading indicator during initialization
4. **Responsive**: Component is responsive, test on mobile devices
5. **Accessibility**: Component includes ARIA labels

## Troubleshooting

### Component Not Rendering

- Check if API URL is correct
- Verify chatbot service is running
- Check browser console for errors

### No Response from Chatbot

- Verify API is accessible
- Check network tab for failed requests
- Ensure API keys are configured on backend

### Styling Issues

- Ensure TailwindCSS is configured
- Check for CSS conflicts
- Verify all required classes are available

