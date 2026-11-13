import { computed, nextTick, ref } from 'vue';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { CLIENT_CONFIG_DEFAULTS } from '@alekstar79/ykassa-contracts';
import { translations, type Locale } from '../src/i18n.js';
import { useDownload } from '../src/composables/useDownload.js';
import { buildClientZip } from '../src/export/buildZip.js';
import type { FormState } from '../src/types.js';

vi.mock('../src/export/buildZip.js', () => ({
  buildClientZip: vi.fn(),
}));

const buildClientZipMock = vi.mocked(buildClientZip);

function createHarness(initiallyValid = true) {
  const form = ref<FormState>({
    name: 'online-school',
    shop_id: '123456789',
    mcp_token: 'test-token-123456',
    allowed_scenarios: ['create_payment'],
    approval_threshold: 1000,
    require_human_confirmation: false,
    brand: { display_name: 'Online School' },
    ui: { ...CLIENT_CONFIG_DEFAULTS.ui },
    limits: { ...CLIENT_CONFIG_DEFAULTS.limits },
  });
  const isFormValid = ref(initiallyValid);
  const errors = ref<Record<string, string>>({});
  const locale = ref<Locale>('ru');
  const state = useDownload({
    form,
    hasApprovalThreshold: ref(true),
    isFormValid: computed(() => isFormValid.value),
    fieldErrors: computed(() => errors.value),
    locale,
    messages: computed(() => translations[locale.value]),
  });

  return { form, isFormValid, errors, state };
}

let originalCreateObjectURL: PropertyDescriptor | undefined;
let originalRevokeObjectURL: PropertyDescriptor | undefined;
const createObjectURLMock = vi.fn().mockReturnValue('#client-archive');
const revokeObjectURLMock = vi.fn();

beforeEach(() => {
  buildClientZipMock.mockReset();
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
  originalCreateObjectURL = Object.getOwnPropertyDescriptor(
    URL,
    'createObjectURL',
  );
  originalRevokeObjectURL = Object.getOwnPropertyDescriptor(
    URL,
    'revokeObjectURL',
  );
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURLMock,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURLMock,
  });
});

afterEach(() => {
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
  } else {
    Reflect.deleteProperty(URL, 'createObjectURL');
  }
  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
  } else {
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useDownload', () => {
  it('does not build an archive when validation fails', async () => {
    const { state } = createHarness(false);

    await state.downloadClientConfig();

    expect(buildClientZipMock).not.toHaveBeenCalled();
    expect(state.isPreparingDownload.value).toBe(false);
    expect(state.downloadError.value).toBe('');
  });

  it('tracks a pending archive and prevents a duplicate download', async () => {
    const { state } = createHarness();
    let resolveArchive!: (blob: Blob) => void;
    buildClientZipMock.mockReturnValue(
      new Promise<Blob>((resolve) => {
        resolveArchive = resolve;
      }),
    );

    const download = state.downloadClientConfig();
    expect(state.isPreparingDownload.value).toBe(true);

    await state.downloadClientConfig();
    expect(buildClientZipMock).toHaveBeenCalledOnce();

    resolveArchive(new Blob(['archive']));
    await download;
    expect(state.isPreparingDownload.value).toBe(false);
  });

  it('shows a localized error and clears it when validation changes', async () => {
    const { errors, state } = createHarness();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    buildClientZipMock.mockRejectedValue(new Error('archive failure'));

    await state.downloadClientConfig();

    expect(state.downloadError.value).toBe(translations.ru.downloadError);
    expect(state.isPreparingDownload.value).toBe(false);
    expect(consoleError).toHaveBeenCalledOnce();

    errors.value = { name: translations.ru.errors.nameInvalid };
    await nextTick();
    expect(state.downloadError.value).toBe('');
  });

  it('creates and clicks a client-named download link for the generated Blob', async () => {
    const { form, state } = createHarness();
    const blob = new Blob(['archive']);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('online-school.zip');
        expect(this.hash).toBe('#client-archive');
        expect(this.isConnected).toBe(true);
      });
    buildClientZipMock.mockResolvedValue(blob);
    vi.useFakeTimers();

    await state.downloadClientConfig();

    expect(buildClientZipMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: form.value.name,
        shop_id: form.value.shop_id,
        mcp_token: form.value.mcp_token,
      }),
      'ru',
    );
    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download="online-school.zip"]')).toBeNull();
    expect(state.isPreparingDownload.value).toBe(false);

    vi.runOnlyPendingTimers();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('#client-archive');
  });
});
