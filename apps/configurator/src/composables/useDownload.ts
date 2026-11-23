import { ref, watch, type ComputedRef, type Ref } from 'vue';
import { buildClientZip, type ClientZipForm } from '../export/buildZip';
import type { Locale, Messages } from '../i18n';
import type { FormState } from '../types';

interface UseDownloadOptions {
  form: Ref<FormState>;
  hasApprovalThreshold: Ref<boolean>;
  isFormValid: ComputedRef<boolean>;
  fieldErrors: ComputedRef<Record<string, string>>;
  locale: Ref<Locale>;
  messages: ComputedRef<Messages>;
}

export function useDownload({
  form,
  hasApprovalThreshold,
  isFormValid,
  fieldErrors,
  locale,
  messages,
}: UseDownloadOptions) {
  const downloadError = ref('');
  const isPreparingDownload = ref(false);

  watch(fieldErrors, () => {
    downloadError.value = '';
  });

  async function downloadClientConfig(): Promise<void> {
    if (!isFormValid.value || isPreparingDownload.value) return;

    const clientName = form.value.name.trim();
    isPreparingDownload.value = true;
    downloadError.value = '';
    let objectUrl: string | null = null;

    try {
      const zipForm: ClientZipForm = {
        name: form.value.name,
        shop_id: form.value.shop_id,
        mcp_token: form.value.mcp_token,
        clientMode: form.value.clientMode,
        allowed_scenarios: [...form.value.allowed_scenarios],
        approval_threshold: hasApprovalThreshold.value
          ? form.value.approval_threshold
          : undefined,
        require_human_confirmation: form.value.require_human_confirmation,
        brand: { display_name: form.value.brand.display_name },
        ui: { ...form.value.ui },
        limits: { ...form.value.limits },
        messengers: {
          telegram: { ...form.value.messengers.telegram },
          max: { ...form.value.messengers.max },
        },
      };
      const blob = await buildClientZip(zipForm, locale.value);
      objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${clientName}.zip`;
      link.hidden = true;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }

      const downloadUrl = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      objectUrl = null;
    } catch (error) {
      console.error('Failed to generate client configuration archive.', error);
      downloadError.value = messages.value.downloadError;
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      isPreparingDownload.value = false;
    }
  }

  return { downloadError, isPreparingDownload, downloadClientConfig };
}
