import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../src/App.vue';

describe('App client mode selection', () => {
  it('shows settings for only the selected client interface', async () => {
    const wrapper = mount(App);
    const modeSelect = wrapper.get<HTMLSelectElement>('#client-mode');

    expect(
      Array.from(modeSelect.element.options).map((option) => option.value),
    ).toEqual(['reference-ui', 'custom-ui', 'messengers']);
    expect(wrapper.find('#ui-accent').exists()).toBe(true);
    expect(wrapper.find('#telegram-enabled').exists()).toBe(false);

    await modeSelect.setValue('messengers');
    expect(wrapper.find('#ui-accent').exists()).toBe(false);
    expect(wrapper.find('#telegram-enabled').exists()).toBe(true);
    expect(wrapper.find('.view-toggle').attributes('disabled')).toBeDefined();

    await modeSelect.setValue('custom-ui');
    expect(wrapper.find('#telegram-enabled').exists()).toBe(false);
    expect(wrapper.find('#ui-accent').exists()).toBe(false);
    expect(wrapper.text()).toContain(
      'Интерфейс не входит в архив. Запускается только API.',
    );

    wrapper.unmount();
  });
});
