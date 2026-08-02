"use strict";
(() => {
  // popup/popup.ts
  var RISK_LEVELS = {
    TRUSTED: { label: "Trusted", fg: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.3)" },
    LOW: { label: "Low Risk", fg: "#facc15", bg: "rgba(250,204,21,0.1)", border: "rgba(250,204,21,0.3)" },
    SUSPICIOUS: { label: "Suspicious", fg: "#fb923c", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.3)" },
    HIGH: { label: "High Risk", fg: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
    CRITICAL: { label: "Critical", fg: "#ef4444", bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.5)" }
  };
  function getRiskLevel(score) {
    if (score <= 25) return "TRUSTED";
    if (score <= 50) return "LOW";
    if (score <= 70) return "SUSPICIOUS";
    if (score <= 90) return "HIGH";
    return "CRITICAL";
  }
  var statusDot = document.getElementById("status-dot");
  var statusLabel = document.getElementById("status-label");
  var domainEl = document.getElementById("current-domain");
  var urlEl = document.getElementById("current-url");
  var riskSection = document.getElementById("risk-section");
  var lastAnalEl = document.getElementById("last-analysis");
  function renderStatus(connected) {
    statusDot.className = `ctip-status-dot ${connected ? "connected" : "offline"}`;
    statusLabel.textContent = connected ? "Connected" : "Offline";
  }
  function renderDomain(domain, url) {
    domainEl.textContent = domain || "\u2014";
    if (url.length > 60) {
      urlEl.textContent = url.substring(0, 57) + "\u2026";
    } else {
      urlEl.textContent = url || "\u2014";
    }
  }
  function renderNeutral() {
    riskSection.innerHTML = `
    <div class="ctip-neutral">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z"/>
      </svg>
      <p class="ctip-neutral-text">Not yet analyzed</p>
      <p class="ctip-neutral-hint">Visit a login page to trigger analysis</p>
    </div>
  `;
    lastAnalEl.textContent = "No analysis available";
  }
  function renderRisk(result, cachedAt) {
    const level = getRiskLevel(result.risk_score);
    const theme = RISK_LEVELS[level];
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const progress = result.risk_score / 100 * circumference;
    const dashoffset = circumference - progress;
    const isCritical = level === "CRITICAL";
    const recColors = {
      ALLOW: { bg: "rgba(74,222,128,0.15)", fg: "#4ade80" },
      WARN: { bg: "rgba(251,146,60,0.15)", fg: "#fb923c" },
      BLOCK: { bg: "rgba(239,68,68,0.15)", fg: "#ef4444" }
    };
    const rec = recColors[result.recommendation] || recColors["WARN"];
    const reasonsHtml = result.reasons.slice(0, 3).map((r) => `<li>${r}</li>`).join("");
    riskSection.innerHTML = `
    <!-- Risk Score Circle -->
    <div class="risk-circle ${isCritical ? "risk-critical-pulse" : ""}">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle class="risk-circle-bg" cx="60" cy="60" r="${radius}" />
        <circle class="risk-circle-progress" cx="60" cy="60" r="${radius}"
          stroke="${theme.fg}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference}"
          data-target="${dashoffset}" />
      </svg>
      <div class="risk-score-text">
        <span class="risk-score-number" style="color:${theme.fg}">${result.risk_score}</span>
        <span class="risk-score-label" style="color:${theme.fg}">${theme.label}</span>
      </div>
    </div>

    <!-- Risk Badge -->
    <div class="risk-badge" style="background:${theme.bg};border-color:${theme.border};color:${theme.fg}">
      <span class="risk-badge-dot" style="background:${theme.fg}"></span>
      ${theme.label} \xB7 ${result.risk_score}%
    </div>

    <!-- Recommendation -->
    <div class="risk-recommendation" style="background:${rec.bg};color:${rec.fg}">
      ${result.recommendation}
    </div>

    <!-- Confidence Bar -->
    <div class="confidence-bar-wrap">
      <div class="confidence-bar-label">
        <span>Confidence</span>
        <span>${result.confidence}%</span>
      </div>
      <div class="confidence-bar">
        <div class="confidence-bar-fill" style="width:0%" data-target="${result.confidence}"></div>
      </div>
    </div>

    <!-- Reasons -->
    ${reasonsHtml ? `<ul class="risk-reasons">${reasonsHtml}</ul>` : ""}
  `;
    requestAnimationFrame(() => {
      const circle = riskSection.querySelector(".risk-circle-progress");
      if (circle) {
        const target = circle.getAttribute("data-target") || "0";
        circle.style.strokeDashoffset = target;
      }
      const bar = riskSection.querySelector(".confidence-bar-fill");
      if (bar) {
        const target = bar.getAttribute("data-target") || "0";
        bar.style.width = `${target}%`;
      }
    });
    if (cachedAt) {
      const date = new Date(cachedAt);
      const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      lastAnalEl.textContent = `Last analysis: ${timeStr}`;
    } else {
      lastAnalEl.textContent = "Just analyzed";
    }
  }
  function init() {
    chrome.runtime.sendMessage(
      { type: "POPUP_REQUEST_STATUS" },
      (response) => {
        if (chrome.runtime.lastError) {
          renderStatus(false);
          renderDomain("\u2014", "\u2014");
          renderNeutral();
          lastAnalEl.textContent = "Could not reach background service";
          return;
        }
        renderStatus(response.connected);
        renderDomain(response.domain, response.url);
        if (response.result) {
          renderRisk(response.result, response.cachedAt);
        } else {
          renderNeutral();
        }
      }
    );
  }
  document.addEventListener("DOMContentLoaded", init);
})();
