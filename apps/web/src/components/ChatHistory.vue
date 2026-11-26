<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import type { Messages } from '../i18n';
import type { ChatTurn, PendingApproval } from '../types';
import ApprovalCard from './ApprovalCard.vue';
import ChatHistoryNav from './ChatHistoryNav.vue';
import ResponseCard from './ResponseCard.vue';
import ToolCallList from './ToolCallList.vue';

const props = defineProps<{
  turns: ChatTurn[];
  loading: boolean;
  loadFailed: boolean;
  loadErrorDetail: string;
  activeTurnId: string | null;
  pendingApproval: PendingApproval | null;
  busy: boolean;
  messages: Messages;
}>();

const emit = defineEmits<{
  (event: 'retry'): void;
  (event: 'selectTurn', turnId: string): void;
  (event: 'resolveApproval', approved: boolean): void;
}>();

const scrollContainer = ref<HTMLElement | null>(null);
const scrollContent = ref<HTMLElement | null>(null);
const scrollbarMaxScroll = ref(0);
const scrollbarPosition = ref(0);
const scrollbarThumbHeight = ref(0);
const scrollbarThumbTop = ref(0);
const isDraggingScrollbar = ref(false);
const latestTurnId = computed(() => props.turns.at(-1)?.id ?? null);
const latestTurnState = computed(() => {
  const turn = props.turns.at(-1);
  return {
    id: turn?.id,
    reply: turn?.reply,
    toolCallCount: turn?.toolCalls.length,
    approvalId: props.pendingApproval?.approvalId,
  };
});
let minimumScrollbarThumbHeight = 28;
let followsLatest = true;
let resizeObserver: ResizeObserver | null = null;
let dragStartY = 0;
let dragStartScrollTop = 0;
let dragPreviousScrollBehavior: string | null = null;

function updateScrollbar(): void {
  const container = scrollContainer.value;
  if (!(container instanceof HTMLElement)) return;

  const trackHeight = window.innerHeight;
  const maxScroll = Math.max(
    0,
    container.scrollHeight - container.clientHeight,
  );
  const scrollTop = Math.min(maxScroll, Math.max(0, container.scrollTop));
  scrollbarMaxScroll.value = maxScroll;
  scrollbarPosition.value = scrollTop;

  if (maxScroll === 0 || trackHeight === 0) {
    scrollbarThumbHeight.value = trackHeight;
    scrollbarThumbTop.value = 0;
    return;
  }

  scrollbarThumbHeight.value = Math.min(
    trackHeight,
    Math.max(
      minimumScrollbarThumbHeight,
      (container.clientHeight / container.scrollHeight) * trackHeight,
    ),
  );
  const thumbTravel = trackHeight - scrollbarThumbHeight.value;
  scrollbarThumbTop.value = thumbTravel * (scrollTop / maxScroll);
}

function scrollToLatest(): void {
  const container = scrollContainer.value;
  if (!(container instanceof HTMLElement)) return;
  followsLatest = true;
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
  container.scrollTo({ top: container.scrollHeight, behavior });
}

function scrollToTurn(turnId: string): void {
  const container = scrollContainer.value;
  const target = document.getElementById(`chat-turn-${turnId}`);
  if (!(container instanceof HTMLElement) || !target) return;

  const top =
    target.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop;
  followsLatest = false;
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
  container.scrollTo({ top, behavior });
  emit('selectTurn', turnId);
}

function updateFollowState(): void {
  const container = scrollContainer.value;
  if (!(container instanceof HTMLElement)) return;
  followsLatest =
    container.scrollHeight - container.scrollTop - container.clientHeight < 120;
}

function updateActiveTurn(): void {
  const container = scrollContainer.value;
  const content = scrollContent.value;
  if (
    !(container instanceof HTMLElement) ||
    !(content instanceof HTMLElement) ||
    props.turns.length === 0
  ) {
    return;
  }

  const turnElements = content.querySelectorAll<HTMLElement>('.chat-turn');
  if (turnElements.length === 0) return;

  const activeBoundary = container.getBoundingClientRect().top + 24;
  let low = 0;
  let high = turnElements.length - 1;
  let activeIndex = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const turnTop = turnElements[middle]?.getBoundingClientRect().top;
    if (turnTop === undefined) break;

    if (turnTop <= activeBoundary) {
      activeIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (
    container.scrollTop + container.clientHeight >=
    container.scrollHeight - 1
  ) {
    activeIndex = turnElements.length - 1;
  }

  const turnId = props.turns[activeIndex]?.id;
  if (turnId && turnId !== props.activeTurnId) {
    emit('selectTurn', turnId);
  }
}

function setScrollPositionImmediately(
  container: HTMLElement,
  position: number,
): void {
  const previousScrollBehavior = container.style.scrollBehavior;
  container.style.scrollBehavior = 'auto';
  try {
    container.scrollTop = position;
  } finally {
    container.style.scrollBehavior = previousScrollBehavior;
  }
}

function handleScroll(): void {
  updateFollowState();
  updateScrollbar();
  updateActiveTurn();
}

function handleScrollbarTrackPointerDown(event: PointerEvent): void {
  if (event.target !== event.currentTarget) return;

  const container = scrollContainer.value;
  const thumbTravel = window.innerHeight - scrollbarThumbHeight.value;
  if (!(container instanceof HTMLElement) || thumbTravel <= 0) return;

  const thumbTop = Math.min(
    thumbTravel,
    Math.max(0, event.clientY - scrollbarThumbHeight.value / 2),
  );
  setScrollPositionImmediately(
    container,
    (thumbTop / thumbTravel) * scrollbarMaxScroll.value,
  );
}

function startScrollbarDrag(event: PointerEvent): void {
  const target = event.currentTarget;
  const container = scrollContainer.value;
  if (
    !(target instanceof HTMLElement) ||
    !(container instanceof HTMLElement) ||
    scrollbarMaxScroll.value === 0
  ) {
    return;
  }

  dragPreviousScrollBehavior = container.style.scrollBehavior;
  container.style.scrollBehavior = 'auto';
  isDraggingScrollbar.value = true;
  dragStartY = event.clientY;
  dragStartScrollTop = container.scrollTop;
  target.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function moveScrollbarThumb(event: PointerEvent): void {
  if (!isDraggingScrollbar.value) return;

  const container = scrollContainer.value;
  const thumbTravel = window.innerHeight - scrollbarThumbHeight.value;
  if (!(container instanceof HTMLElement) || thumbTravel <= 0) return;

  container.scrollTop =
    dragStartScrollTop +
    ((event.clientY - dragStartY) / thumbTravel) * scrollbarMaxScroll.value;
}

function stopScrollbarDrag(): void {
  const container = scrollContainer.value;
  if (
    container instanceof HTMLElement &&
    dragPreviousScrollBehavior !== null
  ) {
    container.style.scrollBehavior = dragPreviousScrollBehavior;
  }
  dragPreviousScrollBehavior = null;
  isDraggingScrollbar.value = false;
}

function handleScrollbarKeydown(event: KeyboardEvent): void {
  const container = scrollContainer.value;
  if (!(container instanceof HTMLElement)) return;

  let nextPosition: number;
  switch (event.key) {
    case 'ArrowDown':
      nextPosition = container.scrollTop + 40;
      break;
    case 'ArrowUp':
      nextPosition = container.scrollTop - 40;
      break;
    case 'PageDown':
      nextPosition = container.scrollTop + container.clientHeight;
      break;
    case 'PageUp':
      nextPosition = container.scrollTop - container.clientHeight;
      break;
    case 'Home':
      nextPosition = 0;
      break;
    case 'End':
      nextPosition = scrollbarMaxScroll.value;
      break;
    default:
      return;
  }

  event.preventDefault();
  setScrollPositionImmediately(
    container,
    Math.min(scrollbarMaxScroll.value, Math.max(0, nextPosition)),
  );
}

watch(
  () => props.turns.length,
  async (length, previousLength) => {
    if (length <= previousLength) return;
    followsLatest = true;
    await nextTick();
    scrollToLatest();
  },
  { flush: 'post' },
);

watch(
  latestTurnState,
  async (turn, previousTurn) => {
    if (!turn.id || turn.id !== previousTurn.id || !followsLatest) return;
    await nextTick();
    scrollToLatest();
  },
  { flush: 'post' },
);

watch(
  () => props.loading,
  async (loading, wasLoading) => {
    if (loading || !wasLoading || props.turns.length === 0) return;
    await nextTick();
    scrollToLatest();
  },
  { flush: 'post' },
);

onMounted(() => {
  minimumScrollbarThumbHeight =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
      ? 44
      : 28;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateScrollbar);
    if (scrollContainer.value) resizeObserver.observe(scrollContainer.value);
    if (scrollContent.value) resizeObserver.observe(scrollContent.value);
  }
  window.addEventListener('resize', updateScrollbar);
  updateScrollbar();

  if (props.turns.length > 0 && !props.loading) {
    scrollToLatest();
  }
});

onBeforeUnmount(() => {
  stopScrollbarDrag();
  resizeObserver?.disconnect();
  window.removeEventListener('resize', updateScrollbar);
});
</script>

<template>
  <section class="chat-history" :aria-label="messages.chatHistory">
    <div
      ref="scrollContainer"
      id="chat-history-scroll-region"
      class="chat-history-scroll"
      :aria-busy="loading"
      @scroll="handleScroll"
    >
      <div ref="scrollContent" class="chat-history-content">
        <div
          v-if="loading && turns.length === 0"
          class="history-state"
          role="status"
        >
          <span class="loading-indicator" aria-hidden="true" />
          <p>{{ messages.loadingHistory }}</p>
        </div>

        <div v-else-if="turns.length === 0 && !loadFailed" class="history-state">
          <p>{{ messages.emptyChat }}</p>
        </div>

        <div
          v-if="loadFailed"
          class="history-error"
          :class="{ 'history-error--with-turns': turns.length > 0 }"
          role="alert"
        >
          <p>
            {{ messages.historyLoadError }}
            <span v-if="loadErrorDetail">({{ loadErrorDetail }})</span>
          </p>
          <button type="button" @click="emit('retry')">
            {{ messages.retryHistory }}
          </button>
        </div>

        <article
          v-for="turn in turns"
          :id="`chat-turn-${turn.id}`"
          :key="turn.id"
          class="chat-turn"
        >
          <div class="user-message">
            <p class="message-label">{{ messages.userLabel }}</p>
            <p class="message-copy">{{ turn.request }}</p>
          </div>

          <div class="assistant-message">
            <p class="message-label">{{ messages.assistantLabel }}</p>
            <ResponseCard
              v-if="turn.reply"
              :reply="turn.reply"
              :warning="turn.warning"
              :messages="messages"
              :show-title="false"
            />
            <p
              v-else-if="busy && turn.id === latestTurnId"
              class="processing-message"
              role="status"
            >
              {{ messages.processing }}
            </p>
            <ToolCallList
              v-if="turn.toolCalls.length > 0"
              :calls="turn.toolCalls"
              :messages="messages"
            />
            <ApprovalCard
              v-if="turn.id === latestTurnId && pendingApproval"
              :approval="pendingApproval"
              :busy="busy"
              :messages="messages"
              @resolve="emit('resolveApproval', $event)"
            />
          </div>
        </article>
      </div>
    </div>

    <div
      v-if="scrollbarMaxScroll > 0"
      class="chat-history-scrollbar"
      @pointerdown="handleScrollbarTrackPointerDown"
    >
      <div
        class="chat-history-scrollbar-thumb"
        :class="{ 'chat-history-scrollbar-thumb--dragging': isDraggingScrollbar }"
        role="scrollbar"
        tabindex="0"
        aria-orientation="vertical"
        aria-valuemin="0"
        :aria-label="messages.chatHistoryScrollbar"
        aria-controls="chat-history-scroll-region"
        :aria-valuemax="scrollbarMaxScroll"
        :aria-valuenow="scrollbarPosition"
        :style="{
          height: `${scrollbarThumbHeight}px`,
          transform: `translateY(${scrollbarThumbTop}px)`,
        }"
        @pointerdown="startScrollbarDrag"
        @pointermove="moveScrollbarThumb"
        @pointerup="stopScrollbarDrag"
        @pointercancel="stopScrollbarDrag"
        @lostpointercapture="stopScrollbarDrag"
        @keydown="handleScrollbarKeydown"
      />
    </div>

    <ChatHistoryNav
      :turns="turns"
      :active-turn-id="activeTurnId"
      :messages="messages"
      @select="scrollToTurn"
    />
  </section>
</template>

<style scoped>
.chat-history {
  position: relative;
  flex: 1 1 auto;
  min-width: 100vw;
  min-height: 0;
  width: 100vw;
  margin-inline: calc(50% - 50vw);
}

.chat-history-scroll {
  display: block;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 12px 24px 24px;
  scrollbar-width: none;
  scroll-behavior: smooth;
}

.chat-history-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.chat-history-content {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 22px;
}

.chat-history-scrollbar {
  position: fixed;
  z-index: 2;
  inset: 0 0 0 auto;
  width: 8px;
  touch-action: none;
}

.chat-history-scrollbar::before {
  position: absolute;
  inset: 0 3px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--line) 24%, transparent);
  content: '';
  pointer-events: none;
}

.chat-history-scrollbar-thumb {
  position: absolute;
  top: 0;
  right: 2px;
  width: 4px;
  min-height: 28px;
  border: 0;
  border-radius: 4px;
  background: color-mix(in srgb, var(--muted) 26%, transparent);
  cursor: grab;
  touch-action: none;
  transition: background-color 120ms ease;
}

.chat-history-scrollbar-thumb:hover,
.chat-history-scrollbar-thumb:focus-visible,
.chat-history-scrollbar-thumb--dragging {
  background: color-mix(in srgb, var(--muted) 40%, transparent);
}

.chat-history-scrollbar-thumb:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.chat-history-scrollbar-thumb:active,
.chat-history-scrollbar-thumb--dragging {
  cursor: grabbing;
}

.chat-history-scroll[aria-busy="true"] {
  cursor: progress;
}

.history-state {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-block: auto;
  color: var(--muted);
  text-align: center;
}

.history-state p,
.history-error p {
  margin: 0;
  line-height: 1.55;
}

.chat-turn {
  display: grid;
  width: min(100%, 768px);
  flex: 0 0 auto;
  gap: 16px;
  min-width: 0;
  margin-inline: auto;
  scroll-margin-block: 12px;
}

.user-message {
  width: fit-content;
  max-width: min(86%, 680px);
  justify-self: end;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  background: var(--surface-hover);
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .user-message {
    width: 100%;
    max-width: 100%;
    justify-self: stretch;
  }
}

.message-label {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.message-copy {
  margin: 0;
  line-height: 1.55;
  white-space: pre-wrap;
}

.assistant-message {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.assistant-message > .message-label {
  margin-bottom: 0;
}

.processing-message {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.history-error {
  display: flex;
  width: min(100%, 768px);
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-inline: auto;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--alert-accent);
  color: var(--error);
  background: var(--surface);
}

.history-error--with-turns {
  margin-bottom: 4px;
}

.history-error button {
  min-height: 40px;
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius, 2px);
  color: var(--ink);
  background: var(--surface);
}

.history-error button:hover {
  background: var(--surface-hover);
}

.history-error button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.loading-indicator {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 850ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .chat-history-scroll {
    padding-block: 8px 18px;
  }

  .chat-history-content {
    gap: 18px;
  }

  .history-error {
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .chat-history-scroll {
    padding-inline: 18px;
  }
}

@media (max-width: 420px) {
  .chat-history-scroll {
    padding-inline: 12px;
  }
}

@media (hover: none) and (pointer: coarse) {
  .chat-history-scrollbar {
    width: 24px;
  }

  .chat-history-scrollbar::before {
    inset-inline: 11px;
  }

  .chat-history-scrollbar-thumb {
    right: 0;
    width: 24px;
    min-height: 44px;
    background: transparent;
  }

  .chat-history-scrollbar-thumb::before {
    position: absolute;
    inset: 0 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--muted) 26%, transparent);
    content: '';
    pointer-events: none;
  }

  .chat-history-scrollbar-thumb:hover,
  .chat-history-scrollbar-thumb:focus-visible,
  .chat-history-scrollbar-thumb--dragging {
    background: transparent;
  }

  .chat-history-scrollbar-thumb:hover::before,
  .chat-history-scrollbar-thumb:focus-visible::before,
  .chat-history-scrollbar-thumb--dragging::before {
    background: color-mix(in srgb, var(--muted) 40%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-history-scroll {
    scroll-behavior: auto;
  }

  .chat-history-scrollbar-thumb {
    transition: none;
  }

  .loading-indicator {
    animation-duration: 0.01ms;
  }
}
</style>
