import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MessengersSection from '../src/components/form/MessengersSection.vue';
import { translations } from '../src/i18n.js';
import { useFormState } from '../src/composables/useFormState.js';

describe('MessengersSection', () => {
  it('reveals platform settings only when enabled and binds values', async () => {
    const { form } = useFormState();
    const wrapper = mount(MessengersSection, {
      props: {
        form: form.value,
        messages: translations.ru,
        errorFor: () => undefined,
        describedBy: (_field, hintId) => hintId,
      },
    });

    expect(wrapper.find('#telegram-bot-token').exists()).toBe(false);
    expect(wrapper.find('#max-bot-token').exists()).toBe(false);

    await wrapper.get('#telegram-enabled').setValue(true);
    const token = wrapper.get<HTMLInputElement>('#telegram-bot-token');
    expect(token.element.type).toBe('password');

    await token.setValue('telegram-secret-token');
    await wrapper.get('#telegram-allowed-user-ids').setValue('101\n202');
    await wrapper.get('#telegram-locale').setValue('en');
    await wrapper
      .get(`button[aria-label="${translations.ru.showMessengerToken}"]`)
      .trigger('click');

    expect(form.value.messengers.telegram).toMatchObject({
      enabled: true,
      bot_token: 'telegram-secret-token',
      allowed_user_ids_text: '101\n202',
      locale: 'en',
    });
    expect(token.element.type).toBe('text');
    expect(wrapper.find('#max-bot-token').exists()).toBe(false);
  });
});
