import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { ClientUiConfig } from '@alekstar79/ykassa-contracts';
import PreviewPanel from '../src/components/PreviewPanel.vue';

const referenceUi: ClientUiConfig = {
  mode: 'reference-ui',
  accent: 'navy',
  radius: 2,
  shadow: 'soft',
  font_pair: 'manrope+jetbrains',
  form_style: 'flat',
  h1_size: 'm',
};

describe('PreviewPanel', () => {
  it('renders the English chat composer with the configured brand', () => {
    const wrapper = mount(PreviewPanel, {
      props: {
        displayName: 'Online English School',
        ui: referenceUi,
        locale: 'en',
        theme: 'light',
      },
    });

    expect(wrapper.get('article').attributes('aria-label')).toBe('Preview');
    expect(wrapper.text()).toContain('Online English School');
    expect(wrapper.get('textarea').attributes('placeholder')).toBe(
      'For example: create an invoice for 5,000 RUB for an English course',
    );
    expect(wrapper.find('.chat-input-container').exists()).toBe(true);
    expect(wrapper.find('.add-menu-button').exists()).toBe(true);
    expect(wrapper.find('.chat-send-button').exists()).toBe(true);
    expect(wrapper.findAll('.preview-turn')).toHaveLength(3);
    expect(wrapper.findAll('.preview-history-dots li')).toHaveLength(3);
    expect(wrapper.findAll('.preview-history-popover li')).toHaveLength(3);
    expect(
      wrapper.find('.preview-history-popover li.is-current').text(),
    ).toContain('Check the status of that link.');
    expect(wrapper.find('.file-drop-zone').exists()).toBe(false);
    expect(wrapper.find('.primary-button').exists()).toBe(false);

    wrapper.unmount();
  });

  it('renders the brand fallback and handles custom-ui configuration', () => {
    const wrapper = mount(PreviewPanel, {
      props: {
        ui: {
          ...referenceUi,
          mode: 'custom-ui',
          shadow: 'medium',
          form_style: 'card',
        },
        locale: 'ru',
        theme: 'dark',
      },
    });

    expect(wrapper.get('article').attributes('aria-label')).toBe('Предпросмотр');
    expect(wrapper.text()).toContain('Название сервиса');
    expect(wrapper.get('textarea').attributes('placeholder')).toContain(
      '5 000 ₽',
    );
    expect(wrapper.get('.chat-input-container').classes()).toContain(
      'chat-input-container--card',
    );
    expect(wrapper.attributes('style')).toContain(
      '0 3px 10px rgb(0 0 0 / 32%)',
    );

    wrapper.unmount();

    const flatWithoutShadow = mount(PreviewPanel, {
      props: {
        ui: { ...referenceUi, shadow: 'none' },
        locale: 'ru',
        theme: 'light',
      },
    });

    expect(flatWithoutShadow.get('.chat-input-container').classes()).toContain(
      'chat-input-container--flat',
    );
    expect(flatWithoutShadow.attributes('style')).toContain(
      '--micro-shadow: none',
    );
    flatWithoutShadow.unmount();
  });
});
