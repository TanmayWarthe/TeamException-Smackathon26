// utils/domHelpers.ts
// Lightweight DOM inspection helpers for the content script.

/**
 * Check if the current page contains a login/credential form.
 * Heuristic: page has at least one password input field.
 */
export function isLoginPage(): boolean {
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  return passwordInputs.length > 0;
}

/**
 * Collect lightweight metadata about the page forms.
 * NEVER collects actual input values — only field presence and structure.
 */
export function collectFormMetadata(): {
  inputFieldCount: number;
  buttonLabels: string[];
  domSnapshot: string;
  logoSrc: string | null;
} {
  // Count all input fields (text, email, password, tel, etc.)
  const inputs = document.querySelectorAll('input');
  const inputFieldCount = inputs.length;

  // Collect button labels
  const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
  const buttonLabels: string[] = [];
  buttons.forEach((btn) => {
    const label = (btn as HTMLElement).innerText?.trim()
      || (btn as HTMLInputElement).value?.trim()
      || '';
    if (label) buttonLabels.push(label);
  });

  // Lightweight DOM snapshot — only form elements' outer HTML (stripped of values)
  const forms = document.querySelectorAll('form');
  let domSnapshot = '';
  forms.forEach((form) => {
    // Clone the form and strip all input values to avoid capturing credentials
    const clone = form.cloneNode(true) as HTMLFormElement;
    clone.querySelectorAll('input').forEach((input) => {
      input.removeAttribute('value');
      input.value = '';
    });
    clone.querySelectorAll('textarea').forEach((ta) => {
      ta.textContent = '';
    });
    domSnapshot += clone.outerHTML + '\n';
  });

  // Heuristic logo detection: first img whose src/alt/class contains "logo"
  let logoSrc: string | null = null;
  const imgs = document.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.src || '';
    const alt = (img.alt || '').toLowerCase();
    const cls = (img.className || '').toLowerCase();
    if (alt.includes('logo') || cls.includes('logo') || src.toLowerCase().includes('logo')) {
      logoSrc = src;
      break;
    }
  }

  return { inputFieldCount, buttonLabels, domSnapshot, logoSrc };
}
