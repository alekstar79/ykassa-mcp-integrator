import { ref } from 'vue';

export function useSecretVisibility() {
  const showMcpToken = ref(false);

  function toggleMcpToken(): void {
    showMcpToken.value = !showMcpToken.value;
  }

  return { showMcpToken, toggleMcpToken };
}
