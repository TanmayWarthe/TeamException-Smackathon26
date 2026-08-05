// utils/domHelpers.ts
// Lightweight DOM inspection helpers for the content script.

/**
 * Check if the current page contains a login/credential form or authentication intent.
 * Checks for:
 * 1. Password input fields
 * 2. Login/Sign-in keywords in forms, buttons, or page titles
 * 3. Username/email + submit combinations
 */
export function isLoginPage(): boolean {
  // 1. Definite match: page has a password field
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  if (passwordInputs.length > 0) return true;

  // 2. Keyword heuristic in forms or buttons
  const authKeywords = ['login', 'sign in', 'signin', 'portal', 'erp', 'auth', 'student', 'admission', 'password', 'credential', 'moodle', 'blackboard', 'webmail', 'sso'];
  
  const pageTitle = (document.title || '').toLowerCase();
  if (authKeywords.some(kw => pageTitle.includes(kw))) {
    const hasInputs = document.querySelectorAll('input:not([type="hidden"])').length > 0;
    if (hasInputs) return true;
  }

  const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
  for (const btn of buttons) {
    const text = ((btn as HTMLElement).innerText || (btn as HTMLInputElement).value || '').toLowerCase();
    if (authKeywords.some(kw => text.includes(kw))) {
      return true;
    }
  }

  // 3. Form action contains auth keywords
  const forms = document.querySelectorAll('form');
  for (const form of forms) {
    const action = (form.getAttribute('action') || '').toLowerCase();
    if (authKeywords.some(kw => action.includes(kw))) {
      return true;
    }
  }

  return false;
}

/**
 * Collect lightweight metadata about the page forms & structure.
 * NEVER collects actual user input values — only field presence and HTML structure.
 */
export function collectFormMetadata(): {
  inputFieldCount: number;
  buttonLabels: string[];
  domSnapshot: string;
  logoSrc: string | null;
  hasPasswordField: boolean;
} {
  // Count all input fields
  const inputs = document.querySelectorAll('input');
  const inputFieldCount = inputs.length;
  const hasPasswordField = document.querySelectorAll('input[type="password"]').length > 0;

  // Collect button labels
  const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], a.btn, a.button');
  const buttonLabels: string[] = [];
  buttons.forEach((btn) => {
    const label = (btn as HTMLElement).innerText?.trim()
      || (btn as HTMLInputElement).value?.trim()
      || '';
    if (label && label.length < 50) buttonLabels.push(label);
  });

  // Lightweight DOM snapshot — forms outer HTML + header elements
  const forms = document.querySelectorAll('form');
  let domSnapshot = '';
  forms.forEach((form) => {
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

  // Fallback: if no <form> tag but has inputs, capture the container or body snippet
  if (!domSnapshot && inputs.length > 0) {
    const sample = document.body ? document.body.innerHTML.slice(0, 30000) : '';
    domSnapshot = sample;
  }

  // Heuristic logo detection
  let logoSrc: string | null = null;
  const imgs = document.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.src || '';
    const alt = (img.alt || '').toLowerCase();
    const cls = (img.className || '').toLowerCase();
    const id = (img.id || '').toLowerCase();
    if (alt.includes('logo') || cls.includes('logo') || id.includes('logo') || src.toLowerCase().includes('logo')) {
      logoSrc = src;
      break;
    }
  }

  return { inputFieldCount, buttonLabels, domSnapshot, logoSrc, hasPasswordField };
}
