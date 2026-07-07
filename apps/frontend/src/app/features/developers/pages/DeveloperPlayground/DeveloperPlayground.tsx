'use client';
import React, { useEffect, useState } from 'react';

import { Button, Card, Input, Text } from '@/app/ui';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { runAgentTurn } from '@/app/features/developers/playground/agentLoop';
import type {
  ChatMessage,
  ContentBlock,
} from '@/app/features/developers/playground/anthropicClient';
import {
  clearPlaygroundKeys,
  getDefaultBaseUrl,
  getDefaultPlaygroundSettings,
  loadPlaygroundSettings,
  PLAYGROUND_MODELS,
  savePlaygroundSetting,
  type PlaygroundSettingField,
  type PlaygroundSettings,
} from '@/app/features/developers/playground/playgroundSession';

import '@/app/features/organizations/styles/Organizations.css';

const TOOL_RESULT_PREVIEW_LIMIT = 300;

const truncate = (value: string): string =>
  value.length > TOOL_RESULT_PREVIEW_LIMIT
    ? `${value.slice(0, TOOL_RESULT_PREVIEW_LIMIT)}...`
    : value;

const renderBlock = (block: ContentBlock, key: string) => {
  if (block.type === 'text') {
    return (
      <Text key={key} as="p" variant="body-4" className="whitespace-pre-wrap text-text-primary">
        {block.text}
      </Text>
    );
  }
  if (block.type === 'tool_use') {
    return (
      <Text key={key} as="p" variant="caption-2" className="text-text-tertiary">
        Tool call: {block.name}
      </Text>
    );
  }
  return (
    <Text
      key={key}
      as="p"
      variant="caption-2"
      className={block.is_error ? 'text-text-error' : 'text-text-tertiary'}
    >
      {block.is_error ? `Tool error: ${block.content}` : `Tool result: ${truncate(block.content)}`}
    </Text>
  );
};

const DeveloperPlayground = () => {
  const [settings, setSettings] = useState<PlaygroundSettings>(getDefaultPlaygroundSettings);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSettings(loadPlaygroundSettings());
  }, []);

  const updateSetting = (field: PlaygroundSettingField, value: string) => {
    setSettings((previous) => ({ ...previous, [field]: value }));
    savePlaygroundSetting(field, value);
  };

  const handleClear = () => {
    setMessages([]);
    setNotice(null);
  };

  const handleForgetKeys = () => {
    clearPlaygroundKeys();
    setSettings((previous) => ({ ...previous, anthropicKey: '', yosemiteKey: '' }));
    setNotice('API keys cleared from this browser session.');
  };

  const handleSend = async () => {
    const prompt = draft.trim();
    if (!prompt || busy) return;
    if (!settings.anthropicKey.trim() || !settings.yosemiteKey.trim()) {
      setNotice('Add both API keys in the setup panel before starting a conversation.');
      return;
    }

    setNotice(null);
    setDraft('');
    setBusy(true);

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ];
    setMessages(nextMessages);

    try {
      const result = await runAgentTurn(
        nextMessages,
        {
          anthropicKey: settings.anthropicKey.trim(),
          yosemiteKey: settings.yosemiteKey.trim(),
          baseUrl: settings.baseUrl.trim() || getDefaultBaseUrl(),
          model: settings.model,
        },
        (progress) => setMessages(progress)
      );
      setMessages(result);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Something went wrong while contacting the Anthropic API.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <h1 className="text-heading-1 text-text-primary">Agent Playground</h1>
          <div className="flex items-center gap-3">
            <Button variant="secondary" text="Forget keys" onClick={handleForgetKeys} />
            <Button variant="secondary" text="Clear conversation" onClick={handleClear} />
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <Card variant="subtle" className="flex w-full flex-col gap-4 p-6 lg:max-w-sm">
            <Text as="h2" variant="heading-3" className="text-text-primary">
              Setup
            </Text>
            <Text as="p" variant="caption-2" className="text-text-secondary">
              Keys are kept in this browser tab&apos;s session storage only. Your Anthropic key is
              sent directly to the Anthropic API from your browser and never touches Yosemite Crew
              servers.
            </Text>
            <label className="flex flex-col gap-1">
              <Text variant="body-4-emphasis" className="text-text-primary">
                Anthropic API key
              </Text>
              <Input
                type="password"
                autoComplete="off"
                placeholder="sk-ant-..."
                value={settings.anthropicKey}
                onChange={(event) => updateSetting('anthropicKey', event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <Text variant="body-4-emphasis" className="text-text-primary">
                Yosemite API key
              </Text>
              <Input
                type="password"
                autoComplete="off"
                placeholder="yc_test_... recommended"
                value={settings.yosemiteKey}
                onChange={(event) => updateSetting('yosemiteKey', event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <Text variant="body-4-emphasis" className="text-text-primary">
                API base URL
              </Text>
              <Input
                type="text"
                placeholder="http://localhost:3000"
                value={settings.baseUrl}
                onChange={(event) => updateSetting('baseUrl', event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <Text variant="body-4-emphasis" className="text-text-primary">
                Model
              </Text>
              <select
                className="min-h-12 w-full rounded-2xl border border-input-border-default bg-transparent px-6 py-2.5 text-body-4 text-text-primary outline-none focus:border-input-border-active"
                value={settings.model}
                onChange={(event) => updateSetting('model', event.target.value)}
              >
                {PLAYGROUND_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          <Card variant="default" className="flex min-h-[420px] w-full flex-col gap-4 p-6">
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
              {messages.length === 0 ? (
                <Text as="p" variant="body-4" className="text-text-tertiary">
                  No messages yet. Ask about appointments, patients, encounters, invoices, your
                  organisation profile, or API usage.
                </Text>
              ) : (
                messages.map((message, messageIndex) => (
                  <div
                    key={`message-${message.role}-${messageIndex}`}
                    className="flex flex-col gap-1"
                  >
                    <Text variant="caption-2" className="text-text-tertiary uppercase">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </Text>
                    {message.content.map((block, blockIndex) =>
                      renderBlock(block, `block-${messageIndex}-${blockIndex}`)
                    )}
                  </div>
                ))
              )}
              {busy ? (
                <Text as="p" variant="caption-2" className="text-text-tertiary">
                  Thinking...
                </Text>
              ) : null}
            </div>

            {notice ? (
              <Text as="p" variant="body-4" role="alert" className="text-text-error">
                {notice}
              </Text>
            ) : null}

            <form
              className="flex items-center gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
            >
              <label className="flex-1">
                <span className="sr-only">Message</span>
                <Input
                  type="text"
                  placeholder="Ask about your clinic data..."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </label>
              <Button type="submit" variant="primary" text="Send" isDisabled={busy} />
            </form>

            <Text as="p" variant="caption-2" className="text-text-tertiary">
              This playground exercises the same read-only tools the upcoming AI editing agent will
              use.
            </Text>
          </Card>
        </div>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperPlayground;
