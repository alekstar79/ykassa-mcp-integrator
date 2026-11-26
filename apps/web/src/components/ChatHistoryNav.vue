<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Messages } from '../i18n';
import type { ChatTurn } from '../types';

const props = defineProps<{
  turns: ChatTurn[];
  activeTurnId: string | null;
  messages: Messages;
}>();

const emit = defineEmits<{
  (event: 'select', turnId: string): void;
}>();

const navElement = ref<HTMLElement | null>(null);
const isPopoverOpen = ref(false);

function requestTitle(request: string): string {
  const normalized = request.replace(/\s+/g, ' ').trim();
  const characters = Array.from(normalized);
  if (characters.length <= 48) return normalized;
  return `${characters.slice(0, 48).join('')}…`;
}

function jumpToTurn(turnId: string): void {
  emit('select', turnId);
}

function handlePointerEnter(event: PointerEvent): void {
  if (event.pointerType !== 'touch') isPopoverOpen.value = true;
}

function handlePointerLeave(event: PointerEvent): void {
  const nav = navElement.value;
  const activeElement = document.activeElement;
  if (
    event.pointerType !== 'touch' &&
    (!(nav instanceof HTMLElement) ||
      !(activeElement instanceof Node) ||
      !nav.contains(activeElement))
  ) {
    isPopoverOpen.value = false;
  }
}

function handleDotPointerUp(event: PointerEvent): void {
  if (event.pointerType === 'touch') isPopoverOpen.value = true;
}

function focusDot(turnId: string): void {
  const nav = navElement.value;
  if (!(nav instanceof HTMLElement)) return;

  const index = props.turns.findIndex((turn) => turn.id === turnId);
  nav.querySelectorAll<HTMLButtonElement>('.chat-history-dot').item(index)?.focus();
}

function selectPopoverTurn(turnId: string): void {
  jumpToTurn(turnId);
  isPopoverOpen.value = false;
  focusDot(turnId);
}

function handleFocusIn(event: FocusEvent): void {
  const nav = navElement.value;
  const previousTarget = event.relatedTarget;
  if (
    nav instanceof HTMLElement &&
    (!(previousTarget instanceof Node) || !nav.contains(previousTarget))
  ) {
    isPopoverOpen.value = true;
  }
}

function handleFocusOut(event: FocusEvent): void {
  const nav = navElement.value;
  const nextTarget = event.relatedTarget;
  if (
    nav instanceof HTMLElement &&
    (!(nextTarget instanceof Node) || !nav.contains(nextTarget))
  ) {
    isPopoverOpen.value = false;
  }
}

function handleOutsidePointerDown(event: PointerEvent): void {
  const nav = navElement.value;
  if (
    nav instanceof HTMLElement &&
    event.target instanceof Node &&
    !nav.contains(event.target)
  ) {
    isPopoverOpen.value = false;
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !isPopoverOpen.value) return;
  event.stopPropagation();
  isPopoverOpen.value = false;
  const turnId = props.activeTurnId ?? props.turns[0]?.id;
  if (turnId) focusDot(turnId);
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointerDown);
});
</script>

<template>
  <nav
    v-if="turns.length > 0"
    ref="navElement"
    class="chat-history-nav"
    :class="{ 'is-open': isPopoverOpen }"
    :aria-label="messages.historyNavigation"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
    @keydown="handleKeydown"
  >
    <ol class="chat-history-dots">
      <li v-for="turn in turns" :key="turn.id">
        <button
          type="button"
          class="chat-history-dot"
          :aria-label="`${messages.jumpToRequest}: ${requestTitle(turn.request) || messages.requestLabel}`"
          :aria-current="activeTurnId === turn.id ? 'location' : undefined"
          :title="requestTitle(turn.request)"
          @pointerup="handleDotPointerUp"
          @click="jumpToTurn(turn.id)"
        >
          <span aria-hidden="true" />
        </button>
      </li>
    </ol>
    <div id="chat-history-popover" class="chat-history-popover">
      <ol>
        <li v-for="turn in turns" :key="turn.id">
          <button
            type="button"
            :aria-current="activeTurnId === turn.id ? 'location' : undefined"
            :title="turn.request"
            @click="selectPopoverTurn(turn.id)"
          >
            {{ requestTitle(turn.request) || messages.requestLabel }}
          </button>
        </li>
      </ol>
    </div>
  </nav>
</template>

<style scoped>
.chat-history-nav {
  position: fixed;
  z-index: 3;
  top: 50%;
  right: 8px;
  display: flex;
  align-items: center;
  transform: translateY(-50%);
}

.chat-history-dots {
  display: grid;
  width: 48px;
  grid-auto-rows: 28px;
  max-height: min(68vh, 480px);
  overflow-x: hidden;
  overflow-y: auto;
  margin: 0;
  padding: 22px 2px;
  list-style: none;
  scrollbar-color: color-mix(in srgb, var(--muted) 14%, transparent)
    transparent;
  scrollbar-width: thin;
}

.chat-history-dots::-webkit-scrollbar {
  width: 4px;
}

.chat-history-dots::-webkit-scrollbar-track {
  background: transparent;
}

.chat-history-dots::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: color-mix(in srgb, var(--muted) 14%, transparent);
}

.chat-history-dots li {
  position: relative;
  width: 44px;
  height: 28px;
}

.chat-history-dots li:hover,
.chat-history-dots li:focus-within {
  z-index: 1;
}

.chat-history-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--muted);
  background: transparent;
  transform: translate(-50%, -50%);
}

.chat-history-dot span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
  transition: background-color 140ms ease, transform 140ms ease;
}

.chat-history-dot:hover span,
.chat-history-dot[aria-current="location"] span {
  background: var(--accent);
  transform: scale(1.35);
}

.chat-history-dot:focus-visible,
.chat-history-popover button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.chat-history-popover {
  position: absolute;
  top: 50%;
  right: calc(100% - 32px);
  width: min(280px, calc(100vw - 88px));
  max-height: min(68vh, 480px);
  overflow-x: hidden;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface);
  box-shadow: var(--micro-shadow);
  scrollbar-color: color-mix(in srgb, var(--muted) 14%, transparent)
    transparent;
  scrollbar-width: thin;
  opacity: 0;
  pointer-events: none;
  transform: translate(5px, -50%);
  transition:
    opacity 160ms ease,
    transform 160ms ease,
    visibility 160ms ease;
  visibility: hidden;
}

.chat-history-popover::-webkit-scrollbar {
  width: 4px;
}

.chat-history-popover::-webkit-scrollbar-track {
  background: transparent;
}

.chat-history-popover::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: color-mix(in srgb, var(--muted) 14%, transparent);
}

.chat-history-popover ol {
  display: grid;
  gap: 2px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chat-history-popover li {
  min-width: 0;
}

.chat-history-popover button {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 40px;
  overflow: hidden;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius, 2px);
  color: var(--ink);
  background: transparent;
  font-size: 13px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-history-popover button:hover,
.chat-history-popover button[aria-current="location"] {
  color: var(--accent);
  background: var(--surface-hover);
}

.chat-history-nav.is-open .chat-history-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translate(0, -50%);
  visibility: visible;
}

@media (max-width: 600px) {
  .chat-history-nav {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-history-dot span,
  .chat-history-popover {
    transition: none;
  }
}
</style>
