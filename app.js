(function () {
  const input = document.getElementById("in");
  const out = document.getElementById("out");
  const hitsEl = document.getElementById("hits");
  const stats = document.getElementById("stats");
  const runBtn = document.getElementById("run");
  const copyBtn = document.getElementById("copy");
  const clearBtn = document.getElementById("clear");

  const RULES = {
    email: {
      label: "email",
      re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      mask: () => "[EMAIL]",
    },
    phone: {
      label: "phone",
      // +251…, 09…, intl
      re: /(?:\+?251[\s-]?)?(?:0?9\d{8}|\(?0?\d{2,3}\)?[\s.-]?\d{3}[\s.-]?\d{3,4})\b/g,
      mask: () => "[PHONE]",
    },
    card: {
      label: "card",
      re: /\b(?:\d[ -]*?){13,19}\b/g,
      mask: () => "[CARD]",
      test: luhn,
    },
    secret: {
      label: "secret",
      re: /\b(?:sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z\-_]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
      mask: () => "[SECRET]",
    },
    ip: {
      label: "ip",
      re: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g,
      mask: () => "[IP]",
    },
    url_token: {
      label: "url token",
      re: /https?:\/\/[^\s]+(?:token|key|secret|access_token|api_key)=([^\s&#]+)/gi,
      mask: (m) => m.replace(/=([^\s&#]+)/i, "=[REDACTED]"),
    },
  };

  function luhn(num) {
    const digits = num.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function enabledKinds() {
    return [...document.querySelectorAll(".toggles input:checked")].map((el) => el.dataset.kind);
  }

  function findHits(text, kinds) {
    const hits = [];
    for (const kind of kinds) {
      const rule = RULES[kind];
      if (!rule) continue;
      const re = new RegExp(rule.re.source, rule.re.flags);
      let m;
      while ((m = re.exec(text)) !== null) {
        const value = m[0];
        if (rule.test && !rule.test(value)) continue;
        hits.push({
          kind,
          label: rule.label,
          value,
          start: m.index,
          end: m.index + value.length,
          replace: rule.mask(value),
        });
      }
    }
    hits.sort((a, b) => a.start - b.start || b.end - a.end);
    // drop overlaps (keep earliest / longest)
    const clean = [];
    let cursor = -1;
    for (const h of hits) {
      if (h.start < cursor) continue;
      clean.push(h);
      cursor = h.end;
    }
    return clean;
  }

  function apply(text, hits) {
    let outText = "";
    let i = 0;
    for (const h of hits) {
      outText += text.slice(i, h.start) + h.replace;
      i = h.end;
    }
    outText += text.slice(i);
    return outText;
  }

  function redact() {
    const text = input.value;
    if (!text.trim()) {
      hitsEl.textContent = "Nothing yet.";
      hitsEl.classList.add("empty");
      out.textContent = "Redacted text lands here.";
      out.classList.add("empty");
      stats.textContent = "";
      return;
    }
    const hits = findHits(text, enabledKinds());
    const cleaned = apply(text, hits);

    if (!hits.length) {
      hitsEl.textContent = "No matches for the selected kinds.";
      hitsEl.classList.add("empty");
    } else {
      hitsEl.classList.remove("empty");
      hitsEl.innerHTML = hits
        .map(
          (h) =>
            `<span class="hit"><span class="kind">${escapeHtml(h.label)}</span><b>${escapeHtml(
              h.value
            )}</b></span>`
        )
        .join("");
    }

    out.classList.remove("empty");
    out.textContent = cleaned;
    stats.textContent = `${hits.length} hit${hits.length === 1 ? "" : "s"} · ${text.length} chars in · ${cleaned.length} out`;
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  runBtn.addEventListener("click", redact);
  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      redact();
    }
  });

  copyBtn.addEventListener("click", async () => {
    const text = out.classList.contains("empty") ? "" : out.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = "Copy clean"), 1200);
    } catch {
      copyBtn.textContent = "Copy failed";
      setTimeout(() => (copyBtn.textContent = "Copy clean"), 1200);
    }
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    hitsEl.textContent = "Nothing yet.";
    hitsEl.classList.add("empty");
    out.textContent = "Redacted text lands here.";
    out.classList.add("empty");
    stats.textContent = "";
    input.focus();
  });
})();
