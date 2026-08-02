"use strict";
(() => {
  // shared/types.ts
  function getRiskLevel(score) {
    if (score <= 25) return "TRUSTED";
    if (score <= 50) return "LOW";
    if (score <= 70) return "SUSPICIOUS";
    if (score <= 90) return "HIGH";
    return "CRITICAL";
  }
  var RISK_THEME = {
    TRUSTED: { label: "Trusted", fg: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.3)" },
    LOW: { label: "Low Risk", fg: "#facc15", bg: "rgba(250,204,21,0.1)", border: "rgba(250,204,21,0.3)" },
    SUSPICIOUS: { label: "Suspicious", fg: "#fb923c", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.3)" },
    HIGH: { label: "High Risk", fg: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
    CRITICAL: { label: "Critical", fg: "#ef4444", bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.5)" }
  };
  var COLORS = {
    bgBase: "#020617",
    bgPanel: "#0f172a",
    border: "#1e293b",
    textPrimary: "#ffffff",
    textSecondary: "#94a3b8",
    accent: "#22d3ee",
    accentDark: "#06b6d4"
  };

  // utils/domHelpers.ts
  function isLoginPage() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    return passwordInputs.length > 0;
  }
  function collectFormMetadata() {
    const inputs = document.querySelectorAll("input");
    const inputFieldCount = inputs.length;
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
    const buttonLabels = [];
    buttons.forEach((btn) => {
      const label = btn.innerText?.trim() || btn.value?.trim() || "";
      if (label) buttonLabels.push(label);
    });
    const forms = document.querySelectorAll("form");
    let domSnapshot = "";
    forms.forEach((form) => {
      const clone = form.cloneNode(true);
      clone.querySelectorAll("input").forEach((input) => {
        input.removeAttribute("value");
        input.value = "";
      });
      clone.querySelectorAll("textarea").forEach((ta) => {
        ta.textContent = "";
      });
      domSnapshot += clone.outerHTML + "\n";
    });
    let logoSrc = null;
    const imgs = document.querySelectorAll("img");
    for (const img of imgs) {
      const src = img.src || "";
      const alt = (img.alt || "").toLowerCase();
      const cls = (img.className || "").toLowerCase();
      if (alt.includes("logo") || cls.includes("logo") || src.toLowerCase().includes("logo")) {
        logoSrc = src;
        break;
      }
    }
    return { inputFieldCount, buttonLabels, domSnapshot, logoSrc };
  }

  // content/content.ts
  var warningBannerInjected = false;
  function detectAndReport() {
    if (!isLoginPage()) return;
    const meta = collectFormMetadata();
    const payload = {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      domSnapshot: meta.domSnapshot,
      inputFieldCount: meta.inputFieldCount,
      buttonLabels: meta.buttonLabels,
      logoSrc: meta.logoSrc,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    chrome.runtime.sendMessage(
      { type: "CONTENT_DETECTED_LOGIN", payload },
      (response) => {
        if (chrome.runtime.lastError) {
          console.debug("[CTIP] Could not reach background:", chrome.runtime.lastError.message);
        }
      }
    );
  }
  function injectWarningBanner(result) {
    if (warningBannerInjected) return;
    warningBannerInjected = true;
    const level = getRiskLevel(result.risk_score);
    const theme = RISK_THEME[level];
    const host = document.createElement("div");
    host.id = "ctip-warning-host";
    host.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;";
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: "closed" });
    const reasons = result.reasons.slice(0, 3).map((r) => `<li style="margin:2px 0;">\u26A0 ${r}</li>`).join("");
    shadow.innerHTML = `
    <style>
      @keyframes ctip-slide-down {
        from { transform: translateY(-100%); opacity: 0; }
        to   { transform: translateY(0);     opacity: 1; }
      }
      @keyframes ctip-pulse-border {
        0%, 100% { border-color: ${theme.border}; }
        50%      { border-color: ${theme.fg}; }
      }
      .ctip-banner {
        all: initial;
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 16px 24px;
        background: ${COLORS.bgPanel};
        border-bottom: 3px solid ${theme.fg};
        color: ${COLORS.textPrimary};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        animation: ctip-slide-down 0.35s ease-out;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        ${level === "CRITICAL" ? "animation: ctip-slide-down 0.35s ease-out, ctip-pulse-border 2s ease-in-out infinite;" : ""}
      }
      .ctip-shield {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
      }
      .ctip-body { flex: 1; }
      .ctip-title {
        margin: 0 0 4px;
        font-size: 16px;
        font-weight: 700;
        color: ${theme.fg};
      }
      .ctip-score-badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 9999px;
        background: ${theme.bg};
        border: 1px solid ${theme.border};
        color: ${theme.fg};
        font-weight: 600;
        font-size: 13px;
        margin-left: 8px;
      }
      .ctip-reasons {
        list-style: none;
        padding: 0;
        margin: 8px 0;
        color: ${COLORS.textSecondary};
        font-size: 13px;
      }
      .ctip-actions {
        display: flex;
        gap: 10px;
        margin-top: 10px;
      }
      .ctip-btn {
        all: initial;
        display: inline-flex;
        align-items: center;
        padding: 8px 18px;
        border-radius: 8px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .ctip-btn:hover { opacity: 0.85; }
      .ctip-btn-leave {
        background: ${theme.fg};
        color: ${COLORS.bgBase};
      }
      .ctip-btn-continue {
        background: transparent;
        color: ${COLORS.textSecondary};
        border: 1px solid ${COLORS.border};
      }
    </style>

    <div class="ctip-banner" role="alert">
      <svg class="ctip-shield" viewBox="0 0 24 24" fill="none" stroke="${theme.fg}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <circle cx="12" cy="15" r="0.5" fill="${theme.fg}"/>
      </svg>

      <div class="ctip-body">
        <p class="ctip-title">
          CTIP Security Warning
          <span class="ctip-score-badge">${theme.label} \xB7 ${result.risk_score}%</span>
        </p>
        <ul class="ctip-reasons">${reasons}</ul>
        <div class="ctip-actions">
          <button class="ctip-btn ctip-btn-leave" id="ctip-leave">Leave This Site</button>
          <button class="ctip-btn ctip-btn-continue" id="ctip-continue">I Understand the Risk, Continue</button>
        </div>
      </div>
    </div>
  `;
    shadow.getElementById("ctip-leave")?.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.close();
      }
    });
    shadow.getElementById("ctip-continue")?.addEventListener("click", () => {
      host.remove();
      warningBannerInjected = false;
    });
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "INJECT_WARNING" && message.payload) {
      injectWarningBanner(message.payload);
      sendResponse({ ok: true });
    }
    if (message.type === "ANALYSIS_RESULT" && message.payload) {
      const result = message.payload;
      if (result.risk_score > 70) {
        injectWarningBanner(result);
      }
      sendResponse({ ok: true });
    }
    return true;
  });
  detectAndReport();
})();
