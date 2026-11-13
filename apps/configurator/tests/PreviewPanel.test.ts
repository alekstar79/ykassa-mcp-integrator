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
  it('renders the English preview with the configured brand and attachment limit', () => {
    const wrapper = mount(PreviewPanel, {
      props: {
        displayName: 'Online English School',
        maxAttachmentKb: 256,
        ui: referenceUi,
        locale: 'en',
        theme: 'light',
      },
    });

    expect(wrapper.get('article').attributes('aria-label')).toBe('Preview');
    expect(wrapper.text()).toContain('Online English School');
    expect(wrapper.get('textarea').attributes('placeholder')).toBe(
      'For example: create a ₽5,000 payment link for an English course',
    );
    expect(wrapper.text()).toContain('up to 256 KB');

    wrapper.unmount();
  });

  it('renders the brand fallback and handles custom-ui configuration', () => {
    const wrapper = mount(PreviewPanel, {
      props: {
        maxAttachmentKb: 100,
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
    expect(wrapper.text()).toContain('до 100 КБ');
    expect(wrapper.get('.request-form').classes()).toContain('form--card');
    expect(wrapper.attributes('style')).toContain(
      '0 3px 10px rgb(0 0 0 / 32%)',
    );

    wrapper.unmount();

    const flatWithoutShadow = mount(PreviewPanel, {
      props: {
        maxAttachmentKb: 100,
        ui: { ...referenceUi, shadow: 'none' },
        locale: 'ru',
        theme: 'light',
      },
    });

    expect(flatWithoutShadow.attributes('style')).toContain(
      '--micro-shadow: none',
    );
    flatWithoutShadow.unmount();
  });
});
