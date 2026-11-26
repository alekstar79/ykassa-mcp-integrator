import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import RequestForm from '../src/components/RequestForm.vue';
import { translations } from '../src/i18n';
import type { RequestPayload } from '../src/types';

const mountedApps: Array<{ unmount: () => void }> = [];
const mountedContainers: HTMLElement[] = [];

function renderRequestForm(
  submitted: RequestPayload[],
): { container: HTMLElement; app: { unmount: () => void } } {
  const container = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          h(RequestForm, {
            placeholder: translations.ru.requestPlaceholder,
            messages: translations.ru,
            errorMessage: '',
            busy: false,
            approvalPending: false,
            maxAttachmentKb: 100,
            formStyle: 'flat',
            onSubmit: (payload: RequestPayload) => submitted.push(payload),
          });
      },
    }),
  );
  app.mount(container);
  mountedApps.push(app);
  mountedContainers.push(container);
  return { container, app };
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  for (const container of mountedContainers.splice(0)) container.remove();
});

describe('RequestForm chat composer', () => {
  it('clears the submitted message while emitting its trimmed content', async () => {
    const submitted: RequestPayload[] = [];
    const { container } = renderRequestForm(submitted);
    const textarea = container.querySelector('textarea');
    const form = container.querySelector('form');

    expect(textarea).not.toBeNull();
    expect(form).not.toBeNull();
    if (!textarea || !form) return;

    textarea.value = '  Check the latest payment  ';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await nextTick();

    expect(submitted).toEqual([
      { message: 'Check the latest payment', attachment: null },
    ]);
    expect(textarea.value).toBe('');
  });

  it('closes the settings dialog when Escape is pressed', async () => {
    const { container } = renderRequestForm([]);
    const actionsButton = Array.from(container.querySelectorAll('button')).find(
      (button) =>
        button.getAttribute('aria-label') === translations.ru.addActions,
    );
    expect(actionsButton).toBeDefined();
    actionsButton?.click();
    await nextTick();

    const settingsButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === translations.ru.settings,
    );
    expect(settingsButton).toBeDefined();
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    if (!dialog) return;

    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    settingsButton?.click();
    await nextTick();
    expect(dialog.open).toBe(true);

    dialog.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await nextTick();

    expect(dialog.open).toBe(false);
  });
});
